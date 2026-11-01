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
import type { HermesStreamEvent } from "./types";

export const HERMES_DESCRIPTOR: ProviderDescriptor = {
  id: "hermes",
  displayName: "Hermes Agent CLI (Nous Research)",
  shortName: "Hermes",
  icon: "zap",
  defaultBinary: "hermes",
  defaultModel: "",
  binaryDesc:
    "Command or full path to the hermes executable. Default is 'hermes' " +
    "or '~/.hermes/bin/hermes'.",
  modelDesc:
    "Leave on default to use your ~/.hermes/config.yaml model, or enter " +
    "a provider/model ID.",
  included: false,
  supportsSessions: "local-db",
  supportsUsageStats: true,
  supportsDbCleanup: false,
  options: [
    {
      key: "provider",
      label: "Provider",
      desc: "Optional Hermes backend provider (e.g. openrouter, nous, anthropic).",
      type: "text",
      placeholder: "e.g. openrouter",
      default: "",
    },
    {
      key: "reasoning",
      label: "Reasoning effort",
      desc: "Optional reasoning effort level for Hermes.",
      type: "select",
      choices: [
        { value: "", label: "Default (from config.yaml)" },
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
      ],
      default: "",
    },
  ],
};

export interface HermesStreamState {
  accumulatedText: string;
  activeToolSteps: Map<
    string,
    { id: string; tool: string; title: string; input: unknown }
  >;
}

export class HermesRunner extends BaseCliRunner implements AgentProvider {
  readonly descriptor = HERMES_DESCRIPTOR;
  readonly id: EngineType = "hermes";
  readonly displayName = "Hermes Agent CLI";
  readonly engine: EngineType = "hermes";
  readonly included = false;

  private cachedModels: string[] | null = null;
  private cachedModelsBin: string | null = null;

  constructor(plugin: RunnerHost) {
    super(plugin);
  }

  private getConfig() {
    return this.plugin.getEngineConfig("hermes");
  }

  private getBin(): string {
    return this.resolveBinaryPath(this.getConfig().binary || "hermes");
  }

  async getVersion(): Promise<string> {
    const out = await this.execCli(this.getBin(), ["--version"]);
    const first = out.trim().split("\n")[0];
    if (!first) throw new Error("Empty output from hermes --version");
    return first;
  }

