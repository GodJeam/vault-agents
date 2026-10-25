import { basename, isAbsolute, join } from "path";
import type { AgentProvider, ProviderDescriptor, RunnerHost } from "../../core/provider";
import type {
  AgentQuestion,
  AgentQuestionOption,
  EngineType,
  FinishInfo,
  RunHandle,
  RunRequest,
  SessionInfo,
  StreamCallbacks,
  UsageStats,
  UsageWindow,
} from "../../core/types";
import { DEFAULT_SETTINGS } from "../../core/types";
import { substitute } from "../../i18n";
import { BaseCliRunner, MAX_STREAM_LINE_BYTES } from "../base";
import type { OpencodeEvent, OpencodeModelInfo, OpencodeMessageInfo } from "./types";

/** Used when the model catalogue cannot be queried. */
const DEFAULT_CONTEXT_LIMIT = 128_000;

export const OPENCODE_DESCRIPTOR: ProviderDescriptor = {
  id: "opencode",
  displayName: "OpenCode CLI",
  shortName: "Opencode",
  defaultBinary: "opencode",
  defaultModel: "opencode-go/deepseek-v4.1-flash",
  binaryDesc:
    "Command or full path to the opencode executable. Usually 'opencode' is enough if it is on your PATH.",
  modelDesc: "Pick a model from the opencode list. Default uses the OpenCode Go provider.",
  included: false,
  supportsSessions: "api",
  supportsUsageStats: true,
  supportsDbCleanup: true,
  options: [
    {
      key: "agent",
      label: "Agent",
      desc: "The opencode agent to use (e.g. build, plan). Leave empty for the default.",
      type: "text",
      placeholder: "e.g. build",
      default: "",
    },
  ],
};

export class OpencodeRunner extends BaseCliRunner implements AgentProvider {
  readonly descriptor = OPENCODE_DESCRIPTOR;
  readonly id: EngineType = "opencode";
  readonly displayName = "OpenCode CLI";
  readonly engine: EngineType = "opencode";
  readonly included = false;

  private contextLimitCache = new Map<string, number>();
  private cachedModels: string[] | null = null;

  constructor(plugin: RunnerHost) {
    super(plugin);
  }

  private getConfig() {
    return this.plugin.getEngineConfig("opencode");
  }

  private getBin(): string {
    return this.resolveBinaryPath(this.getConfig().binary || "opencode");
  }

  async getVersion(): Promise<string> {
    const out = await this.execCli(this.getBin(), ["--version"]);
    const first = out.trim().split("\n")[0];
    if (!first) throw new Error("Empty output from opencode --version");
    return first;
  }

