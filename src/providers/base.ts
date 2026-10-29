import { spawn, type ChildProcess, type SpawnOptions } from "child_process";
import { createHash } from "crypto";
import { existsSync, readFileSync, statSync } from "fs";
import { copyFile, mkdir, readdir, stat, unlink } from "fs/promises";
import { basename, dirname, extname, isAbsolute, join } from "path";
import { homedir, tmpdir } from "os";
import type { RunnerHost } from "../core/provider";
import type {
  AgentQuestion,
  AgentQuestionOption,
  EngineType,
  RunHandle,
  RunRequest,
  SessionInfo,
  StreamCallbacks,
  UsageStats,
  UsageWindow,
} from "../core/types";

export const MAX_STREAM_LINE_BYTES = 20_000_000;

/**
 * Maximum size (in bytes) of a text attachment to inline directly into CLI args
 * so we never hit OS ARG_MAX / E2BIG limits. Larger files are passed by path.
 */
export const MAX_INLINE_ATTACHMENT_BYTES = 256 * 1024;

export const BINARY_EXT_REGEX = new RegExp(
  "\\.(png|jpe?g|gif|webp|bmp|svg|ico|pdf|zip|tar|gz|" +
    "7z|rar|bin|exe|dmg|iso|mp3|wav|ogg|mp4|mov|avi|mkv|wasm)$",
  "i"
);

export abstract class BaseCliRunner {
  protected plugin: RunnerHost;
  protected resolvedBinaries = new Map<string, string | null>();
  protected activeProcs = new Set<ChildProcess>();

  constructor(plugin: RunnerHost) {
    this.plugin = plugin;
  }

  /**
   * Terminate all currently active child processes
   */
  killAll(): void {
    for (const child of [...this.activeProcs]) {
      this.killNow(child);
    }
    this.activeProcs.clear();
  }

  /**
   * Forcibly terminate a specific child process
   */
  killNow(child: ChildProcess): void {
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

  /**
   * Terminate process with optional watchdog to ensure exit
   */
  killProc(child: ChildProcess, watch = false): void {
    this.killNow(child);
    if (!watch) return;
    const deadline = Date.now() + 6000;
    const timer = setInterval(() => {
      if (
        child.exitCode !== null ||
        child.signalCode !== null ||
        Date.now() > deadline
      ) {
        clearInterval(timer);
        return;
      }
      this.killNow(child);
    }, 1000);
  }

  /**
   * Register a spawned process for tracking and automatic cleanup
   */
  protected trackProc(child: ChildProcess): void {
    this.activeProcs.add(child);
    child.once("close", () => this.activeProcs.delete(child));
    child.once("error", () => this.activeProcs.delete(child));
  }

  /**
   * Spawn a CLI process with proper platform flags and environment
   */
  protected spawnBinary(
    bin: string,
    args: string[],
    cwd?: string,
    extraEnv?: NodeJS.ProcessEnv
  ): ChildProcess {
    const isWin = process.platform === "win32";
    const env: NodeJS.ProcessEnv =
      cwd || extraEnv
        ? Object.assign(
            {},
            process.env,
            cwd ? { PWD: cwd } : undefined,
            extraEnv
          )
        : process.env;
    const options: SpawnOptions = {
      cwd,
      shell: isWin && (bin.endsWith(".cmd") || bin.endsWith(".bat")),
      windowsHide: true,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    };
    const child = spawn(bin, args, options);
    this.trackProc(child);
    return child;
  }

  /**
   * Normalize both `runStream(req, cb)` and legacy
   * `runStream(prompt, files, cb)`
   */
  protected normalizeRunArgs(
    reqOrPrompt: RunRequest | string,
    fileAttachmentsOrCb?: string[] | StreamCallbacks,
    maybeCb?: StreamCallbacks
  ): { req: RunRequest; cb: StreamCallbacks } {
    if (typeof reqOrPrompt === "string") {
      return {
        req: {
          prompt: reqOrPrompt,
          fileAttachments: Array.isArray(fileAttachmentsOrCb)
            ? fileAttachmentsOrCb
            : [],
        },
        cb: maybeCb as StreamCallbacks,
      };
    }
    return {
      req: reqOrPrompt,
      cb: fileAttachmentsOrCb as StreamCallbacks,
    };
  }

  /**
   * Shared JSONL streaming execution loop for CLI providers
   */
  protected spawnJsonlStream(
    bin: string,
    args: string[],
    cwd: string | undefined,
    onLine: (line: string) => void,
    cb: StreamCallbacks
  ): RunHandle {
    const child = this.spawnBinary(bin, args, cwd);

    let buffer = "";
    child.stdout?.on("data", (d: Buffer) => {
      buffer += d.toString();
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try {
          onLine(line);
        } catch (e) {
          console.error("[vault-agents] error handling stream event:", e);
        }
      }
    });

    child.stdout?.on("end", () => {
      const remaining = buffer.trim();
      if (remaining) {
        try {
          onLine(remaining);
        } catch (e) {
          console.error("[vault-agents] error handling final stream event:", e);
        }
      }
    });

    child.stderr?.on("data", (d: Buffer) => {
      cb.onRaw?.(d.toString());
    });

    child.on("error", (e) => cb.onError(e.message));
    child.on("close", (code) => {
      cb.onDone(code ?? -1);
    });

    return {
      abort: () => this.killProc(child, true),
    };
  }

