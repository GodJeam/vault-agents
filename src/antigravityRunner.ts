import { spawn, type ChildProcess, type SpawnOptions } from "child_process";
import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { copyFile, mkdir, readdir, stat, unlink } from "fs/promises";
import { basename, dirname, extname, join } from "path";
import { homedir, tmpdir } from "os";
import { FileSystemAdapter } from "obsidian";
import type OpencodePlugin from "./main";
import type {
  AgentRunner,
  EngineType,
  FinishInfo,
  RunHandle,
  SessionInfo,
  StepInfo,
  StreamCallbacks,
  UsageStats,
} from "./types";

export class AntigravityRunner implements AgentRunner {
  readonly engine: EngineType = "antigravity";
  private plugin: OpencodePlugin;
  private resolvedBinaries = new Map<string, string | null>();
  private activeProcs = new Set<ChildProcess>();

  constructor(plugin: OpencodePlugin) {
    this.plugin = plugin;
  }

  killAll(): void {
    for (const child of [...this.activeProcs]) {
      this.killNow(child);
    }
    this.activeProcs.clear();
  }

  async getVersion(): Promise<string> {
    const out = await this.execCli(["--version"]);
    const first = out.trim().split("\n")[0];
    if (!first) throw new Error("Empty output from agy --version");
    return first;
  }

  private cachedModels: string[] | null = null;

  async listModels(forceRefresh = false): Promise<string[]> {
    if (!forceRefresh && this.cachedModels && this.cachedModels.length > 0) {
      return this.cachedModels;
    }
    try {
      const out = await this.execCli(["models"]);
      const models: string[] = [];
      for (const line of out.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const match = trimmed.match(/^([a-zA-Z0-9_.-]+)\s+/);
        if (match) {
          const id = match[1];
          if (id !== "Fetching" && id !== "Usage" && !models.includes(id)) {
            models.push(id);
          }
        } else if (/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
          if (trimmed !== "Fetching" && !models.includes(trimmed)) {
            models.push(trimmed);
          }
        }
      }
      if (models.length > 0) {
        this.cachedModels = models;
        return models;
      }
    } catch (e) {
      console.warn("[vault-agents] Failed to fetch agy models dynamically:", e);
    }

    // Default fallback models for Antigravity (Google AI Pro)
    const defaults = [
      "gemini-3.8-flash-high",
      "gemini-3.8-flash-medium",
      "gemini-3.8-flash-low",
      "gemini-3.7-flash-high",
      "gemini-3.7-flash-medium",
      "gemini-3.1-pro-high",
      "gemini-3.1-pro-low",
      "claude-sonnet-4-6",
      "claude-opus-4-6-thinking",
      "gpt-oss-120b-medium",
    ];
    this.cachedModels = defaults;
    return defaults;
  }

  async listSessions(): Promise<SessionInfo[]> {
    const sessions: SessionInfo[] = [];
    const seenIds = new Set<string>();

    // 1. Try querying conversation_summaries.db via sqlite3
    const dbPath = this.getDbPath();
    if (existsSync(dbPath)) {
      try {
        const query =
          "SELECT conversation_id, title, strftime('%s', last_modified_time) FROM conversation_summaries ORDER BY last_modified_time DESC LIMIT 50";
        const out = await this.execSqlite(dbPath, query);
        for (const line of out.trim().split("\n")) {
          const parts = line.split("|");
          const id = parts[0]?.trim();
          if (!id) continue;
          const title = parts[1]?.trim() || id;
          const sec = parseInt(parts[2]?.trim() || "", 10);
          const updated = !isNaN(sec) && sec > 0 ? sec * 1000 : Date.now();
          sessions.push({
            id,
            title,
            updated,
            engine: "antigravity",
          });
          seenIds.add(id);
        }
      } catch (e) {
        // Sqlite query not available or error, fall through to history
      }
    }

    // 2. Add any Antigravity sessions saved in Obsidian histories
    const histories = this.plugin.histories ?? {};
    const sessionEngines = this.plugin.settings.sessionEngines ?? {};
    for (const [id, msgs] of Object.entries(histories)) {
      if (seenIds.has(id)) continue;
      if (sessionEngines[id] === "antigravity" || (!sessionEngines[id] && id.includes("-"))) {
        const firstUser = msgs.find((m) => m.role === "user");
        const title = firstUser?.text ? firstUser.text.slice(0, 40) : id;
        sessions.push({
          id,
          title,
          updated: Date.now(),
          engine: "antigravity",
        });
        seenIds.add(id);
      }
    }

    return sessions;
  }

