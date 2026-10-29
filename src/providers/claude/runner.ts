import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type {
  AgentProvider,
  ProviderDescriptor,
  RunnerHost,
} from "../../core/provider";
import type {
  EngineType,
  RunHandle,
  RunRequest,
  SessionInfo,
  StreamCallbacks,
  UsageStats,
} from "../../core/types";
import { substitute } from "../../i18n";
import { BaseCliRunner, MAX_STREAM_LINE_BYTES } from "../base";
import type { ClaudeStreamEvent } from "./types";

export const CLAUDE_DESCRIPTOR: ProviderDescriptor = {
  id: "claude",
  displayName: "Claude Code CLI",
  shortName: "Claude",
  defaultBinary: "claude",
  defaultModel: "",
  binaryDesc:
    "Command or full path to the claude executable. Usually 'claude' " +
    "is enough if it is on your PATH.",
  modelDesc:
    "Leave on default to use your Claude CLI config, or pick an alias " +
    "(sonnet, opus, haiku) / enter an exact model ID.",
  included: false,
  supportsSessions: "local-db",
  supportsUsageStats: true,
  supportsDbCleanup: false,
  options: [
    {
      key: "effort",
      label: "Reasoning effort",
      desc: "Reasoning effort level passed to Claude Code.",
      type: "select",
      default: "",
      choices: [
        { value: "", label: "(default)" },
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
      ],
    },
  ],
};

export interface ClaudeStreamState {
  accumulatedText: string;
  accumulatedReasoning: string;
  toolNames: Map<string, { name: string; title: string; input: unknown }>;
  emittedQuestions: Set<string>;
}

export class ClaudeRunner extends BaseCliRunner implements AgentProvider {
  readonly descriptor = CLAUDE_DESCRIPTOR;
  readonly id: EngineType = "claude";
  readonly displayName = "Claude Code CLI";
  readonly engine: EngineType = "claude";
  readonly included = false;

  private cachedModels: string[] | null = null;

  constructor(plugin: RunnerHost) {
    super(plugin);
  }

  private getConfig() {
    return this.plugin.getEngineConfig("claude");
  }

  private getBin(): string {
    return this.resolveBinaryPath(this.getConfig().binary || "claude");
  }

  async getVersion(): Promise<string> {
    const out = await this.execCli(this.getBin(), ["--version"]);
    const first = out.trim().split("\n")[0];
    if (!first) throw new Error("Empty output from claude --version");
    return first;
  }

  async listModels(forceRefresh = false): Promise<string[]> {
    if (!forceRefresh && this.cachedModels && this.cachedModels.length > 0) {
      return this.cachedModels;
    }
    const models = ["sonnet", "opus", "haiku", "opusplan"];
    try {
      const cfgPath = join(homedir(), ".claude", "settings.json");
      if (existsSync(cfgPath)) {
        const parsed = JSON.parse(readFileSync(cfgPath, "utf-8")) as {
          model?: string;
        };
        if (
          typeof parsed.model === "string" &&
          parsed.model.trim() &&
          !models.includes(parsed.model.trim())
        ) {
          models.unshift(parsed.model.trim());
        }
      }
    } catch {
      // ignore
    }
    this.cachedModels = models;
    return models;
  }

  async listSessions(): Promise<SessionInfo[]> {
    return this.listHistorySessions("claude");
  }

  async renameSession(_sessionId: string, _title: string): Promise<void> {
    // Session titles for history-backed sessions are managed by Obsidian
  }

  async deleteSession(_sessionId: string): Promise<void> {
    // Session history deletion is handled by the plugin host
  }

  async getModelContextLimit(model: string): Promise<number> {
    return this.estimateModelContextLimit(model, 200_000);
  }

  async getSessionTokens(
    sessionId: string
  ): Promise<{ input: number; output: number }> {
    return this.getHistorySessionTokens(sessionId);
  }

  async getUsageStats(): Promise<UsageStats> {
    return this.computeHistoryUsageStats("claude");
  }

  public buildArgs(req: RunRequest): string[] {
    const s = this.plugin.settings;
    const cfg = this.getConfig();
    const cwd = req.cwd ?? this.getVaultPath() ?? undefined;

    const finalPrompt = this.inlinePromptAttachments(
      req.prompt,
      req.fileAttachments,
      cwd
    );

    const args = [
      "-p",
      finalPrompt,
      "--output-format",
      "stream-json",
      "--verbose",
    ];

    if (s.autoApprove) {
      args.push("--dangerously-skip-permissions");
    }

    const sid = req.sessionId !== undefined ? req.sessionId : s.sessionId;
    if (sid) {
      args.push("--resume", sid);
    }

    const model = cfg.model.trim();
    if (model) {
      args.push("--model", model);
    }

    const effort = cfg.options.effort;
    if (effort) {
      args.push("--effort", effort);
    }

    return args;
  }

  private createStreamState(): ClaudeStreamState {
    return {
      accumulatedText: "",
      accumulatedReasoning: "",
      toolNames: new Map(),
      emittedQuestions: new Set(),
    };
  }

  runStream(
    reqOrPrompt: RunRequest | string,
    fileAttachmentsOrCb?: string[] | StreamCallbacks,
    maybeCb?: StreamCallbacks
  ): RunHandle {
    const { req, cb } = this.normalizeRunArgs(
      reqOrPrompt,
      fileAttachmentsOrCb,
      maybeCb
    );
    const cwd = req.cwd ?? this.getVaultPath() ?? undefined;
    const args = this.buildArgs({ ...req, cwd });
    const bin = this.getBin();
    const state = this.createStreamState();

    return this.spawnJsonlStream(
      bin,
      args,
      cwd,
      (line) => this.handleLine(line, cb, state),
      cb
    );
  }