  /**
   * Execute a CLI binary via promise, returning standard output
   */
  protected execCli(
    bin: string,
    args: string[],
    cwd?: string,
    extraEnv?: NodeJS.ProcessEnv
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = this.spawnBinary(bin, args, cwd, extraEnv);
      let out = "";
      let err = "";
      child.stdout?.on("data", (d: Buffer) => (out += d.toString()));
      child.stderr?.on("data", (d: Buffer) => (err += d.toString()));
      child.on("error", (e) => reject(e));
      child.on("close", (code) => {
        if (code === 0) resolve(out);
        else {
          reject(new Error(err.trim() || out.trim() || `exit code ${code}`));
        }
      });
    });
  }

  /**
   * Resolve full path to a CLI executable, checking PATH and candidate folders
   */
  protected resolveBinaryPath(
    bin: string,
    candidatePaths: string[] = []
  ): string {
    const cached = this.resolvedBinaries.get(bin);
    if (cached !== undefined && cached !== null) return cached;

    if (process.platform === "win32") {
      const winResolved = this.findWindowsBinary(bin);
      if (winResolved) {
        this.resolvedBinaries.set(bin, winResolved);
        return winResolved;
      }
    }

    if (existsSync(bin)) {
      this.resolvedBinaries.set(bin, bin);
      return bin;
    }

    const defaultCandidates = [
      join(homedir(), ".local", "bin", bin),
      join(homedir(), ".opencode", "bin", bin),
      join(homedir(), ".gemini", "antigravity-cli", "bin", bin),
      join(homedir(), ".hermes", "bin", bin),
      join(homedir(), ".claude", "local", bin),
      `/usr/local/bin/${bin}`,
      `/usr/bin/${bin}`,
    ];

    const allCandidates = [...candidatePaths, ...defaultCandidates];
    for (const p of allCandidates) {
      if (existsSync(p)) {
        this.resolvedBinaries.set(bin, p);
        return p;
      }
    }

    return bin;
  }

  private findWindowsBinary(bin: string): string | null {
    if (bin.toLowerCase().endsWith(".exe")) return bin;
    const hasPath = bin.includes("\\") || bin.includes("/");
    if (hasPath) {
      const resolved = this.resolveCmdShim(bin);
      if (resolved) return resolved;
      const dir = join(bin, "..");
      const exe = join(dir, bin.replace(/\.(cmd|bat|ps1)$/i, "") + ".exe");
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

  /**
   * Retrieve the absolute filesystem path of the Obsidian vault via RunnerHost
   */
  getVaultPath(): string | null {
    return this.plugin.getVaultPath();
  }

  /**
   * Inline small text attachments into the prompt and pass larger/binary files
   * by path. Used by CLI providers without a dedicated `--file` flag.
   */
  protected inlinePromptAttachments(
    prompt: string,
    fileAttachments: string[],
    cwd?: string
  ): string {
    const s = this.plugin.settings;
    let finalPrompt = prompt;
    const maxInlineBytes = Math.min(
      MAX_INLINE_ATTACHMENT_BYTES,
      Math.max(1, s.maxAttachMB || 20) * 1024 * 1024
    );

    for (const p of fileAttachments) {
      const fullPath = !isAbsolute(p) && cwd ? join(cwd, p) : p;
      if (BINARY_EXT_REGEX.test(fullPath)) {
        finalPrompt = `[ATTACHMENT PATH: ${fullPath}]\n\n---\n\n` + finalPrompt;
      } else {
        try {
          const st = statSync(fullPath);
          if (st.size > maxInlineBytes) {
            finalPrompt =
              `[ATTACHMENT PATH: ${fullPath}]\n\n---\n\n` + finalPrompt;
          } else {
            const content = readFileSync(fullPath, "utf-8");
            const filename = basename(fullPath);
            finalPrompt =
              `[ATTACHMENT: ${filename}]\n${content}\n\n---\n\n` + finalPrompt;
          }
        } catch {
          finalPrompt =
            `[ATTACHMENT PATH: ${fullPath}]\n\n---\n\n` + finalPrompt;
        }
      }
    }
    return finalPrompt;
  }

  /**
   * List sessions saved in Obsidian histories for a given engine.
   */
  protected listHistorySessions(
    engineId: EngineType,
    seenIds = new Set<string>(),
    legacyIdMatcher?: RegExp
  ): SessionInfo[] {
    const sessions: SessionInfo[] = [];
    const histories = this.plugin.histories ?? {};
    const sessionEngines = this.plugin.settings.sessionEngines ?? {};

    for (const [id, msgs] of Object.entries(histories)) {
      if (seenIds.has(id)) continue;
      const matchesEngine =
        sessionEngines[id] === engineId ||
        (!sessionEngines[id] && Boolean(legacyIdMatcher?.test(id)));
      if (matchesEngine) {
        const firstUser = msgs.find((m) => m.role === "user" && m.text.trim());
        const rawTitle = firstUser?.text
          ? firstUser.text.trim().replace(/\s+/g, " ")
          : id;
        const title =
          rawTitle.length > 44 ? rawTitle.slice(0, 41) + "…" : rawTitle;
        const lastTs = msgs[msgs.length - 1]?.timestamp ?? Date.now();
        sessions.push({
          id,
          title,
          updated: lastTs,
          engine: engineId,
        });
        seenIds.add(id);
      }
    }
    return sessions;
  }

  /**
   * Read the last turn's token usage from saved Obsidian history.
   */
  protected getHistorySessionTokens(
    sessionId: string
  ): { input: number; output: number } {
    const history = this.plugin.getHistory(sessionId);
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg.role === "assistant" && msg.tokens) {
        const tk = msg.tokens;
        const input =
          Number(tk.input ?? 0) +
          Number(tk.cache?.read ?? 0) +
          Number(tk.cache?.write ?? 0);
        const output = Number(tk.output ?? 0);
        if (input > 0 || output > 0) {
          return { input, output };
        }
      }
    }
    return { input: 0, output: 0 };
  }

  /**
   * Compute 5h / week / month usage statistics from saved Obsidian histories.
   */
  protected computeHistoryUsageStats(
    engineId: EngineType,
    legacyIdMatcher?: RegExp
  ): UsageStats {
    const now = Date.now();
    const h5Cutoff = now - 5 * 3600 * 1000;
    const weekCutoff = now - 7 * 24 * 3600 * 1000;
    const monthCutoff = now - 30 * 24 * 3600 * 1000;

    const h5: UsageWindow = { input: 0, output: 0, cost: 0 };
    const week: UsageWindow = { input: 0, output: 0, cost: 0 };
    const month: UsageWindow = { input: 0, output: 0, cost: 0 };

    const histories = this.plugin.histories ?? {};
    const sessionEngines = this.plugin.settings.sessionEngines ?? {};
    for (const [id, msgs] of Object.entries(histories)) {
      const matchesEngine =
        sessionEngines[id] === engineId ||
        (!sessionEngines[id] && Boolean(legacyIdMatcher?.test(id)));
      if (!matchesEngine) continue;

      for (const msg of msgs) {
        if (msg.role === "assistant" && msg.tokens) {
          const inp = msg.tokens.input ?? 0;
          const out = msg.tokens.output ?? 0;
          const cost = msg.cost ?? 0;
          const ts = msg.timestamp;
          if (!ts || ts >= monthCutoff) {
            month.input += inp;
            month.output += out;
            month.cost += cost;
          }
          if (!ts || ts >= weekCutoff) {
            week.input += inp;
            week.output += out;
            week.cost += cost;
          }
          if (!ts || ts >= h5Cutoff) {
            h5.input += inp;
            h5.output += out;
            h5.cost += cost;
          }
        }
      }
    }
    return { h5, week, month };
  }

  /**
   * Estimate model context window limit from well-known model family names.
   */
  protected estimateModelContextLimit(
    model: string,
    defaultLimit = 128_000
  ): number {
    const m = (model || "").toLowerCase();
    if (m.includes("gemini")) return 1_048_576; // 1M tokens
    if (m.includes("claude")) return 200_000; // 200K tokens
    if (m.includes("gpt-5") || m.includes("codex")) return 256_000;
    if (m.includes("o3") || m.includes("o4") || m.includes("gpt-4")) {
      return 200_000;
    }
    if (m.includes("hermes") || m.includes("deepseek")) return 128_000;
    return defaultLimit;
  }

  /**
   * Extract a human-friendly target title from arbitrary tool parameters.
   */
  protected extractCommonToolTitle(
    toolName: string,
    input: unknown,
    stateTitle?: string
  ): string {
    const inp =
      input && typeof input === "object"
        ? (input as Record<string, unknown>)
        : null;
    if (inp) {
      if (typeof inp.toolSummary === "string" && inp.toolSummary.trim()) {
        return inp.toolSummary.trim();
      }
      for (const key of [
        "filePath",
        "file_path",
        "TargetFile",
        "AbsolutePath",
        "Path",
        "path",
      ]) {
        const val = inp[key];
        if (typeof val === "string" && val.trim()) {
          return basename(val.trim()) || val.trim();
        }
      }
      if (typeof inp.DirectoryPath === "string" && inp.DirectoryPath.trim()) {
        const dp = inp.DirectoryPath.trim();
        return basename(dp) || dp;
      }
      if (
        typeof inp.SearchDirectory === "string" &&
        inp.SearchDirectory.trim()
      ) {
        const dirName = basename(inp.SearchDirectory.trim());
        const q = typeof inp.Query === "string" ? inp.Query.trim() : "";
        return q ? `"${q}" in ${dirName}` : dirName;
      }
      if (typeof inp.Query === "string" && inp.Query.trim()) {
        return `"${inp.Query.trim()}"`;
      }
      for (const key of [
        "description",
        "command",
        "CommandLine",
        "cmd",
        "pattern",
        "Pattern",
        "url",
        "query",
        "Role",
        "toolAction",
      ]) {
        const val = inp[key];
        if (typeof val === "string" && val.trim()) {
          return val.trim();
        }
      }
      if (Array.isArray(inp.todos) && inp.todos.length > 0) {
        const doneCount = inp.todos.filter(
          (t) =>
            t &&
            typeof t === "object" &&
            (t as { status?: string }).status === "completed"
        ).length;
        const tasksWord = this.plugin.t("tasks");
        const doneWord = this.plugin.t("done");
        return `${inp.todos.length} ${tasksWord} (${doneCount} ${doneWord})`;
      }
    }
    if (
      stateTitle &&
      stateTitle.trim() &&
      stateTitle.trim().toLowerCase() !== toolName.toLowerCase()
    ) {
      return stateTitle.trim();
    }
    return toolName;
  }

  /**
   * Parse interactive agent questions from tool parameters across providers.
   */
  protected parseCommonQuestions(input: unknown): AgentQuestion[] {
    if (!input || typeof input !== "object") return [];
    const params = input as Record<string, unknown>;
    let rawQuestions: unknown = params.questions;
    if (typeof rawQuestions === "string") {
      try {
        rawQuestions = JSON.parse(rawQuestions);
      } catch {
        return [];
      }
    }
    if (!Array.isArray(rawQuestions)) return [];

    const result: AgentQuestion[] = [];
    for (const item of rawQuestions) {
      if (!item || typeof item !== "object") continue;
      const qObj = item as Record<string, unknown>;
      const question =
        typeof qObj.question === "string" ? qObj.question.trim() : "";
      if (!question) continue;
      const header =
        typeof qObj.header === "string" ? qObj.header.trim() : undefined;
      const multiple = Boolean(qObj.is_multi_select ?? qObj.multiple);
      const rawOpts = Array.isArray(qObj.options) ? qObj.options : [];
      const options: AgentQuestionOption[] = [];
      for (const opt of rawOpts) {
        if (typeof opt === "string" && opt.trim()) {
          options.push({ label: opt.trim() });
        } else if (opt && typeof opt === "object") {
          const o = opt as Record<string, unknown>;
          const label = typeof o.label === "string" ? o.label.trim() : "";
          if (label) {
            const desc =
              typeof o.description === "string"
                ? o.description.trim()
                : undefined;
            options.push({ label, description: desc });
          }
        }
      }
      result.push({ header, question, options, multiple });
    }
    return result;
  }

  /**
   * Convert a document (PDF, Word, Excel, etc.) to Markdown using anydoc
   */
  async convertDocument(absPath: string): Promise<string> {
    const hash = createHash("sha256")
      .update(absPath)
      .digest("hex")
      .slice(0, 16);
    const dir = join(tmpdir(), "vault-agents-anydoc");
    await mkdir(dir, { recursive: true });
    const outPath = join(dir, hash + ".md");

    try {
      const [src, out] = await Promise.all([stat(absPath), stat(outPath)]);
      if (out.mtimeMs >= src.mtimeMs) return outPath;
    } catch {
      // Not yet cached
    }

    const ext = extname(absPath) || ".pdf";
    const cleanInput = join(dir, "in-" + hash + ext);
    await copyFile(absPath, cleanInput);
    await this.cleanupTempFiles(dir);

    const bin = this.resolveBinaryPath(
      this.plugin.settings.anydocBinary || "anydoc"
    );
    try {
      await new Promise<void>((resolve, reject) => {
        const child = this.spawnBinary(bin, [
          cleanInput,
          "--ocr",
          "hosted",
          "-o",
          outPath,
        ]);
        let err = "";
        child.stderr?.on("data", (d: Buffer) => (err += d.toString()));
        child.on("error", (e) => reject(e));
        child.on("close", (code) => {
          if (code === 0) resolve();
          else {
            const detail = err.trim().slice(0, 200);
            reject(new Error(`anydoc exited with code ${code}: ${detail}`));
          }
        });
      });
    } finally {
      await unlink(cleanInput).catch(() => {});
    }

    return outPath;
  }

  /**
   * Delete stale temporary files older than maxAgeMs (default 24h)
   */
  protected async cleanupTempFiles(
    dir: string,
    maxAgeMs = 24 * 3600 * 1000
  ): Promise<void> {
    try {
      const files = await readdir(dir);
      const now = Date.now();
      for (const f of files) {
        try {
          const p = join(dir, f);
          const st = await stat(p);
          if (now - st.mtimeMs > maxAgeMs) {
            await unlink(p);
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }
}
