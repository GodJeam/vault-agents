import { existsSync, readFileSync, statSync } from "fs";
import { basename, isAbsolute, join } from "path";
import { homedir } from "os";
import type { AgentProvider, ProviderDescriptor, RunnerHost } from "../../core/provider";
import type {
  EngineType,
  RunHandle,
  RunRequest,
  SessionInfo,
  StreamCallbacks,
  UsageStats,
  UsageWindow,
} from "../../core/types";
import { BaseCliRunner, MAX_STREAM_LINE_BYTES } from "../base";
import type { AntigravityEvent } from "./types";

// Legacy Antigravity conversation ids are UUID-style (they contain "-"), while
// opencode session ids use the "ses_..." form. Used to attribute untagged
// history entries that pre-date `sessionEngines`.
const ANTIGRAVITY_ID_HINT = /-/;

// Maximum size (in bytes) of a text attachment to inline directly into CLI args
// so we never hit OS ARG_MAX / E2BIG limits. Larger files are passed by path.
const MAX_INLINE_ATTACHMENT_BYTES = 256 * 1024;

export const ANTIGRAVITY_DESCRIPTOR: ProviderDescriptor = {
  id: "antigravity",
  displayName: "Antigravity CLI (Google AI Pro)",
  shortName: "Antigravity",
  defaultBinary: "agy",
  defaultModel: "gemini-3.8-flash-high",
  binaryDesc: "Command or full path to the agy executable. Default is 'agy' or '~/.local/bin/agy'.",
  modelDesc:
    "Pick a model from Antigravity (Gemini 3.8 Flash, Claude Opus/Sonnet 5.5). The effort is part of the model name. Included with Google AI Pro.",
  included: true,
  costNote: "Google AI Pro",
  supportsSessions: "local-db",
  supportsUsageStats: true,
  supportsDbCleanup: false,
  options: [
    {
      key: "effort",
      label: "Reasoning effort",
      desc: "Effort sent only for models whose name does not already include it. Antigravity model names usually end with -low/-medium/-high.",
      type: "select",
      default: "high",
      choices: [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
        { value: "xhigh", label: "Extra high" },
        { value: "max", label: "Max" },
      ],
    },
  ],
};

export class AntigravityRunner extends BaseCliRunner implements AgentProvider {
  readonly descriptor = ANTIGRAVITY_DESCRIPTOR;
  readonly id: EngineType = "antigravity";
  readonly displayName = "Antigravity CLI";
  readonly engine: EngineType = "antigravity";
  readonly included = true;
  readonly costNote = "Google AI Pro";

  private cachedModels: string[] | null = null;

  constructor(plugin: RunnerHost) {
    super(plugin);
  }

  private getConfig() {
    return this.plugin.getEngineConfig("antigravity");
  }

  async getVersion(): Promise<string> {
    const bin = this.resolveBinaryPath(this.getConfig().binary || "agy");
    const out = await this.execCli(bin, ["--version"]);
    const first = out.trim().split("\n")[0];
    if (!first) throw new Error("Empty output from agy --version");
    return first;
  }

  async listModels(forceRefresh = false): Promise<string[]> {
    if (!forceRefresh && this.cachedModels && this.cachedModels.length > 0) {
      return this.cachedModels;
    }
    const bin = this.resolveBinaryPath(this.getConfig().binary || "agy");
    try {
      const out = await this.execCli(bin, ["models"]);
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
      "claude-opus-5-5-high",
      "claude-opus-5-5-medium",
      "claude-opus-5-5-low",
      "claude-sonnet-5-5-high",
      "claude-sonnet-5-5-medium",
      "claude-sonnet-5-5-low",
      "gpt-oss-120b-medium",
    ];
    this.cachedModels = defaults;
    return defaults;
  }

  async listSessions(): Promise<SessionInfo[]> {
    const sessions: SessionInfo[] = [];
    const seenIds = new Set<string>();

    // 1. Try querying conversation_summaries.db via sqlite3 -json
    const dbPath = this.getDbPath();
    if (existsSync(dbPath)) {
      try {
        const query =
          "SELECT conversation_id AS id, title, CAST(strftime('%s', last_modified_time) AS INTEGER) AS sec FROM conversation_summaries ORDER BY last_modified_time DESC LIMIT 50";
        const out = await this.execCli("sqlite3", ["-json", dbPath, query]);
        const rows = JSON.parse(out.trim() || "[]") as Array<{
          id?: string;
          title?: string;
          sec?: number;
        }>;
        for (const row of rows) {
          const id = row.id?.trim();
          if (!id) continue;
          const title = row.title?.trim() || id;
          const sec = Number(row.sec);
          const updated = Number.isFinite(sec) && sec > 0 ? sec * 1000 : Date.now();
          sessions.push({
            id,
            title,
            updated,
            engine: "antigravity",
          });
          seenIds.add(id);
        }
      } catch {
        // Fallback if sqlite3 is missing or older than 3.33 (no -json flag)
        try {
          const query =
            "SELECT conversation_id, replace(replace(title, char(10), ' '), '|', ' '), strftime('%s', last_modified_time) FROM conversation_summaries ORDER BY last_modified_time DESC LIMIT 50";
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
        } catch {
          // Fall through to history
        }
      }
    }

    // 2. Add any Antigravity sessions saved in Obsidian histories
    const histories = this.plugin.histories ?? {};
    const sessionEngines = this.plugin.settings.sessionEngines ?? {};
    for (const [id, msgs] of Object.entries(histories)) {
      if (seenIds.has(id)) continue;
      if (sessionEngines[id] === "antigravity" || (!sessionEngines[id] && ANTIGRAVITY_ID_HINT.test(id))) {
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
    if (m.includes("claude")) return 200_000; // 200K tokens
    return 128_000;
  }

  async getSessionTokens(sessionId: string): Promise<{ input: number; output: number }> {
    const history = this.plugin.getHistory(sessionId);
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg.role === "assistant" && msg.tokens) {
        return { input: msg.tokens.input ?? 0, output: msg.tokens.output ?? 0 };
      }
    }
    return { input: 0, output: 0 };
  }