  async listModels(forceRefresh = false): Promise<string[]> {
    const bin = this.getBin();
    if (
      !forceRefresh &&
      this.cachedModels &&
      this.cachedModels.length > 0 &&
      this.cachedModelsBin === bin
    ) {
      return this.cachedModels;
    }
    const seen = new Set<string>();
    const addModel = (m: string) => {
      const clean = m.trim();
      if (clean && !seen.has(clean)) {
        seen.add(clean);
      }
    };

    try {
      const cfgPath = join(homedir(), ".hermes", "config.yaml");
      if (existsSync(cfgPath)) {
        const raw = readFileSync(cfgPath, "utf-8");
        const modelSection = raw.match(
          /^model:\s*\n((?:[ \t]+.*|\s*)\n)*/m
        );
        if (modelSection) {
          const defMatch = modelSection[0].match(
            /^\s+(?:default|model)\s*:\s*["']?([^\s"'#]+)/m
          );
          if (defMatch && defMatch[1]) {
            addModel(defMatch[1]);
          }
        }
        const topMatch = raw.match(
          /^\s*(?:default_)?model\s*:\s*["']?([^\s"'#:]+)["']?\s*$/m
        );
        if (topMatch && topMatch[1]) {
          addModel(topMatch[1]);
        }
      }
    } catch {
      // ignore
    }

    try {
      const catalogPath = join(
        homedir(),
        ".hermes",
        "cache",
        "model_catalog.json"
      );
      if (existsSync(catalogPath)) {
        const parsed = JSON.parse(readFileSync(catalogPath, "utf-8")) as {
          providers?: Record<
            string,
            { models?: Array<{ id?: string }> }
          >;
        };
        const providers = parsed.providers || {};
        for (const prov of Object.values(providers)) {
          for (const item of prov.models || []) {
            if (typeof item.id === "string") {
              addModel(item.id);
            }
          }
        }
      }
    } catch {
      // ignore
    }

    if (seen.size === 0) {
      try {
        const out = await this.execCli(bin, ["models"]);
        for (const line of out.split("\n")) {
          addModel(line);
        }
      } catch {
        // ignore
      }
    }

    this.cachedModels = Array.from(seen);
    this.cachedModelsBin = bin;
    return this.cachedModels;
  }

  async listSessions(): Promise<SessionInfo[]> {
    return this.listHistorySessions("hermes");
  }

  async renameSession(sessionId: string, title: string): Promise<void> {
    if (!sessionId || !title.trim()) return;
    try {
      await this.execCli(this.getBin(), [
        "sessions",
        "rename",
        sessionId,
        title.trim(),
      ]);
    } catch {
      // ignore if session exists only in local plugin history
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!sessionId) return;
    try {
      await this.execCli(this.getBin(), [
        "sessions",
        "delete",
        sessionId,
        "--yes",
      ]);
    } catch {
      // ignore if session exists only in local plugin history
    }
  }

  async getModelContextLimit(model: string): Promise<number> {
    return this.estimateModelContextLimit(model, 128_000);
  }

  async getSessionTokens(
    sessionId: string
  ): Promise<{ input: number; output: number }> {
    return this.getHistorySessionTokens(sessionId);
  }

  async getUsageStats(): Promise<UsageStats> {
    return this.computeHistoryUsageStats("hermes");
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

    const args = ["chat", "-q", finalPrompt, "--format", "stream-json"];

    const sid = req.sessionId !== undefined ? req.sessionId : s.sessionId;
    if (sid) {
      args.push("--resume", sid);
      return args;
    }

    if (s.autoApprove) {
      args.push("--yolo");
    }

    const model = cfg.model.trim();
    if (model) {
      args.push("--model", model);
    }

    const provider = cfg.options.provider?.trim();
    if (provider) {
      args.push("--provider", provider);
    }

    const reasoning = cfg.options.reasoning?.trim();
    if (reasoning) {
      args.push("--reasoning", reasoning);
    }

    return args;
  }

  private createStreamState(): HermesStreamState {
    return {
      accumulatedText: "",
      activeToolSteps: new Map(),
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
    state: HermesStreamState = this.createStreamState()
  ): void {
    if (line.length > MAX_STREAM_LINE_BYTES) {
      cb.onRaw?.(`[omitted event of ${line.length} bytes]\n`);
      return;
    }
    let ev: HermesStreamEvent;
    try {
      ev = JSON.parse(line);
    } catch {
      cb.onRaw?.(line + "\n");
      return;
    }

    if (typeof ev.session_id === "string" && ev.session_id) {
      cb.onSession(ev.session_id);
    }

    if (ev.type === "system") {
      cb.onActivity?.(this.plugin.t("Analyzing and planning..."));
      return;
    }

    if (ev.type === "text" && typeof (ev.text ?? ev.content) === "string") {
      state.accumulatedText += String(ev.text ?? ev.content);
      cb.onActivity?.(this.plugin.t("Writing response..."));
      cb.onText(state.accumulatedText, "text");
      return;
    }

    if (
      (ev.type === "reasoning" || ev.type === "thought") &&
      typeof (ev.text ?? ev.reasoning) === "string"
    ) {
      const thought = String(ev.text ?? ev.reasoning);
      cb.onActivity?.(this.plugin.t("Thinking..."));
      cb.onReasoning(thought, "reasoning");
      return;
    }

    if (ev.type === "tool_use") {
      const toolName = String(ev.name || ev.tool || "tool");
      const key = String(ev.tool_call_id || ev.call_id || ev.id || toolName);
      const stepId = `step-${ev.timestamp ?? Date.now()}-${key}`;
      const input = ev.input ?? ev.arguments;

      if (
        toolName === "ask_question" ||
        toolName === "question" ||
        toolName === "clarify"
      ) {
        const questions = this.parseCommonQuestions(input);
        const qTitle =
          questions[0]?.question || this.plugin.t("Agent question");
        if (questions.length > 0) {
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
        return;
      }

      const title = this.extractCommonToolTitle(toolName, input);
      state.activeToolSteps.set(key, { id: stepId, tool: toolName, title, input });
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

    if (ev.type === "tool_result") {
      const toolName = String(ev.name || ev.tool || "tool");
      const key = String(ev.tool_call_id || ev.call_id || ev.id || toolName);
      const prev = state.activeToolSteps.get(key);
      if (prev) {
        state.activeToolSteps.delete(key);
      }
      const stepId = prev?.id || `step-${ev.timestamp ?? Date.now()}-${key}`;
      const title = prev?.title || toolName;
      const isErr = Boolean(ev.is_error);
      cb.onActivity?.(this.plugin.t("Analyzing and planning..."));
      cb.onStep({
        id: stepId,
        tool: prev?.tool || toolName,
        title,
        state: isErr ? "error" : "completed",
        input: prev?.input,
        output: ev.output,
        durationMs: ev.duration_ms,
      });
      return;
    }

    if (ev.type === "result") {
      if (ev.error) {
        const msg =
          typeof ev.error === "string"
            ? ev.error
            : ev.error?.message || JSON.stringify(ev.error);
        cb.onError(String(msg));
        return;
      }
      if (typeof ev.text === "string" && ev.text.trim()) {
        state.accumulatedText = ev.text;
        cb.onText(state.accumulatedText, "final");
      }
      const tk = ev.tokens ?? {};
      const input = Number(tk.input ?? 0);
      const output = Number(tk.output ?? 0);
      const reasoning = Number(tk.reasoning ?? 0);
      const rawTotal = Number(tk.total ?? 0);
      const total = rawTotal > 0 ? rawTotal : input + output + reasoning;
      const cacheRead = Number(tk.cache_read ?? 0);
      const cacheWrite = Number(tk.cache_write ?? 0);
      cb.onFinish({
        tokens: {
          total,
          input,
          output,
          reasoning,
          cache:
            cacheRead > 0 || cacheWrite > 0
              ? { read: cacheRead, write: cacheWrite }
              : undefined,
        },
        cost: typeof ev.cost === "number" ? ev.cost : undefined,
      });
      return;
    }

    if (ev.type === "error" || ev.error) {
      const msg =
        typeof ev.error === "string"
          ? ev.error
          : ev.error?.message || JSON.stringify(ev.error || ev);
      cb.onError(String(msg));
    }
  }
}
