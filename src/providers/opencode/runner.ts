import { FileSystemAdapter } from "obsidian";
import type OpencodePlugin from "../../main";
import type { AgentProvider } from "../../core/provider";
import type {
  EngineType,
  RunHandle,
  SessionInfo,
  StreamCallbacks,
  UsageStats,
  UsageWindow,
} from "../../core/types";
import { DEFAULT_SETTINGS } from "../../core/types";
import { BaseCliRunner } from "../base";
import type { OpencodeEvent, OpencodeModelInfo, OpencodeMessageInfo } from "./types";

/** Used when the model catalogue cannot be queried. */
const DEFAULT_CONTEXT_LIMIT = 128_000;

export class OpencodeRunner extends BaseCliRunner implements AgentProvider {
  readonly id: EngineType = "opencode";
  readonly displayName = "OpenCode CLI";
  readonly engine: EngineType = "opencode";
  readonly included = false;

  private contextLimitCache = new Map<string, number>();
  private cachedModels: string[] | null = null;

  constructor(plugin: OpencodePlugin) {
    super(plugin);
  }

  async getVersion(): Promise<string> {
    const bin = this.resolveBinaryPath(this.plugin.settings.binaryPath || "opencode");
    const out = await this.execCli(bin, ["--version"]);
    const first = out.trim().split("\n")[0];
    if (!first) throw new Error("Empty output from opencode --version");
    return first;
  }