  async renameSession(sessionId: string, title: string): Promise<void> {
    const dbPath = this.getDbPath();
    if (existsSync(dbPath)) {
      try {
        const safeTitle = title.replace(/'/g, "''");
        const safeId = sessionId.replace(/'/g, "''");
        await this.execSqlite(
          dbPath,
          `UPDATE conversation_summaries SET title = '${safeTitle}' WHERE conversation_id = '${safeId}'`
        );
      } catch {
        // Best effort
      }
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const dbPath = this.getDbPath();
    if (existsSync(dbPath)) {
      try {
        const safeId = sessionId.replace(/'/g, "''");
        await this.execSqlite(
          dbPath,
          `DELETE FROM conversation_summaries WHERE conversation_id = '${safeId}'`
        );
      } catch {
        // Best effort
      }
    }
  }

  async getModelContextLimit(model: string): Promise<number> {
    const m = model.toLowerCase();
    if (m.includes("gemini")) return 1_048_576; // 1M tokens
    if (m.includes("claude")) return 200_000;   // 200K tokens
    return 128_000;
  }

  async getSessionTokens(sessionId: string): Promise<{ input: number; output: number }> {
    let input = 0;
    let output = 0;
    const history = this.plugin.getHistory(sessionId);
    for (const msg of history) {
      if (msg.role === "assistant" && msg.tokens) {
        input += msg.tokens.input ?? 0;
        output += msg.tokens.output ?? 0;
      }
    }
    return { input, output };
  }

  async getUsageStats(): Promise<UsageStats> {
    let totalIn = 0;
    let totalOut = 0;
    const histories = this.plugin.histories ?? {};
    const sessionEngines = this.plugin.settings.sessionEngines ?? {};
    for (const [id, msgs] of Object.entries(histories)) {
      if (sessionEngines[id] === "antigravity" || !sessionEngines[id]) {
        for (const msg of msgs) {
          if (msg.role === "assistant" && msg.tokens) {
            totalIn += msg.tokens.input ?? 0;
            totalOut += msg.tokens.output ?? 0;
          }
        }
      }
    }
    const win = { input: totalIn, output: totalOut, cost: 0 };
    return {
      h5: win,
      week: win,
      month: win,
    };
  }

  runStream(prompt: string, fileAttachments: string[], cb: StreamCallbacks): RunHandle {
    const s = this.plugin.settings;
    let finalPrompt = prompt;

    // Attach contents of text/markdown files directly so Antigravity can reason over them
    for (const p of fileAttachments) {
      try {
        const content = readFileSync(p, "utf-8");
        const filename = basename(p);
        finalPrompt = `[ATTACHMENT: ${filename}]\n${content}\n\n---\n\n` + finalPrompt;
      } catch {
        finalPrompt = `[ATTACHMENT PATH: ${p}]\n\n---\n\n` + finalPrompt;
      }
    }

    const args = ["-p", finalPrompt, "--output-format", "stream-json"];

    // Automatically approve tool execution and file modification permissions
    args.push("--dangerously-skip-permissions");

    const sid = s.sessionId;
    if (sid && !sid.startsWith("ses_")) {
      args.push("--conversation", sid);
    }

    const model = s.antigravityModel || s.model;
    if (model) {
      args.push("--model", model);
    }

    if (s.antigravityEffort) {
      args.push("--effort", s.antigravityEffort);
    }

    const adapter = this.plugin.app.vault.adapter;
    const cwd = adapter instanceof FileSystemAdapter ? adapter.getBasePath() : undefined;
    const bin = this.resolveBinaryPath(s.antigravityBinary || "agy");
    const child = this.spawnBinary(bin, args, cwd);

    const streamState = { accumulatedText: "" };

    let buffer = "";
    child.stdout?.on("data", (d: Buffer) => {
      buffer += d.toString();
      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try {
          this.handleLine(line, cb, streamState);
        } catch (e) {
          console.error("vault-agents: error handling antigravity event:", e);
        }
      }
    });

    child.stdout?.on("end", () => {
      if (buffer.trim()) this.handleLine(buffer.trim(), cb, streamState);
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

  private handleLine(
    line: string,
    cb: StreamCallbacks,
    streamState: { accumulatedText: string }
  ): void {
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

    // 1. Init event
    if (ev.event === "init") {
      const cid = ev.conversation_id;
      if (typeof cid === "string" && cid) {
        cb.onSession(cid);
      }
      return;
    }

    // 2. Step update event
    if (ev.event === "step_update" && ev.step_update) {
      const su = ev.step_update;
      const cid = su.conversation_id;
      if (typeof cid === "string" && cid) {
        cb.onSession(cid);
      }

      const stepType = su.step_type;
      const stepIndex = su.step_index;

      // Accumulate incremental text chunks (delta)
      if (typeof su.text_delta === "string" && su.text_delta) {
        streamState.accumulatedText += su.text_delta;
        cb.onText(streamState.accumulatedText, String(stepIndex ?? 0));
      }

      // Reasoning / thought block if present
      if (typeof su.thought === "string" && su.thought) {
        cb.onReasoning(su.thought, String(stepIndex ?? 0));
      } else if (typeof su.reasoning === "string" && su.reasoning) {
        cb.onReasoning(su.reasoning, String(stepIndex ?? 0));
      }

      // Tool execution: extract descriptive title from parameters for the UI
      if (stepType === "tool") {
        const toolName = String(su.tool_name || su.tool_info?.name || "tool");
        const isDone = su.state === "DONE";
        const isError = su.status === "ERROR" || Boolean(su.error);
        const params = su.tool_info?.parameters;

        let title = "";
        if (params && typeof params === "object") {
          if (params.toolSummary && typeof params.toolSummary === "string") {
            title = params.toolSummary;
          } else if (params.CommandLine && typeof params.CommandLine === "string") {
            title = params.CommandLine;
          } else if (params.TargetFile && typeof params.TargetFile === "string") {
            title = basename(params.TargetFile);
          } else if (params.AbsolutePath && typeof params.AbsolutePath === "string") {
            title = basename(params.AbsolutePath);
          } else if (params.toolAction && typeof params.toolAction === "string") {
            title = params.toolAction;
          } else if (params.query && typeof params.query === "string") {
            title = params.query;
          }
        }
        if (!title) {
          title = toolName;
        }

        cb.onStep({
          id: `step-${stepIndex ?? Date.now()}-${toolName}`,
          tool: toolName,
          title,
          state: isDone ? (isError ? "error" : "completed") : "running",
          input: params,
          output: su.tool_info?.output,
        });
      }

      return;
    }

    // 3. Result event: synchronize full final response and token usage
    if (ev.event === "result" && ev.result) {
      const res = ev.result;
      if (typeof res.response === "string" && res.response.trim()) {
        streamState.accumulatedText = res.response;
        cb.onText(streamState.accumulatedText, "final");
      }
      const u = res.usage ?? {};
      cb.onFinish({
        tokens: {
          total: u.total_tokens ?? 0,
          input: u.input_tokens ?? 0,
          output: u.output_tokens ?? 0,
          reasoning: u.thinking_tokens ?? 0,
        },
        cost: 0, // Included with Google AI Pro!
      });
      return;
    }

    // 4. Error event
    if (ev.event === "error" || ev.error) {
      const msg = ev.error?.message || JSON.stringify(ev.error || ev);
      cb.onError(String(msg));
    }
  }

  // Document conversion using anydoc
  async convertDocument(absPath: string): Promise<string> {
    const hash = createHash("sha256").update(absPath).digest("hex").slice(0, 16);
    const dir = join(tmpdir(), "vault-agents-anydoc");
    await mkdir(dir, { recursive: true });
    const outPath = join(dir, hash + ".md");
    try {
      const [src, out] = await Promise.all([stat(absPath), stat(outPath)]);
      if (out.mtimeMs >= src.mtimeMs) return outPath;
    } catch {
      // not yet cached
    }
    const ext = extname(absPath) || ".pdf";
    const cleanInput = join(dir, "in-" + hash + ext);
    await copyFile(absPath, cleanInput);
    const bin = this.plugin.settings.anydocBinary || "anydoc";
    await new Promise<void>((resolve, reject) => {
      const child = this.spawnBinary(bin, [cleanInput, "-o", outPath]);
      let err = "";
      child.stderr?.on("data", (d: Buffer) => (err += d.toString()));
      child.on("error", (e) => reject(e));
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`anydoc exited with code ${code}: ${err.trim().slice(0, 200)}`));
      });
    });
    return outPath;
  }

  private execCli(args: string[]): Promise<string> {
    const bin = this.resolveBinaryPath(this.plugin.settings.antigravityBinary || "agy");
    return new Promise((resolve, reject) => {
      const child = this.spawnBinary(bin, args);
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

  private execSqlite(dbPath: string, query: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn("sqlite3", [dbPath, query], {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let out = "";
      let err = "";
      child.stdout?.on("data", (d: Buffer) => (out += d.toString()));
      child.stderr?.on("data", (d: Buffer) => (err += d.toString()));
      child.on("error", (e) => reject(e));
      child.on("close", (code) => {
        if (code === 0) resolve(out);
        else reject(new Error(err.trim() || `sqlite3 exit code ${code}`));
      });
    });
  }

  private getDbPath(): string {
    return join(homedir(), ".gemini", "antigravity-cli", "conversation_summaries.db");
  }

  private resolveBinaryPath(bin: string): string {
    const cached = this.resolvedBinaries.get(bin);
    if (cached !== undefined && cached !== null) return cached;

    // Check direct path or ~/.local/bin/agy
    if (existsSync(bin)) {
      this.resolvedBinaries.set(bin, bin);
      return bin;
    }
    const localBin = join(homedir(), ".local", "bin", bin);
    if (existsSync(localBin)) {
      this.resolvedBinaries.set(bin, localBin);
      return localBin;
    }
    const geminiBin = join(homedir(), ".gemini", "antigravity-cli", "bin", bin);
    if (existsSync(geminiBin)) {
      this.resolvedBinaries.set(bin, geminiBin);
      return geminiBin;
    }

    this.resolvedBinaries.set(bin, bin);
    return bin;
  }

  private spawnBinary(bin: string, args: string[], cwd?: string): ChildProcess {
    const isWin = process.platform === "win32";
    const options: SpawnOptions = {
      cwd,
      shell: isWin && (bin.endsWith(".cmd") || bin.endsWith(".bat")),
      windowsHide: true,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    };
    const child = spawn(bin, args, options);
    this.trackProc(child);
    return child;
  }

  private trackProc(child: ChildProcess): void {
    this.activeProcs.add(child);
    child.once("close", () => this.activeProcs.delete(child));
    child.once("error", () => this.activeProcs.delete(child));
  }

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
}