  async getUsageStats(): Promise<UsageStats> {
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
      const isAgy =
        sessionEngines[id] === "antigravity" ||
        (!sessionEngines[id] && ANTIGRAVITY_ID_HINT.test(id));
      if (!isAgy) continue;

      for (const msg of msgs) {
        if (msg.role === "assistant" && msg.tokens) {
          const inp = msg.tokens.input ?? 0;
          const out = msg.tokens.output ?? 0;
          const ts = msg.timestamp;
          if (!ts || ts >= monthCutoff) {
            month.input += inp;
            month.output += out;
          }
          if (!ts || ts >= weekCutoff) {
            week.input += inp;
            week.output += out;
          }
          if (!ts || ts >= h5Cutoff) {
            h5.input += inp;
            h5.output += out;
          }
        }
      }
    }
    return { h5, week, month };
  }

  /**
   * Build CLI arguments for an Antigravity invocation (exposed for testing)
   */
  public buildArgs(req: RunRequest): string[] {
    const s = this.plugin.settings;
    const cfg = this.getConfig();
    const cwd = req.cwd ?? this.getVaultPath() ?? undefined;

    let finalPrompt = req.prompt;

    const BINARY_EXT_REGEX =
      /\.(png|jpe?g|gif|webp|bmp|svg|ico|pdf|zip|tar|gz|7z|rar|bin|exe|dmg|iso|mp3|wav|ogg|mp4|mov|avi|mkv|wasm)$/i;
    const maxInlineBytes = Math.min(
      MAX_INLINE_ATTACHMENT_BYTES,
      Math.max(1, s.maxAttachMB || 20) * 1024 * 1024
    );

    for (const p of req.fileAttachments) {
      const fullPath = !isAbsolute(p) && cwd ? join(cwd, p) : p;
      if (BINARY_EXT_REGEX.test(fullPath)) {
        finalPrompt = `[ATTACHMENT PATH: ${fullPath}]\n\n---\n\n` + finalPrompt;
      } else {
        try {
          const st = statSync(fullPath);
          if (st.size > maxInlineBytes) {
            finalPrompt = `[ATTACHMENT PATH: ${fullPath}]\n\n---\n\n` + finalPrompt;
          } else {
            const content = readFileSync(fullPath, "utf-8");
            const filename = basename(fullPath);
            finalPrompt = `[ATTACHMENT: ${filename}]\n${content}\n\n---\n\n` + finalPrompt;
          }
        } catch {
          finalPrompt = `[ATTACHMENT PATH: ${fullPath}]\n\n---\n\n` + finalPrompt;
        }
      }
    }

    const args = ["-p", finalPrompt, "--output-format", "stream-json"];

    if (s.autoApprove) {
      args.push("--dangerously-skip-permissions");
    }

    const sid = req.sessionId !== undefined ? req.sessionId : s.sessionId;
    if (sid && !sid.startsWith("ses_")) {
      args.push("--conversation", sid);
    }

    const model = cfg.model || s.antigravityModel || ANTIGRAVITY_DESCRIPTOR.defaultModel;
    if (model) {
      args.push("--model", model);
    }

    // Antigravity model ids already encode the reasoning effort (e.g.
    // "gemini-3.8-flash-low"); passing --effort as well makes the CLI reject the
    // combination. Only send --effort for models without an effort suffix.
    const effort = cfg.options.effort || s.antigravityEffort;
    const modelEncodesEffort = /-(low|medium|high|xhigh|max)$/i.test(model || "");
    if (!modelEncodesEffort && effort) {
      args.push("--effort", effort);
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
    const bin = this.resolveBinaryPath(this.getConfig().binary || "agy");
    const streamState = { accumulatedText: "" };

    return this.spawnJsonlStream(
      bin,
      args,
      cwd,
      (line) => this.handleLine(line, cb, streamState),
      cb
    );
  }

  public handleLine(
    line: string,
    cb: StreamCallbacks,
    streamState: { accumulatedText: string } = { accumulatedText: "" }
  ): void {
    if (line.length > MAX_STREAM_LINE_BYTES) {
      cb.onRaw?.(`[omitted event of ${line.length} bytes]\n`);
      return;
    }
    let ev: AntigravityEvent;
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

  private execSqlite(dbPath: string, query: string): Promise<string> {
    return this.execCli("sqlite3", [dbPath, query]);
  }

  private getDbPath(): string {
    return join(homedir(), ".gemini", "antigravity-cli", "conversation_summaries.db");
  }
}
