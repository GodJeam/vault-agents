import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { basename, join } from "path";
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
import type { CodexItem, CodexStreamEvent } from "./types";

export const CODEX_DESCRIPTOR: ProviderDescriptor = {
  id: "codex",
  displayName: "OpenAI Codex CLI",
  shortName: "Codex",
  defaultBinary: "codex",
  defaultModel: "",
  binaryDesc:
    "Command or full path to the codex executable. Usually 'codex' " +
    "is enough if it is on your PATH.",
  modelDesc:
    "Leave on default to use your ~/.codex/config.toml model, or enter " +
    "an OpenAI model ID.",
  included: false,
  supportsSessions: "local-db",
  supportsUsageStats: true,
  supportsDbCleanup: false,
  options: [
    {
      key: "sandbox",
      label: "Sandbox mode",
      desc: "Filesystem sandbox policy when auto-approve is disabled.",
      type: "select",
      default: "workspace-write",
      choices: [
        { value: "read-only", label: "Read-only" },
        { value: "workspace-write", label: "Workspace write" },
        { value: "danger-full-access", label: "Full access" },
      ],
    },
  ],
};

export interface CodexStreamState {
  accumulatedText: string;
}

export class CodexRunner extends BaseCliRunner implements AgentProvider {
  readonly descriptor = CODEX_DESCRIPTOR;
  readonly id: EngineType = "codex";
  readonly displayName = "OpenAI Codex CLI";
  readonly engine: EngineType = "codex";
  readonly included = false;

  private cachedModels: string[] | null = null;

  constructor(plugin: RunnerHost) {
    super(plugin);
  }

  private getConfig() {
    return this.plugin.getEngineConfig("codex");
  }

  private getBin(): string {
    return this.resolveBinaryPath(this.getConfig().binary || "codex");
  }

  async getVersion(): Promise<string> {
    const out = await this.execCli(this.getBin(), ["--version"]);
    const first = out.trim().split("\n")[0];
    if (!first) throw new Error("Empty output from codex --version");
    return first;
  }

  async listModels(forceRefresh = false): Promise<string[]> {
    if (!forceRefresh && this.cachedModels && this.cachedModels.length > 0) {
      return this.cachedModels;
    }
    const models: string[] = [];
    try {
      const cfgPath = join(homedir(), ".codex", "config.toml");
      if (existsSync(cfgPath)) {
        const raw = readFileSync(cfgPath, "utf-8");
        const m = raw.match(/^\s*model\s*=\s*["']([^"']+)["']/m);
        if (m && m[1].trim()) {
          models.push(m[1].trim());
        }
      }
    } catch {
      // ignore
    }
    for (const def of ["o3", "o4-mini"]) {
      if (!models.includes(def)) models.push(def);
    }
    this.cachedModels = models;
    return models;
  }