  async listModels(forceRefresh = false): Promise<string[]> {
    if (!forceRefresh && this.cachedModels && this.cachedModels.length > 0) {
      return this.cachedModels;
    }
    const out = await this.execCli(this.getBin(), ["models"]);
    this.cachedModels = out
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^[a-zA-Z0-9_.:/+-]+$/.test(l))
      .sort();
    return this.cachedModels;
  }

  async listSessions(): Promise<SessionInfo[]> {
    const sessions: SessionInfo[] = [];
    const seenIds = new Set<string>();

    // 1. Query opencode.db directly via sqlite3 (returns all sessions regardless of process cwd
    // and avoids CLI stdout truncation on large session lists)
    const dbPath = await this.getDbPath();
    if (dbPath) {
      for (const table of ["session_v2", "session"]) {
        try {
          const query = `SELECT id, replace(replace(COALESCE(title, ''), char(10), ' '), '|', ' '), time_updated, time_created, project_id, directory FROM ${table} ORDER BY time_updated DESC LIMIT 60`;
          const out = await this.execSqlite(dbPath, query);
          for (const line of out.trim().split(/\r?\n/)) {
            if (!line.trim()) continue;
            const parts = line.split("|");
            const id = parts[0]?.trim();
            if (!id || seenIds.has(id)) continue;
            const rawTitle = parts[1]?.trim() || "";
            const updated = parseInt(parts[2]?.trim() || "", 10);
            const created = parseInt(parts[3]?.trim() || "", 10);
            const projectId = parts[4]?.trim() || undefined;
            const directory = parts[5]?.trim() || undefined;
            sessions.push({
              id,
              title: rawTitle || this.fallbackSessionTitle(id),
              updated: !isNaN(updated) && updated > 0 ? updated : Date.now(),
              created: !isNaN(created) && created > 0 ? created : undefined,
              projectId,
              directory,
              engine: "opencode",
            });
            seenIds.add(id);
          }
          if (sessions.length > 0) break;
        } catch {
          // Try next table or fallback
        }
      }
    }

    // 2. Fallback to CLI `opencode session list --format json` (with vault cwd)
    if (sessions.length === 0) {
      try {
        const cwd = this.getVaultPath() ?? undefined;
        const out = await this.execCli(
          this.getBin(),
          ["session", "list", "--format", "json"],
          cwd
        );
        const arr = JSON.parse(out);
        if (Array.isArray(arr)) {
          for (const item of arr as SessionInfo[]) {
            if (!item?.id || seenIds.has(item.id)) continue;
            sessions.push({
              ...item,
              title: item.title?.trim() || this.fallbackSessionTitle(item.id),
              engine: "opencode",
            });
            seenIds.add(item.id);
          }
        }
      } catch {
        // Ignore and fall through to Obsidian history
      }
    }

    // 3. Ensure any OpenCode sessions saved in Obsidian histories are also included
    const histories = this.plugin.histories ?? {};
    const sessionEngines = this.plugin.settings.sessionEngines ?? {};
    for (const [id, msgs] of Object.entries(histories)) {
      if (seenIds.has(id)) continue;
      if (sessionEngines[id] === "opencode" || (!sessionEngines[id] && /^ses_/.test(id))) {
        const lastTs = msgs[msgs.length - 1]?.timestamp ?? Date.now();
        sessions.push({
          id,
          title: this.fallbackSessionTitle(id),
          updated: lastTs,
          engine: "opencode",
        });
        seenIds.add(id);
      }
    }

    return sessions;
  }

  private fallbackSessionTitle(sessionId: string): string {
    const msgs = this.plugin.getHistory(sessionId);
    const firstUser = msgs.find((m) => m.role === "user" && m.text.trim());
    if (firstUser) {
      const clean = firstUser.text.trim().replace(/\s+/g, " ");
      return clean.length > 48 ? clean.slice(0, 45) + "…" : clean;
    }
    return sessionId;
  }

  async renameSession(sessionId: string, title: string): Promise<void> {
    const dbPath = await this.getDbPath();
    if (dbPath) {
      const safeTitle = title.replace(/'/g, "''");
      const safeId = sessionId.replace(/'/g, "''");
      let updatedDb = false;
      for (const table of ["session_v2", "session"]) {
        try {
          await this.execSqlite(
            dbPath,
            `UPDATE ${table} SET title = '${safeTitle}' WHERE id = '${safeId}'`
          );
          updatedDb = true;
        } catch {
          // Ignore if table doesn't exist
        }
      }
      if (updatedDb) return;
    }
    await this.execCli(this.getBin(), [
      "api",
      "PATCH",
      `/api/session/${sessionId}`,
      "-d",
      JSON.stringify({ title }),
    ]);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.execCli(this.getBin(), ["session", "delete", sessionId]);
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
   */
  private async fetchModelContextLimit(model: string): Promise<number> {
    const out = await this.execCli(this.getBin(), ["api", "GET", "/api/model"]);
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
    // 1. Query sqlite3 directly for the latest assistant message's token breakdown
    // (avoids OpenCode's CLI stdout truncation on large /api/session/{id}/message payloads)
    const dbPath = await this.getDbPath();
    if (dbPath) {
      for (const table of ["session_message", "message"]) {
        try {
          const safeId = sessionId.replace(/'/g, "''");
          const whereClause =
            table === "session_message"
              ? `session_id = '${safeId}' AND type = 'assistant'`
              : `session_id = '${safeId}'`;
          const orderCol = table === "session_message" ? "seq DESC" : "time_created DESC";
          const out = await this.execSqlite(
            dbPath,
            `SELECT json_extract(data, '$.tokens') FROM ${table} WHERE ${whereClause} ORDER BY ${orderCol} LIMIT 5`
          );
          for (const line of out.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "null") continue;
            const tk = JSON.parse(trimmed) as OpencodeMessageInfo["tokens"];
            if (tk) {
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
        } catch {
          // Try next table or fallback
        }
      }
    }

    // 2. Fallback to saved Obsidian history for this session
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

    // 3. Final fallback: small /api/session/{id}/message response
    try {
      const out = await this.execCli(this.getBin(), [
        "api",
        "GET",
        `/api/session/${sessionId}/message`,
      ]);
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
    } catch {
      // Ignore
    }
    return { input: 0, output: 0 };
  }

  async pruneOversizedParts(force = false, ignoreAge = false): Promise<void> {
    const s = this.plugin.settings;
    if (!s.dbAutoCleanup && !force) return;
    const dbPath = await this.getDbPath();
    if (!dbPath) return;
    const maxBytes = Math.max(1, s.dbCleanupMaxMB || 5) * 1024 * 1024;
    const ageDays = Math.max(0, s.dbCleanupAgeDays ?? 7);
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
    try {
      const out = await this.execCli(this.getBin(), ["debug", "paths"]);
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
    try {
      const out = await this.execCli(this.getBin(), [
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

  /**
   * Build CLI arguments for an OpenCode invocation (exposed for testing)
   */
  public buildArgs(req: RunRequest): string[] {
    const s = this.plugin.settings;
    const cfg = this.getConfig();
    const cwd = req.cwd ?? this.getVaultPath() ?? undefined;
    const args = ["run", "--format", "json"];

    const sid = req.sessionId !== undefined ? req.sessionId : s.sessionId;
    if (sid && /^ses/.test(sid)) {
      args.push("--session", sid);
    }

    const model = cfg.model || s.model || DEFAULT_SETTINGS.model;
    args.push("--model", model);

    const agent = cfg.options.agent ?? s.agent;
    if (agent) args.push("--agent", agent);
    if (s.autoApprove) args.push("--auto");
    if (s.showThinking) args.push("--thinking");

    // IMPORTANT: prompt must precede --file flags
    args.push(req.prompt);
    for (const f of req.fileAttachments) {
      const fullPath = !isAbsolute(f) && cwd ? join(cwd, f) : f;
      args.push("--file", fullPath);
    }
    return args;
  }

  runStream(
    reqOrPrompt: RunRequest | string,
    fileAttachmentsOrCb?: string[] | StreamCallbacks,
    maybeCb?: StreamCallbacks
  ): RunHandle {
    const { req, cb } = this.normalizeRunArgs(reqOrPrompt, fileAttachmentsOrCb, maybeCb);
    const cwd = req.cwd ?? this.getVaultPath() ?? undefined;
    const args = this.buildArgs({ ...req, cwd });
    const bin = this.getBin();

    return this.spawnJsonlStream(bin, args, cwd, (line) => this.handleLine(line, cb), cb);
  }

  public handleLine(line: string, cb: StreamCallbacks): void {
    if (line.length > MAX_STREAM_LINE_BYTES) {
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
      case "step_start":
        cb.onActivity?.(this.plugin.t("Analyzing and planning..."));
        break;
      case "text":
        if (part?.type === "text" && typeof part.text === "string") {
          cb.onActivity?.(this.plugin.t("Writing response..."));
          cb.onText(part.text, String(part.id));
        }
        break;
      case "reasoning":
        if (typeof part?.text === "string") {
          cb.onActivity?.(this.plugin.t("Thinking..."));
          cb.onReasoning(part.text, String(part.id));
        }
        break;
      case "tool_use":
        if (part?.type === "tool") {
          const toolName = String(part.tool || "tool");
          const rawState = String(part.state?.status || "completed");
          const input = part.state?.input;
          const startMs = part.state?.time?.start;
          const endMs = part.state?.time?.end;
          const durationMs =
            typeof startMs === "number" && typeof endMs === "number" && endMs >= startMs
              ? endMs - startMs
              : undefined;

          if (toolName === "question" || toolName === "ask_question") {
            const questions = this.parseOpencodeQuestions(input);
            const qTitle = questions[0]?.question || this.plugin.t("Agent question");
            if (questions.length > 0) {
              cb.onQuestion?.(questions);
            }
            cb.onActivity?.(this.plugin.t("Waiting for your answer..."));
            cb.onStep({
              id: String(part.callID || part.id || "step-" + Date.now()),
              tool: toolName,
              title: qTitle,
              state: "completed",
              input,
              output: part.state?.output,
              durationMs,
            });
            break;
          }

          const title = this.extractOpencodeToolTitle(toolName, input, part.state?.title);
          if (rawState === "running") {
            cb.onActivity?.(substitute(this.plugin.t("Running: $1"), title));
          } else {
            cb.onActivity?.(this.plugin.t("Analyzing and planning..."));
          }

          cb.onStep({
            id: String(part.callID || part.id || "step-" + Date.now()),
            tool: toolName,
            title,
            state: rawState,
            input,
            output: part.state?.output,
            durationMs,
          });
        }
        break;
      case "step_finish": {
        const tk = part?.tokens;
        let normalizedTokens: FinishInfo["tokens"] | undefined;
        if (tk) {
          const input = Number(tk.input ?? 0);
          const output = Number(tk.output ?? 0);
          const reasoning = Number(tk.reasoning ?? 0);
          const rawTotal = Number(tk.total ?? 0);
          const total = rawTotal > 0 ? rawTotal : input + output + reasoning;
          normalizedTokens = {
            ...tk,
            input,
            output,
            reasoning,
            total,
          };
        }
        cb.onFinish({
          tokens: normalizedTokens,
          cost: typeof part?.cost === "number" ? part.cost : undefined,
        });
        break;
      }
      case "error":
        cb.onError(this.errorMessage(ev.error));
        break;
      default:
        break;
    }

    // Fallback: reasoning part inside other event types
    if (type !== "reasoning" && part?.type === "reasoning" && typeof part?.text === "string") {
      cb.onActivity?.(this.plugin.t("Thinking..."));
      cb.onReasoning(part.text, String(part.id));
    }
  }

  private extractOpencodeToolTitle(
    toolName: string,
    input: unknown,
    stateTitle?: string
  ): string {
    const inp = input && typeof input === "object" ? (input as Record<string, unknown>) : null;
    if (inp) {
      if (typeof inp.filePath === "string" && inp.filePath.trim()) {
        return basename(inp.filePath.trim());
      }
      if (typeof inp.path === "string" && inp.path.trim()) {
        return basename(inp.path.trim()) || inp.path.trim();
      }
      if (typeof inp.description === "string" && inp.description.trim()) {
        return inp.description.trim();
      }
      if (typeof inp.command === "string" && inp.command.trim()) {
        return inp.command.trim();
      }
      if (typeof inp.pattern === "string" && inp.pattern.trim()) {
        return inp.pattern.trim();
      }
      if (typeof inp.url === "string" && inp.url.trim()) {
        return inp.url.trim();
      }
      if (typeof inp.query === "string" && inp.query.trim()) {
        return inp.query.trim();
      }
      if (Array.isArray(inp.todos) && inp.todos.length > 0) {
        const doneCount = inp.todos.filter(
          (t) => t && typeof t === "object" && (t as { status?: string }).status === "completed"
        ).length;
        return `${inp.todos.length} ${this.plugin.t("tasks")} (${doneCount} ${this.plugin.t("done")})`;
      }
    }
    if (stateTitle && stateTitle.trim() && stateTitle.trim().toLowerCase() !== toolName.toLowerCase()) {
      return stateTitle.trim();
    }
    return toolName;
  }

  private parseOpencodeQuestions(input: unknown): AgentQuestion[] {
    if (!input || typeof input !== "object") return [];
    const inp = input as Record<string, unknown>;
    const rawQuestions = inp.questions;
    if (!Array.isArray(rawQuestions)) return [];

    const result: AgentQuestion[] = [];
    for (const item of rawQuestions) {
      if (!item || typeof item !== "object") continue;
      const qObj = item as Record<string, unknown>;
      const question = typeof qObj.question === "string" ? qObj.question.trim() : "";
      if (!question) continue;
      const header = typeof qObj.header === "string" ? qObj.header.trim() : undefined;
      const multiple = Boolean(qObj.multiple ?? qObj.is_multi_select);
      const rawOpts = Array.isArray(qObj.options) ? qObj.options : [];
      const options: AgentQuestionOption[] = [];
      for (const opt of rawOpts) {
        if (typeof opt === "string" && opt.trim()) {
          options.push({ label: opt.trim() });
        } else if (opt && typeof opt === "object") {
          const o = opt as Record<string, unknown>;
          const label = typeof o.label === "string" ? o.label.trim() : "";
          if (label) {
            options.push({
              label,
              description: typeof o.description === "string" ? o.description.trim() : undefined,
            });
          }
        }
      }
      result.push({ header, question, options, multiple });
    }
    return result;
  }

  private errorMessage(err: unknown): string {
    if (!err) return this.plugin.t("Unknown error");
    const e = err as { data?: { message?: string }; message?: string };
    const msg = e.data?.message || e.message || JSON.stringify(err);
    return String(msg);
  }
}
