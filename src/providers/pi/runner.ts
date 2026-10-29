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
import type { PiMessage, PiStreamEvent } from "./types";

export const PI_DESCRIPTOR: ProviderDescriptor = {
  id: "pi",
  displayName: "Pi Coding Agent CLI",
  shortName: "Pi",
  defaultBinary: "pi",
  defaultModel: "",
  binaryDesc:
    "Command or full path to the pi executable. Usually 'pi' " +
    "is enough if it is on your PATH.",
  modelDesc:
    "Leave on default to use your Pi config, or pick a model from " +
    "'pi --list-models'.",
  included: false,
  supportsSessions: "local-db",
  supportsUsageStats: true,
  supportsDbCleanup: false,
  options: [
    {
      key: "provider",
      label: "Provider",
      desc: "Optional model provider for Pi (e.g. anthropic, openai, google).",
      type: "text",
      placeholder: "e.g. anthropic",
      default: "",
    },
  ],
};

export interface PiStreamState {
  accumulatedText: string;
  accumulatedReasoning: string;
  toolTitles: Map<string, { tool: string; title: string; input: unknown }>;
}

export class PiRunner extends BaseCliRunner implements AgentProvider {
  readonly descriptor = PI_DESCRIPTOR;
  readonly id: EngineType = "pi";
  readonly displayName = "Pi Coding Agent CLI";
  readonly engine: EngineType = "pi";
  readonly included = false;

  private cachedModels: string[] | null = null;

  constructor(plugin: RunnerHost) {
    super(plugin);
  }

  private getConfig() {
    return this.plugin.getEngineConfig("pi");
  }

  private getBin(): string {
    return this.resolveBinaryPath(this.getConfig().binary || "pi");
  }

  async getVersion(): Promise<string> {
    const out = await this.execCli(this.getBin(), ["--version"]);
    const first = out.trim().split("\n")[0];
    if (!first) throw new Error("Empty output from pi --version");
    return first;
  }

  async listModels(forceRefresh = false): Promise<string[]> {
    if (!forceRefresh && this.cachedModels && this.cachedModels.length > 0) {
      return this.cachedModels;
    }
    try {
      const out = await this.execCli(this.getBin(), ["--list-models"]);
      const models: string[] = [];
      for (const line of out.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const firstToken = trimmed.split(/\s+/)[0];
        if (
          firstToken &&
          /^[a-zA-Z0-9_.:/+-]+$/.test(firstToken) &&
          firstToken.toLowerCase() !== "model" &&
          firstToken.toLowerCase() !== "provider" &&
          !models.includes(firstToken)
        ) {
          models.push(firstToken);
        }
      }
      if (models.length > 0) {
        this.cachedModels = models;
        return models;
      }
    } catch {
      // ignore if pi is not installed
    }
    return [];
  }

  async listSessions(): Promise<SessionInfo[]> {
    return this.listHistorySessions("pi");
  }

  async renameSession(_sessionId: string, _title: string): Promise<void> {}

  async deleteSession(_sessionId: string): Promise<void> {}

  async getModelContextLimit(model: string): Promise<number> {
    return this.estimateModelContextLimit(model, 200_000);
  }

  async getSessionTokens(
    sessionId: string
  ): Promise<{ input: number; output: number }> {
    return this.getHistorySessionTokens(sessionId);
  }

  async getUsageStats(): Promise<UsageStats> {
    return this.computeHistoryUsageStats("pi");
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

    const args = ["--print", "--mode", "json"];

    const sid = req.sessionId !== undefined ? req.sessionId : s.sessionId;
    if (sid) {
      args.push("--session", sid);
    }

    const model = cfg.model.trim();
    if (model) {
      args.push("--model", model);
    }

    const provider = cfg.options.provider;
    if (provider) {
      args.push("--provider", provider);
    }

    args.push(finalPrompt);
    return args;
  }