  async listSessions(): Promise<SessionInfo[]> {
    return this.listHistorySessions("codex");
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
    return this.computeHistoryUsageStats("codex");
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

    const args = ["exec", "--json", "--skip-git-repo-check"];

    const model = cfg.model.trim();
    if (model) {
      args.push("--model", model);
    }

    if (s.autoApprove) {
      args.push("--full-auto");
    } else {
      const sandbox = cfg.options.sandbox || "workspace-write";
      args.push("--sandbox", sandbox);
    }

    const sid = req.sessionId !== undefined ? req.sessionId : s.sessionId;
    if (sid) {
      args.push("resume", sid, finalPrompt);
    } else {
      args.push(finalPrompt);
    }

    return args;
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
    const state: CodexStreamState = { accumulatedText: "" };

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
    state: CodexStreamState = { accumulatedText: "" }
  ): void {
    if (line.length > MAX_STREAM_LINE_BYTES) {
      cb.onRaw?.(`[omitted event of ${line.length} bytes]\n`);
      return;
    }
    let ev: CodexStreamEvent;
    try {
      ev = JSON.parse(line);
    } catch {
      cb.onRaw?.(line + "\n");
      return;
    }

    // 1. Thread initialization
    if (ev.type === "thread.started") {
      if (typeof ev.thread_id === "string" && ev.thread_id) {
        cb.onSession(ev.thread_id);
      }
      cb.onActivity?.(this.plugin.t("Analyzing and planning..."));
      return;
    }

    if (ev.type === "turn.started") {
      cb.onActivity?.(this.plugin.t("Analyzing and planning..."));
      return;
    }

    // 2. Item lifecycle events
    if (
      (ev.type === "item.started" ||
        ev.type === "item.updated" ||
        ev.type === "item.completed" ||
        ev.type === "item.failed") &&
      ev.item
    ) {
      this.handleItemEvent(ev.type, ev.item, cb, state);
      return;
    }

    // 3. Turn completion with token usage
    if (ev.type === "turn.completed") {
      const u = ev.usage ?? {};
      const input = Number(u.input_tokens ?? 0);
      const cached = Number(u.cached_input_tokens ?? 0);
      const output = Number(u.output_tokens ?? 0);
      const reasoning = Number(u.reasoning_tokens ?? 0);
      cb.onFinish({
        tokens: {
          total: input + output + reasoning,
          input,
          output,
          reasoning,
          cache: cached > 0 ? { read: cached, write: 0 } : undefined,
        },
      });
      return;
    }

    // 4. Error events
    if (ev.type === "turn.failed" || ev.type === "error" || ev.error) {
      const msg =
        typeof ev.error === "string"
          ? ev.error
          : ev.error?.message || ev.message || JSON.stringify(ev.error || ev);
      cb.onError(String(msg));
    }
  }

  private handleItemEvent(
    eventType: string,
    item: CodexItem,
    cb: StreamCallbacks,
    state: CodexStreamState
  ): void {
    const itemId = String(item.id || `item-${Date.now()}`);
    const isCompleted = eventType === "item.completed";
    const isFailed =
      eventType === "item.failed" ||
      item.status === "failed" ||
      (typeof item.exit_code === "number" && item.exit_code !== 0);

    if (item.type === "reasoning") {
      if (typeof item.text === "string" && item.text) {
        cb.onActivity?.(this.plugin.t("Thinking..."));
        cb.onReasoning(item.text, itemId);
      }
      return;
    }

    if (item.type === "agent_message") {
      if (typeof item.text === "string" && item.text) {
        state.accumulatedText = item.text;
        cb.onActivity?.(this.plugin.t("Writing response..."));
        cb.onText(state.accumulatedText, itemId);
      }
      return;
    }

    if (item.type === "command_execution") {
      const title = item.command?.trim() || "bash";
      if (!isCompleted && !isFailed) {
        cb.onActivity?.(substitute(this.plugin.t("Running: $1"), title));
      } else {
        cb.onActivity?.(this.plugin.t("Analyzing and planning..."));
      }
      cb.onStep({
        id: itemId,
        tool: "bash",
        title,
        state: isFailed ? "error" : isCompleted ? "completed" : "running",
        input: item.command ? { command: item.command } : undefined,
        output: item.aggregated_output,
      });
      return;
    }

    if (item.type === "file_change") {
      const firstPath = item.changes?.[0]?.path || "";
      const title = firstPath ? basename(firstPath) : "file";
      cb.onStep({
        id: itemId,
        tool: "edit_file",
        title,
        state: isFailed ? "error" : isCompleted ? "completed" : "running",
        input: item.changes,
      });
      return;
    }

    if (item.type === "web_search") {
      const title = item.query || "search_web";
      cb.onStep({
        id: itemId,
        tool: "search_web",
        title,
        state: isFailed ? "error" : isCompleted ? "completed" : "running",
        input: item.query ? { query: item.query } : undefined,
      });
      return;
    }

    if (item.type === "mcp_tool_call") {
      const toolName = item.tool || "tool";
      const title = this.extractCommonToolTitle(toolName, item.arguments);
      cb.onStep({
        id: itemId,
        tool: toolName,
        title,
        state: isFailed ? "error" : isCompleted ? "completed" : "running",
        input: item.arguments,
        output: item.result,
      });
    }
  }
}
