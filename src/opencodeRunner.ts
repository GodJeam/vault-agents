import { spawn, type ChildProcess, type SpawnOptions } from "child_process";
import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { copyFile, mkdir, readdir, stat, unlink } from "fs/promises";
import { basename, dirname, extname, join } from "path";
import { tmpdir } from "os";
import { FileSystemAdapter } from "obsidian";
import type OpencodePlugin from "./main";
import { DEFAULT_SETTINGS } from "./settings";

import type {
  AgentRunner,
  EngineType,
  FinishInfo,
  RunHandle,
  SessionInfo,
  StepInfo,
  StreamCallbacks,
  UsageStats,
  UsageWindow,
} from "./types";

export type {
  AgentRunner,
  EngineType,
  FinishInfo,
  RunHandle,
  SessionInfo,
  StepInfo,
  StreamCallbacks,
  UsageStats,
  UsageWindow,
};

export class OpencodeRunner implements AgentRunner {
  readonly engine: EngineType = "opencode";
  private plugin: OpencodePlugin;
  private resolvedBinaries = new Map<string, string | null>();
  private contextLimitCache = new Map<string, number>();
  private activeProcs = new Set<ChildProcess>();

  constructor(plugin: OpencodePlugin) {
    this.plugin = plugin;
  }

  // Force-terminate every process started by this plugin (used when the plugin
  // unloads or as a last-resort escape hatch for a stuck run).
  killAll(): void {
    for (const child of [...this.activeProcs]) this.killNow(child);
    this.activeProcs.clear();
  }

  // Convert a document (PDF, Word, Excel, ...) to Markdown using anydoc
  // (https://github.com/firecrawl/anydoc). Returns the path of the .md file.
  async convertDocument(absPath: string): Promise<string> {
    const hash = createHash("sha256").update(absPath).digest("hex").slice(0, 16);
    const dir = join(tmpdir(), "vault-agents-anydoc");
    await mkdir(dir, { recursive: true });
    const outPath = join(dir, hash + ".md");
    await this.cleanupTempFiles(dir);
    // Reuse a previous conversion if it is still newer than the source, so
    // unchanged documents are not re-converted (and re-copied) on every send.
    try {
      const [src, out] = await Promise.all([stat(absPath), stat(outPath)]);
      if (out.mtimeMs >= src.mtimeMs) return outPath;
    } catch {
      // no cached conversion yet
    }
    // Copy to a temp path WITHOUT spaces: on Windows the anydoc shim is run via
    // the shell, and a path with spaces gets split into multiple arguments
    // ("one document per invocation"). The temp dir is space-free.
    const ext = extname(absPath) || ".pdf";
    const cleanInput = join(dir, "in-" + hash + ext);
    await copyFile(absPath, cleanInput);
    await this.convertWithAnydoc(cleanInput, outPath);
    return outPath;
  }

