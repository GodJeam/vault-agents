import { FileSystemAdapter } from "obsidian";
import type OpencodePlugin from "../../main";
import type { AgentProvider } from "../../core/provider";
import type {
  EngineType,
  RunHandle,
  SessionInfo,
  StreamCallbacks,
  UsageStats,
} from "../../core/types";
import { DEFAULT_SETTINGS } from "../../core/types";
import { BaseCliRunner } from "../base";
import type { OpencodeEvent } from "./types";

export class OpencodeRunner extends BaseCliRunner implements AgentProvider {
  readonly id: EngineType = "opencode";
  readonly displayName = "OpenCode CLI";
  readonly engine: EngineType = "opencode";

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
    const query = `UPDATE session SET title=${this.sqlString(title)} WHERE id=${this.sqlString(sessionId)}`;
    await this.runDbQuery(query);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const bin = this.resolveBinaryPath(this.plugin.settings.binaryPath || "opencode");
    await this.execCli(bin, ["session", "delete", sessionId]);
  }

  async getModelContextLimit(model: string): Promise<number> {
    const cached = this.contextLimitCache.get(model);
    if (cached !== undefined) return cached;
    const slash = model.indexOf("/");
    const provider = slash >= 0 ? model.slice(0, slash) : model;
    const bin = this.resolveBinaryPath(this.plugin.settings.binaryPath || "opencode");
    try {
      const out = await this.execCli(bin, ["models", provider, "--verbose"]);
      const limit = this.parseContextLimit(out, model);
      if (limit > 0) this.contextLimitCache.set(model, limit);
      return limit;
    } catch {
      return 128_000;
    }
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
            // Try next model
          }
        }
        i = j;
      } else {
        i++;
      }
    }
    return 0;
  }

  async getSessionTokens(sessionId: string): Promise<{ input: number; output: number }> {
    const query = `SELECT COALESCE(tokens_input,0) AS ti, COALESCE(tokens_output,0) AS tout FROM session WHERE id=${this.sqlString(sessionId)}`;
    const rows = (await this.runDbQuery(query)) as { ti?: number; tout?: number }[];
    const r = rows[0] ?? {};
    return { input: Number(r.ti ?? 0), output: Number(r.tout ?? 0) };
  }

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
      // Best effort
    }
  }

  async getUsageStats(): Promise<UsageStats> {
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
    const rows = (await this.runDbQuery(query)) as Record<string, unknown>[];
    const r = (rows[0] ?? {}) as Record<string, unknown>;
    const num = (v: unknown): number => Number(v ?? 0);
    return {
      h5: { input: num(r.h5_input), output: num(r.h5_output), cost: num(r.h5_cost) },
      week: { input: num(r.w_input), output: num(r.w_output), cost: num(r.w_cost) },
      month: { input: num(r.m_input), output: num(r.m_output), cost: num(r.m_cost) },
    };
  }

  async runDbQuery(query: string): Promise<unknown[]> {
    const bin = this.resolveBinaryPath(this.plugin.settings.binaryPath || "opencode");
    try {
      const out = await this.execCli(bin, ["db", query, "--format", "json"]);
      const arr = JSON.parse(out);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  runStream(prompt: string, fileAttachments: string[], cb: StreamCallbacks): RunHandle {
    const s = this.plugin.settings;
    const args = ["run", "--format", "json"];
    if (s.sessionId) args.push("--session", s.sessionId);
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

  private sqlString(value: string): string {
    return "'" + value.replace(/'/g, "''") + "'";
  }
}