  public handleLine(
    line: string,
    cb: StreamCallbacks,
    state: ClaudeStreamState = this.createStreamState()
  ): void {
    if (line.length > MAX_STREAM_LINE_BYTES) {
      cb.onRaw?.(`[omitted event of ${line.length} bytes]\n`);
      return;
    }
    let ev: ClaudeStreamEvent;
    try {
      ev = JSON.parse(line);
    } catch {
      cb.onRaw?.(line + "\n");
      return;
    }

    if (typeof ev.session_id === "string" && ev.session_id) {
      cb.onSession(ev.session_id);
    }

    // 1. System initialization
    if (ev.type === "system") {
      cb.onActivity?.(this.plugin.t("Analyzing and planning..."));
      return;
    }

    // 2. Incremental stream_event delta (--include-partial-messages)
    if (ev.type === "stream_event" && ev.event) {
      const delta = ev.event.delta;
      if (delta?.type === "text_delta" && typeof delta.text === "string") {
        state.accumulatedText += delta.text;
        cb.onActivity?.(this.plugin.t("Writing response..."));
        cb.onText(state.accumulatedText, String(ev.event.index ?? 0));
      } else if (
        delta?.type === "thinking_delta" &&
        typeof delta.thinking === "string"
      ) {
        state.accumulatedReasoning += delta.thinking;
        cb.onActivity?.(this.plugin.t("Thinking..."));
        cb.onReasoning(state.accumulatedReasoning, String(ev.event.index ?? 0));
      }
      return;
    }

    // 3. Assistant turn message (contains text, thinking, or tool_use blocks)
    if (ev.type === "assistant" && ev.message) {
      const blocks = Array.isArray(ev.message.content)
        ? ev.message.content
        : [];
      for (const block of blocks) {
        if (!block || typeof block !== "object") continue;
        if (block.type === "thinking" && typeof block.thinking === "string") {
          state.accumulatedReasoning = block.thinking;
          cb.onActivity?.(this.plugin.t("Thinking..."));
          cb.onReasoning(block.thinking, String(block.id ?? "thinking"));
        } else if (block.type === "text" && typeof block.text === "string") {
          state.accumulatedText = block.text;
          cb.onActivity?.(this.plugin.t("Writing response..."));
          cb.onText(block.text, String(block.id ?? "text"));
        } else if (block.type === "tool_use") {
          const toolName = String(block.name || "tool");
          const stepId = String(block.id || `step-${Date.now()}-${toolName}`);
          const input = block.input;

          if (
            toolName === "AskUserQuestion" ||
            toolName === "ask_question" ||
            toolName === "question"
          ) {
            const questions = this.parseCommonQuestions(input);
            const qTitle =
              questions[0]?.question || this.plugin.t("Agent question");
            if (questions.length > 0 && !state.emittedQuestions.has(stepId)) {
              state.emittedQuestions.add(stepId);
              cb.onQuestion?.(questions);
            }
            cb.onActivity?.(this.plugin.t("Waiting for your answer..."));
            cb.onStep({
              id: stepId,
              tool: toolName,
              title: qTitle,
              state: "completed",
              input,
            });
            continue;
          }

          const title = this.extractCommonToolTitle(toolName, input);
          state.toolNames.set(stepId, { name: toolName, title, input });
          cb.onActivity?.(substitute(this.plugin.t("Running: $1"), title));
          cb.onStep({
            id: stepId,
            tool: toolName,
            title,
            state: "running",
            input,
          });
        }
      }
      return;
    }

    // 4. User message carrying tool_result blocks
    if (ev.type === "user" && ev.message) {
      const blocks = Array.isArray(ev.message.content)
        ? ev.message.content
        : [];
      for (const block of blocks) {
        if (block?.type === "tool_result" && block.tool_use_id) {
          const stepId = String(block.tool_use_id);
          const meta = state.toolNames.get(stepId);
          const toolName = meta?.name || "tool";
          const title = meta?.title || toolName;
          const isErr = Boolean(block.is_error);
          cb.onActivity?.(this.plugin.t("Analyzing and planning..."));
          cb.onStep({
            id: stepId,
            tool: toolName,
            title,
            state: isErr ? "error" : "completed",
            input: meta?.input,
            output: block.content,
          });
        }
      }
      return;
    }

    // 5. Final result event
    if (ev.type === "result") {
      if (ev.is_error) {
        const errText =
          typeof ev.result === "string" && ev.result.trim()
            ? ev.result.trim()
            : this.plugin.t("Unknown error");
        cb.onError(errText);
        return;
      }
      if (typeof ev.result === "string" && ev.result.trim()) {
        state.accumulatedText = ev.result;
        cb.onText(state.accumulatedText, "final");
      }
      const u = ev.usage ?? {};
      const input = Number(u.input_tokens ?? 0);
      const output = Number(u.output_tokens ?? 0);
      const cacheRead = Number(u.cache_read_input_tokens ?? 0);
      const cacheWrite = Number(u.cache_creation_input_tokens ?? 0);
      const cost =
        typeof ev.total_cost_usd === "number"
          ? ev.total_cost_usd
          : typeof ev.cost_usd === "number"
            ? ev.cost_usd
            : undefined;
      cb.onFinish({
        tokens: {
          total: input + output,
          input,
          output,
          cache:
            cacheRead > 0 || cacheWrite > 0
              ? { read: cacheRead, write: cacheWrite }
              : undefined,
        },
        cost,
      });
      return;
    }

    // 6. Explicit error event
    if (ev.type === "error" || ev.error) {
      const msg =
        typeof ev.error === "string"
          ? ev.error
          : ev.error?.message || JSON.stringify(ev.error || ev);
      cb.onError(String(msg));
    }
  }
}
