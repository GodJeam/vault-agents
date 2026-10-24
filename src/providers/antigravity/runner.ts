import { existsSync, readFileSync, statSync } from "fs";
import { basename, isAbsolute, join } from "path";
import { homedir } from "os";
import type { AgentProvider, ProviderDescriptor, RunnerHost } from "../../core/provider";
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
} from "../../core/types";
import { substitute } from "../../i18n";
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
    const streamState = { accumulatedText: "", emittedQuestionSteps: new Set<string>() };

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
    streamState: { accumulatedText: string; emittedQuestionSteps?: Set<string> } = {
      accumulatedText: "",
    }
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
      cb.onActivity?.(this.plugin.t("Analyzing and planning..."));
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

      if (stepType === "user_input") {
        cb.onActivity?.(this.plugin.t("Analyzing and planning..."));
      }

      // Accumulate incremental text chunks (delta)
      if (typeof su.text_delta === "string" && su.text_delta) {
        streamState.accumulatedText += su.text_delta;
        cb.onActivity?.(this.plugin.t("Writing response..."));
        cb.onText(streamState.accumulatedText, String(stepIndex ?? 0));
      }

      // Reasoning / thought block if present
      if (typeof su.thought === "string" && su.thought) {
        cb.onActivity?.(this.plugin.t("Thinking..."));
        cb.onReasoning(su.thought, String(stepIndex ?? 0));
      } else if (typeof su.reasoning === "string" && su.reasoning) {
        cb.onActivity?.(this.plugin.t("Thinking..."));
        cb.onReasoning(su.reasoning, String(stepIndex ?? 0));
      }

      // Tool execution: extract descriptive title from parameters for the UI
      if (stepType === "tool") {
        const toolName = String(su.tool_name || su.tool_info?.name || "tool");
        const isDone = su.state === "DONE";
        const isError = su.status === "ERROR" || Boolean(su.error);
        const params = su.tool_info?.parameters;
        const durationMs =
          typeof su.duration_seconds === "number" && su.duration_seconds > 0
            ? Math.round(su.duration_seconds * 1000)
            : undefined;

        // Intercept ask_question tool calls so the user can answer interactively in the chat UI
        if (toolName === "ask_question" || toolName === "question") {
          const questions = this.parseAntigravityQuestions(params);
          const qSummary =
            questions[0]?.question || this.plugin.t("Agent question");
          const stepKey = String(stepIndex ?? qSummary);
          if (!streamState.emittedQuestionSteps) {
            streamState.emittedQuestionSteps = new Set<string>();
          }
          if (questions.length > 0 && !streamState.emittedQuestionSteps.has(stepKey)) {
            streamState.emittedQuestionSteps.add(stepKey);
            cb.onQuestion?.(questions);
          }
          cb.onActivity?.(this.plugin.t("Waiting for your answer..."));
          cb.onStep({
            id: `step-${stepIndex ?? Date.now()}-${toolName}`,
            tool: toolName,
            title: qSummary,
            state: "completed",
            input: params,
            output: su.tool_info?.output,
            durationMs,
          });
          return;
        }

        const title = this.extractAntigravityToolTitle(toolName, params);
        if (!isDone) {
          cb.onActivity?.(substitute(this.plugin.t("Running: $1"), title));
        } else {
          cb.onActivity?.(this.plugin.t("Analyzing and planning..."));
        }

        cb.onStep({
          id: `step-${stepIndex ?? Date.now()}-${toolName}`,
          tool: toolName,
          title,
          state: isDone ? (isError ? "error" : "completed") : "running",
          input: params,
          output: su.tool_info?.output,
          durationMs,
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
      const inputTokens = u.input_tokens ?? 0;
      const outputTokens = u.output_tokens ?? 0;
      const reasoningTokens = u.thinking_tokens ?? 0;
      const totalTokens =
        u.total_tokens && u.total_tokens > 0
          ? u.total_tokens
          : inputTokens + outputTokens + reasoningTokens;
      cb.onFinish({
        tokens: {
          total: totalTokens,
          input: inputTokens,
          output: outputTokens,
          reasoning: reasoningTokens,
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

  private extractAntigravityToolTitle(
    toolName: string,
    params: Record<string, unknown> | undefined
  ): string {
    if (params && typeof params === "object") {
      if (typeof params.toolSummary === "string" && params.toolSummary.trim()) {
        return params.toolSummary.trim();
      }
      if (typeof params.TargetFile === "string" && params.TargetFile.trim()) {
        return basename(params.TargetFile.trim());
      }
      if (typeof params.AbsolutePath === "string" && params.AbsolutePath.trim()) {
        return basename(params.AbsolutePath.trim());
      }
      if (typeof params.Path === "string" && params.Path.trim()) {
        return basename(params.Path.trim());
      }
      if (typeof params.DirectoryPath === "string" && params.DirectoryPath.trim()) {
        return basename(params.DirectoryPath.trim()) || params.DirectoryPath.trim();
      }
      if (typeof params.SearchDirectory === "string" && params.SearchDirectory.trim()) {
        const q = typeof params.Query === "string" ? params.Query.trim() : "";
        return q ? `"${q}" in ${basename(params.SearchDirectory.trim())}` : basename(params.SearchDirectory.trim());
      }
      if (typeof params.Query === "string" && params.Query.trim()) {
        return `"${params.Query.trim()}"`;
      }
      if (typeof params.query === "string" && params.query.trim()) {
        return params.query.trim();
      }
      if (typeof params.Pattern === "string" && params.Pattern.trim()) {
        return params.Pattern.trim();
      }
      if (typeof params.CommandLine === "string" && params.CommandLine.trim()) {
        return params.CommandLine.trim();
      }
      if (typeof params.Role === "string" && params.Role.trim()) {
        return params.Role.trim();
      }
      if (typeof params.toolAction === "string" && params.toolAction.trim()) {
        return params.toolAction.trim();
      }
    }
    return toolName;
  }

  private parseAntigravityQuestions(
    params: Record<string, unknown> | undefined
  ): AgentQuestion[] {
    if (!params || typeof params !== "object") return [];
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
      const question = typeof qObj.question === "string" ? qObj.question.trim() : "";
      if (!question) continue;
      const header = typeof qObj.header === "string" ? qObj.header.trim() : undefined;
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

  private execSqlite(dbPath: string, query: string): Promise<string> {
    return this.execCli("sqlite3", [dbPath, query]);
  }

  private getDbPath(): string {
    return join(homedir(), ".gemini", "antigravity-cli", "conversation_summaries.db");
  }
}