  private createStreamState(): PiStreamState {
    return {
      accumulatedText: "",
      accumulatedReasoning: "",
      toolTitles: new Map(),
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
    state: PiStreamState = this.createStreamState()
  ): void {
    if (line.length > MAX_STREAM_LINE_BYTES) {
      cb.onRaw?.(`[omitted event of ${line.length} bytes]\n`);
      return;
    }
    let ev: PiStreamEvent;
    try {
      ev = JSON.parse(line);
    } catch {
      cb.onRaw?.(line + "\n");
      return;
    }

    // 1. Session header
    if (ev.type === "session") {
      const sid = ev.id || ev.sessionId;
      if (typeof sid === "string" && sid) {
        cb.onSession(sid);
      }
      cb.onActivity?.(this.plugin.t("Analyzing and planning..."));
      return;
    }

    if (ev.type === "agent_start" || ev.type === "turn_start") {
      cb.onActivity?.(this.plugin.t("Analyzing and planning..."));
      return;
    }

    // 2. Incremental message_update
    if (ev.type === "message_update" && ev.assistantMessageEvent) {
      const ame = ev.assistantMessageEvent;
      if (ame.type === "text_delta" && typeof ame.delta === "string") {
        state.accumulatedText += ame.delta;
        cb.onActivity?.(this.plugin.t("Writing response..."));
        cb.onText(state.accumulatedText, String(ame.contentIndex ?? 0));
      } else if (
        ame.type === "thinking_delta" &&
        typeof ame.delta === "string"
      ) {
        state.accumulatedReasoning += ame.delta;
        cb.onActivity?.(this.plugin.t("Thinking..."));
        cb.onReasoning(
          state.accumulatedReasoning,
          String(ame.contentIndex ?? 0)
        );
      }
      return;
    }

    // 3. Tool execution lifecycle
    if (ev.type === "tool_execution_start") {
      const stepId = String(ev.toolCallId || `step-${Date.now()}`);
      const toolName = String(ev.toolName || "tool");
      const input = ev.args;
      const title = this.extractCommonToolTitle(toolName, input);
      state.toolTitles.set(stepId, { tool: toolName, title, input });
      cb.onActivity?.(substitute(this.plugin.t("Running: $1"), title));
      cb.onStep({
        id: stepId,
        tool: toolName,
        title,
        state: "running",
        input,
      });
      return;
    }

    if (ev.type === "tool_execution_end") {
      const stepId = String(ev.toolCallId || `step-${Date.now()}`);
      const prev = state.toolTitles.get(stepId);
      const toolName = prev?.tool || String(ev.toolName || "tool");
      const title = prev?.title || this.extractCommonToolTitle(toolName, ev.args);
      const isErr = Boolean(ev.isError);
      cb.onActivity?.(this.plugin.t("Analyzing and planning..."));
      cb.onStep({
        id: stepId,
        tool: toolName,
        title,
        state: isErr ? "error" : "completed",
        input: prev?.input ?? ev.args,
        output: ev.result,
      });
      return;
    }

    // 4. Message end / Agent end with final text and usage
    if (ev.type === "message_end" && ev.message) {
      this.extractPiMessageUsage(ev.message, cb, state);
      return;
    }

    if (ev.type === "agent_end" && Array.isArray(ev.messages)) {
      for (const msg of ev.messages) {
        if (msg?.role === "assistant") {
          this.extractPiMessageUsage(msg, cb, state);
        }
      }
      return;
    }

    // 5. Error event
    if (ev.type === "error" || ev.error) {
      const msg =
        typeof ev.error === "string"
          ? ev.error
          : ev.error?.message || JSON.stringify(ev.error || ev);
      cb.onError(String(msg));
    }
  }

  private extractPiMessageUsage(
    msg: PiMessage,
    cb: StreamCallbacks,
    state: PiStreamState
  ): void {
    if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block?.type === "text" && typeof block.text === "string" && block.text.trim()) {
          state.accumulatedText = block.text;
          cb.onText(state.accumulatedText, "final");
        } else if (
          block?.type === "thinking" &&
          typeof block.thinking === "string" &&
          block.thinking.trim()
        ) {
          state.accumulatedReasoning = block.thinking;
          cb.onReasoning(state.accumulatedReasoning, "final");
        }
      }
    }
    if (msg.usage) {
      const u = msg.usage;
      const input = Number(u.input ?? 0);
      const output = Number(u.output ?? 0);
      const cacheRead = Number(u.cacheRead ?? 0);
      const cacheWrite = Number(u.cacheWrite ?? 0);
      const total = Number(u.totalTokens ?? 0) || input + output;
      if (total > 0) {
        cb.onFinish({
          tokens: {
            total,
            input,
            output,
            cache:
              cacheRead > 0 || cacheWrite > 0
                ? { read: cacheRead, write: cacheWrite }
                : undefined,
          },
          cost: typeof u.cost?.total === "number" ? u.cost.total : undefined,
        });
      }
    }
  }
}