  async listModels(forceRefresh = false): Promise<string[]> {
    if (!forceRefresh && this.cachedModels && this.cachedModels.length > 0) {
      return this.cachedModels;
    }
    const bin = this.resolveBinaryPath(this.plugin.settings.binaryPath || "opencode");
    const out = await this.execCli(bin, ["models"]);
    this.cachedModels = out
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^[a-zA-Z0-9_.:/+-]+$/.test(l))
      .sort();
    return this.cachedModels;
  }

  async listSessions(): Promise<SessionInfo[]> {
    const bin = this.resolveBinaryPath(this.plugin.settings.binaryPath || "opencode");
    try {
      const out = await this.execCli(bin, ["session", "list", "--format", "json"]);
      const arr = JSON.parse(out);
      return Array.isArray(arr) ? (arr as SessionInfo[]) : [];
    } catch {
      return [];
    }
  }

  async renameSession(sessionId: string, title: string): Promise<void> {
    const bin = this.resolveBinaryPath(this.plugin.settings.binaryPath || "opencode");
    await this.execCli(bin, [
      "api",
      "PATCH",
      `/api/session/${sessionId}`,
      "-d",
      JSON.stringify({ title }),
    ]);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const bin = this.resolveBinaryPath(this.plugin.settings.binaryPath || "opencode");
    await this.execCli(bin, ["session", "delete", sessionId]);
  }

  async getModelContextLimit(model: string): Promise<number> {
    const cached = this.contextLimitCache.get(model);
    if (cached !== undefined) return cached;
    let limit = 0;
    try {
      limit = await this.fetchModelContextLimit(model);
    } catch {
      limit = 0;
    }
    if (limit > 0) {
      this.contextLimitCache.set(model, limit);
      return limit;
    }
    return DEFAULT_CONTEXT_LIMIT;
  }

  /**
   * Query the local OpenCode API for the model catalogue and read `limit.context`.
   * The previous approach (`opencode models <provider> --verbose`) is not
   * supported by the CLI (v2.x) and always failed.
   */
  private async fetchModelContextLimit(model: string): Promise<number> {
    const bin = this.resolveBinaryPath(this.plugin.settings.binaryPath || "opencode");
    const out = await this.execCli(bin, ["api", "GET", "/api/model"]);
    const parsed = JSON.parse(out) as { data?: OpencodeModelInfo[] };
    const models = Array.isArray(parsed.data) ? parsed.data : [];
    const target = model.split("#")[0];
    const slash = target.indexOf("/");
    const wantProvider = slash >= 0 ? target.slice(0, slash) : "";
    const wantModel = slash >= 0 ? target.slice(slash + 1) : target;
    const match = models.find(
      (m) =>
        (m.providerID === wantProvider && m.modelID === wantModel) ||
        m.modelID === target ||
        m.id === target
    );
    const ctx = match?.limit?.context;
    return typeof ctx === "number" && ctx > 0 ? ctx : 0;
  }

  async getSessionTokens(sessionId: string): Promise<{ input: number; output: number }> {
    // The context size is the prompt of the last turn: uncached input plus the
    // prompt-cache reads/writes. Using the session totals would overstate it.
    const bin = this.resolveBinaryPath(this.plugin.settings.binaryPath || "opencode");
    try {
      const out = await this.execCli(bin, ["api", "GET", `/api/session/${sessionId}/message`]);
      const parsed = JSON.parse(out) as { data?: OpencodeMessageInfo[] };
      const messages = Array.isArray(parsed.data) ? parsed.data : [];
      for (let i = messages.length - 1; i >= 0; i--) {
        const tk = messages[i]?.tokens;
        if (tk) {
          const input =
            Number(tk.input ?? 0) +
            Number(tk.cache?.read ?? 0) +
            Number(tk.cache?.write ?? 0);
          return { input, output: Number(tk.output ?? 0) };
        }
      }
      return { input: 0, output: 0 };
    } catch {
      return { input: 0, output: 0 };
    }
  }

  async pruneOversizedParts(force = false, ignoreAge = false): Promise<void> {
    const s = this.plugin.settings;
    if (!s.dbAutoCleanup && !force) return;
    const dbPath = await this.getDbPath();
    if (!dbPath) return;
    const maxBytes = Math.max(1, s.dbCleanupMaxMB || 5) * 1024 * 1024;
    const ageDays = Math.max(0, s.dbCleanupAgeDays ?? 7);
    // `part.time_created` is stored in milliseconds in the v2 schema.
    const cutoffMs = Date.now() - ageDays * 86400 * 1000;
    const q =
      `DELETE FROM part WHERE data LIKE '%"type":"file%' AND length(CAST(data AS BLOB)) > ${maxBytes}` +
      (ignoreAge ? "" : ` AND time_created < ${cutoffMs}`);
    try {
      await this.execSqlite(dbPath, q);
    } catch {
      // Best effort
    }
  }

  private async getDbPath(): Promise<string | null> {
    const bin = this.resolveBinaryPath(this.plugin.settings.binaryPath || "opencode");
    try {
      const out = await this.execCli(bin, ["debug", "paths"]);
      for (const line of out.split(/\r?\n/)) {
        const m = line.match(/^\s*db\s+(.+\.db)\s*$/);
        if (m) return m[1].trim();
      }
    } catch {
      // ignore
    }
    return null;
  }

  private execSqlite(dbPath: string, sql: string): Promise<string> {
    return this.execCli("sqlite3", [dbPath, sql]);
  }

  async getUsageStats(): Promise<UsageStats> {
    const now = Date.now();
    const [h5, week, month] = await Promise.all([
      this.fetchUsageWindow(now - 5 * 3600 * 1000, now),
      this.fetchUsageWindow(now - 7 * 24 * 3600 * 1000, now),
      this.fetchUsageWindow(now - 30 * 24 * 3600 * 1000, now),
    ]);
    const zero = (): UsageWindow => ({ input: 0, output: 0, cost: 0 });
    return {
      h5: h5 ?? zero(),
      week: week ?? zero(),
      month: month ?? zero(),
    };
  }

  private async fetchUsageWindow(from: number, to: number): Promise<UsageWindow | null> {
    const bin = this.resolveBinaryPath(this.plugin.settings.binaryPath || "opencode");
    try {
      const out = await this.execCli(bin, [
        "api",
        "GET",
        "/api/experimental/session/stats",
        "--param",
        `from=${from}`,
        "--param",
        `to=${to}`,
      ]);
      const parsed = JSON.parse(out) as {
        data?: { tokens?: { input?: number; output?: number }; cost?: number };
      };
      const d = parsed.data ?? {};
      return {
        input: Number(d.tokens?.input ?? 0),
        output: Number(d.tokens?.output ?? 0),
        cost: Number(d.cost ?? 0),
      };
    } catch {
      return null;
    }
  }

  runStream(prompt: string, fileAttachments: string[], cb: StreamCallbacks): RunHandle {
    const s = this.plugin.settings;
    const args = ["run", "--format", "json"];
    // Only reuse ids that belong to opencode ("ses..."); a session id inherited
    // from another engine would make the CLI fail.
    if (s.sessionId && /^ses/.test(s.sessionId)) args.push("--session", s.sessionId);
    // Model must always be explicit: running without --model hangs opencode run
    args.push("--model", s.model || DEFAULT_SETTINGS.model);
    if (s.agent) args.push("--agent", s.agent);
    if (s.autoApprove) args.push("--auto");
    if (s.showThinking) args.push("--thinking");
    // IMPORTANT: prompt must precede --file flags
    args.push(prompt);
    for (const f of fileAttachments) args.push("--file", f);

    const adapter = this.plugin.app.vault.adapter;
    const cwd = adapter instanceof FileSystemAdapter ? adapter.getBasePath() : undefined;
    const bin = this.resolveBinaryPath(s.binaryPath || "opencode");
    const child = this.spawnBinary(bin, args, cwd);

    let buffer = "";
    child.stdout?.on("data", (d: Buffer) => {
      buffer += d.toString();
      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
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

  private handleLine(line: string, cb: StreamCallbacks): void {
    if (line.length > 20_000_000) {
      cb.onRaw?.(`[omitted event of ${line.length} bytes]\n`);
      return;
    }
    let ev: OpencodeEvent;
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

    // Fallback: reasoning part inside other event types
    if (type !== "reasoning" && part?.type === "reasoning" && typeof part?.text === "string") {
      cb.onReasoning(part.text, String(part.id));
    }
  }

  private errorMessage(err: unknown): string {
    if (!err) return this.plugin.t("Unknown error");
    const e = err as { data?: { message?: string }; message?: string };
    const msg = e.data?.message || e.message || JSON.stringify(err);
    return String(msg);
  }
}