  private async convertWithAnydoc(inputPath: string, outputPath: string): Promise<void> {
    const bin = this.plugin.settings.anydocBinary || "anydoc";
    await new Promise<void>((resolve, reject) => {
      const child = this.spawnBinary(bin, [inputPath, "-o", outputPath]);
      let err = "";
      child.stderr?.on("data", (d: Buffer) => (err += d.toString()));
      child.on("error", (e) => reject(e));
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`anydoc exited with code ${code}: ${err.trim().slice(0, 200)}`));
      });
    });
  }

  // Remove anydoc temp files older than 24h. The .md output cannot be deleted
  // right away because `opencode run` reads it while the request is in flight,
  // so we clean up opportunistically on the next conversion.
  private async cleanupTempFiles(dir: string): Promise<void> {
    const cutoff = Date.now() - 24 * 3600 * 1000;
    try {
      for (const name of await readdir(dir)) {
        const p = join(dir, name);
        try {
          if ((await stat(p)).mtimeMs < cutoff) await unlink(p);
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  private trackProc(child: ChildProcess): void {
    this.activeProcs.add(child);
    child.once("close", () => this.activeProcs.delete(child));
    child.once("error", () => this.activeProcs.delete(child));
  }

  // Context window size (tokens) of a model, parsed from `opencode models --verbose`.
  async getModelContextLimit(model: string): Promise<number> {
    const cached = this.contextLimitCache.get(model);
    if (cached !== undefined) return cached;
    const slash = model.indexOf("/");
    const provider = slash >= 0 ? model.slice(0, slash) : model;
    const out = await this.execCli(["models", provider, "--verbose"]);
    const limit = this.parseContextLimit(out, model);
    if (limit > 0) this.contextLimitCache.set(model, limit);
    return limit;
  }

  private parseContextLimit(out: string, model: string): number {
    const lines = out.split(/\r?\n/);
    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      if (/^[a-zA-Z0-9_.:/+-]+$/.test(line) && line.includes("/")) {
        let json = "";
        let depth = 0;
        let started = false;
        let j = i + 1;
        for (; j < lines.length; j++) {
          const l = lines[j];
          if (!started) {
            if (!l.trim()) continue;
            started = true;
          }
          json += l + "\n";
          for (const ch of l) {
            if (ch === "{") depth++;
            else if (ch === "}") depth--;
          }
          if (depth === 0) break;
        }
        if (line === model) {
          try {
            const obj = JSON.parse(json);
            const ctx = (obj as { limit?: { context?: unknown } })?.limit?.context;
            if (typeof ctx === "number") return ctx;
          } catch {
            // Try with the next model
          }
        }
        i = j;
      } else {
        i++;
      }
    }
    return 0;
  }

  // Accumulated token usage of a session, read from the opencode database.
  async getSessionTokens(sessionId: string): Promise<{ input: number; output: number }> {
    // "to" is a reserved keyword in SQLite: use a different alias for tokens_output.
    const query =
      `SELECT COALESCE(tokens_input,0) AS ti, COALESCE(tokens_output,0) AS tout FROM session WHERE id=${this.sqlString(sessionId)}`;
    const rows = (await this.runDbQuery(query)) as { ti?: number; tout?: number }[];
    const r = rows[0] ?? {};
    return { input: Number(r.ti ?? 0), output: Number(r.tout ?? 0) };
  }

  // Remove oversized file attachments from the opencode database. Attached
  // documents are stored by opencode as base64 "file" parts: an unreadable
  // (e.g. scanned) PDF can easily add tens of MB per attachment and bloat the
  // DB, causing slow writes and "database is locked" errors. Only "file" parts
  // are targeted; conversation text/reasoning parts are never touched.
  async pruneOversizedParts(force = false, ignoreAge = false): Promise<void> {
    const s = this.plugin.settings;
    if (!s.dbAutoCleanup && !force) return;
    const maxBytes = Math.max(1, s.dbCleanupMaxMB || 5) * 1024 * 1024;
    const ageDays = Math.max(0, s.dbCleanupAgeDays ?? 7);
    const cutoff = Math.floor(Date.now() / 1000) - ageDays * 86400;
    const q =
      `DELETE FROM part WHERE data LIKE '%"type":"file%' AND length(data) > ${maxBytes}` +
      (ignoreAge ? "" : ` AND time_created < ${cutoff}`);
    try {
      await this.runDbQuery(q);
    } catch {
      // best effort: the database may be briefly locked (retry on next run)
    }
  }

  getVersion(): Promise<string> {
    return this.execCli(["--version"]).then((out) => {
      const first = out.trim().split("\n")[0];
      if (!first) throw new Error("empty output from opencode --version");
      return first;
    });
  }

  private cachedModels: string[] | null = null;

  async listModels(forceRefresh = false): Promise<string[]> {
    if (!forceRefresh && this.cachedModels && this.cachedModels.length > 0) {
      return this.cachedModels;
    }
    const out = await this.execCli(["models"]);
    this.cachedModels = out
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^[a-zA-Z0-9_.:/+-]+$/.test(l))
      .sort();
    return this.cachedModels;
  }

  listSessions(): Promise<SessionInfo[]> {
    return this.execCli(["session", "list", "--format", "json"]).then((out) => {
      try {
        const arr = JSON.parse(out);
        return Array.isArray(arr) ? (arr as SessionInfo[]) : [];
      } catch {
        return [];
      }
    });
  }

  renameSession(sessionId: string, title: string): Promise<void> {
    const query =
      `UPDATE session SET title=${this.sqlString(title)} WHERE id=${this.sqlString(sessionId)}`;
    return this.runDbQuery(query).then(() => undefined);
  }

  deleteSession(sessionId: string): Promise<void> {
    return this.execCli(["session", "delete", sessionId]).then(() => undefined);
  }

  execCli(args: string[], cwd?: string): Promise<string> {
    const s = this.plugin.settings;
    return new Promise((resolve, reject) => {
      const child = this.spawnBinary(s.binaryPath, args, cwd);
      let out = "";
      let err = "";
      child.stdout?.on("data", (d: Buffer) => (out += d.toString()));
      child.stderr?.on("data", (d: Buffer) => (err += d.toString()));
      child.on("error", (e) => reject(e));
      child.on("close", (code) => {
        if (code === 0) resolve(out);
        else reject(new Error(err.trim() || out.trim() || `exit code ${code}`));
      });
    });
  }

  private sqlString(value: string): string {
    return "'" + value.replace(/'/g, "''") + "'";
  }

  getUsageStats(): Promise<UsageStats> {
    const now = Date.now();
    const t5h = now - 5 * 3600 * 1000;
    const t7d = now - 7 * 24 * 3600 * 1000;
    const t30d = now - 30 * 24 * 3600 * 1000;
    const query = `
      SELECT
        COALESCE(SUM(CASE WHEN time_updated >= ${t5h} THEN tokens_input END),0) AS h5_input,
        COALESCE(SUM(CASE WHEN time_updated >= ${t5h} THEN tokens_output END),0) AS h5_output,
        COALESCE(SUM(CASE WHEN time_updated >= ${t5h} THEN cost END),0) AS h5_cost,
        COALESCE(SUM(CASE WHEN time_updated >= ${t7d} THEN tokens_input END),0) AS w_input,
        COALESCE(SUM(CASE WHEN time_updated >= ${t7d} THEN tokens_output END),0) AS w_output,
        COALESCE(SUM(CASE WHEN time_updated >= ${t7d} THEN cost END),0) AS w_cost,
        COALESCE(SUM(CASE WHEN time_updated >= ${t30d} THEN tokens_input END),0) AS m_input,
        COALESCE(SUM(CASE WHEN time_updated >= ${t30d} THEN tokens_output END),0) AS m_output,
        COALESCE(SUM(CASE WHEN time_updated >= ${t30d} THEN cost END),0) AS m_cost
      FROM session
    `;
    return this.runDbQuery(query).then((rows) => {
      const r = (rows[0] ?? {}) as Record<string, unknown>;
      const num = (v: unknown): number => Number(v ?? 0);
      return {
        h5: { input: num(r.h5_input), output: num(r.h5_output), cost: num(r.h5_cost) },
        week: { input: num(r.w_input), output: num(r.w_output), cost: num(r.w_cost) },
        month: { input: num(r.m_input), output: num(r.m_output), cost: num(r.m_cost) },
      };
    });
  }

  runDbQuery(query: string): Promise<unknown[]> {
    return this.execCli(["db", query, "--format", "json"]).then((out) => {
      try {
        const arr = JSON.parse(out);
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [];
      }
    });
  }

  runStream(prompt: string, fileAttachments: string[], cb: StreamCallbacks): RunHandle {
    return this.cliRunStream(prompt, fileAttachments, cb);
  }

  private cliRunStream(prompt: string, fileAttachments: string[], cb: StreamCallbacks): RunHandle {
    const s = this.plugin.settings;
    const args = ["run", "--format", "json"];
    if (s.sessionId) args.push("--session", s.sessionId);
    // Model must always be explicit: running without --model hangs opencode run.
    args.push("--model", s.model || DEFAULT_SETTINGS.model);
    if (s.agent) args.push("--agent", s.agent);
    if (s.autoApprove) args.push("--auto");
    if (s.showThinking) args.push("--thinking");
    // IMPORTANT: prompt must precede --file flags (--file is variadic and
    // consumes all subsequent arguments as file paths).
    args.push(prompt);
    for (const f of fileAttachments) args.push("--file", f);

    const adapter = this.plugin.app.vault.adapter;
    const cwd = adapter instanceof FileSystemAdapter ? adapter.getBasePath() : undefined;
    const child = this.spawnBinary(s.binaryPath, args, cwd);

    let buffer = "";
    child.stdout?.on("data", (d: Buffer) => {
      buffer += d.toString();
      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        // If an event line fails to parse, do not block the buffer:
        // isolate it so subsequent events keep arriving.
        try {
          this.handleLine(line, cb);
        } catch (e) {
          console.error("vault-agents: error handling an event:", e);
        }
      }
    });
    child.stdout?.on("end", () => {
      if (buffer.trim()) this.handleLine(buffer.trim(), cb);
    });
    child.stderr?.on("data", (d: Buffer) => {
      if (cb.onRaw) cb.onRaw(d.toString());
    });
    child.on("error", (e) => cb.onError(e.message));
    child.on("close", (code) => {
      cb.onDone(code ?? -1);
    });
    return {
      abort: () => this.killProc(child, true),
    };
  }

  // Kill the process (and its children) reliably. On Windows taskkill /F is
  // used; Node's child.kill() is also called as a fallback. When `watch` is
  // true the process is re-checked and re-killed until it actually closes, so
  // a hung process cannot keep the chat permanently stuck.
  killProc(child: ChildProcess, watch = false): void {
    this.killNow(child);
    if (!watch) return;
    const deadline = Date.now() + 6000;
    const timer = setInterval(() => {
      if (child.exitCode !== null || child.signalCode !== null || Date.now() > deadline) {
        clearInterval(timer);
        return;
      }
      this.killNow(child);
    }, 1000);
  }

  private killNow(child: ChildProcess): void {
    if (!child || child.pid === undefined) return;
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
      } else {
        child.kill("SIGKILL");
      }
    } catch {
      // ignore
    }
    try {
      child.kill();
    } catch {
      // ignore
    }
  }

  private handleLine(line: string, cb: StreamCallbacks): void {
    // Tool outputs can be large, but a low threshold would drop text events
    // for long answers. Only skip pathological lines (>20MB) to prevent
    // JSON.parse from blocking the UI thread. Normal large outputs are processed.
    if (line.length > 20_000_000) {
      cb.onRaw?.(`[omitted event of ${line.length} bytes]\n`);
      return;
    }
    let ev: any;
    try {
      ev = JSON.parse(line);
    } catch {
      cb.onRaw?.(line + "\n");
      return;
    }

    const sid = typeof ev.sessionID === "string" ? ev.sessionID : undefined;
    if (sid) cb.onSession(sid);

    const type = ev.type;
    const part = ev.part;
    switch (type) {
      case "text":
        if (part?.type === "text" && typeof part.text === "string") {
          cb.onText(part.text, String(part.id));
        }
        break;
      case "reasoning":
        if (typeof part?.text === "string") {
          cb.onReasoning(part.text, String(part.id));
        }
        break;
      case "tool_use":
        if (part?.type === "tool") {
          const state = part.state?.status || "completed";
          cb.onStep({
            id: String(part.callID || part.id || "step-" + Date.now()),
            tool: String(part.tool),
            title: String(part.state?.title || part.tool || this.plugin.t("Tool")),
            state: String(state),
            input: part.state?.input,
            output: part.state?.output,
          });
        }
        break;
      case "step_finish":
        cb.onFinish({
          tokens: part?.tokens,
          cost: typeof part?.cost === "number" ? part.cost : undefined,
        });
        break;
      case "error":
        cb.onError(this.errorMessage(ev.error));
        break;
      default:
        break;
    }

    // Fallback: a "reasoning" part can arrive inside other event types
    if (type !== "reasoning" && part?.type === "reasoning" && typeof part?.text === "string") {
      cb.onReasoning(part.text, String(part.id));
    }
  }

  private errorMessage(err: any): string {
    if (!err) return this.plugin.t("Unknown error");
    const msg = err.data?.message || err.message || JSON.stringify(err);
    return String(msg);
  }

  // Single spawn path for both opencode and anydoc. On Windows a resolved .exe
  // is preferred (avoids the shell); otherwise a .cmd/.bat shim or a bare
  // command name must go through the shell to be resolved. `resolveCmdShim`
  // already strips the shim when possible, but a full path to an unresolvable
  // shim still needs the shell, so it is handled here too.
  private spawnBinary(bin: string, args: string[], cwd?: string): ChildProcess {
    const isWin = process.platform === "win32";
    const resolved = isWin ? this.resolveBinary(bin) : null;
    const lower = bin.toLowerCase();
    const isShim = lower.endsWith(".cmd") || lower.endsWith(".bat");
    const hasPath = bin.includes("\\") || bin.includes("/");
    const shell = isWin && !resolved && (isShim || !hasPath);
    // Quote a shell command path that contains spaces, otherwise it would be
    // split into multiple arguments.
    const command = shell && bin.includes(" ") ? `"${bin}"` : resolved ?? bin;
    const options: SpawnOptions = {
      cwd,
      shell,
      windowsHide: true,
      env: process.env,
      // IMPORTANT: stdin must be "ignore", not "pipe". With piped stdin,
      // `opencode run` hangs without producing output on Windows.
      stdio: ["ignore", "pipe", "pipe"],
    };
    const child = spawn(command, args, options);
    this.trackProc(child);
    return child;
  }

  private resolveBinary(bin: string): string | null {
    const cached = this.resolvedBinaries.get(bin);
    if (cached !== undefined) return cached;
    const resolved = this.findWindowsBinary(bin);
    this.resolvedBinaries.set(bin, resolved);
    return resolved;
  }

  private findWindowsBinary(bin: string): string | null {
    if (bin.toLowerCase().endsWith(".exe")) return bin;
    const hasPath = bin.includes("\\") || bin.includes("/");
    if (hasPath) {
      const resolved = this.resolveCmdShim(bin);
      if (resolved) return resolved;
      // Fallback: look for an .exe adjacent to the shim
      const dir = dirname(bin);
      const exe = join(dir, basename(bin).replace(/\.(cmd|bat|ps1)$/i, "") + ".exe");
      return existsSync(exe) ? exe : null;
    }
    const dirs = (process.env.PATH ?? "").split(";").filter(Boolean);
    for (const dir of dirs) {
      const cmdPath = join(dir, bin + ".cmd");
      const exePath = join(dir, bin + ".exe");
      if (existsSync(cmdPath)) {
        const resolved = this.resolveCmdShim(cmdPath);
        if (resolved) return resolved;
      }
      if (existsSync(exePath)) return exePath;
    }
    return null;
  }

  private resolveCmdShim(shimPath: string): string | null {
    try {
      const content = readFileSync(shimPath, "utf8");
      const dir = dirname(shimPath);
      const m = content.match(/"([^"]+\.exe)"/i);
      if (m) {
        const target = m[1].replace(/%dp0%/gi, dir).replace(/%base%/gi, dir);
        if (existsSync(target)) return target;
      }
    } catch {
      // ignore
    }
    return null;
  }
}
