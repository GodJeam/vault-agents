import { existsSync, readdirSync, readFileSync } from "fs";
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
  private contextLimits = new Map<string, number>();
  private contextLimitFailedAt = new Map<string, number>();
  private resolvedPythonCache = new Map<
    string,
    { pythonBin: string; repoRoot: string } | null
  >();

  constructor(plugin: RunnerHost) {
    super(plugin);
  }

  private getConfig() {
    return this.plugin.getEngineConfig("hermes");
  }

  private getBin(): string {
    return this.resolveBinaryPath(this.getConfig().binary || "hermes");
  }

  private getHermesHome(): string {
    return process.env.HERMES_HOME || join(homedir(), ".hermes");
  }

  /**
   * Resolve the Python interpreter and checkout root of the user's Hermes
   * installation so we can query Hermes' native model & context APIs directly
   * for ANY provider the user has configured (OpenRouter, Nous, Anthropic,
   * OpenAI, Copilot, OpenCode Go/Zen, Ollama, LM Studio, Bedrock, etc.).
   */
  private resolveHermesPython(): { pythonBin: string; repoRoot: string } | null {
    const hermesHome = this.getHermesHome();
    const bin = this.getBin();
    const cacheKey = `${hermesHome}:${bin}`;
    if (this.resolvedPythonCache.has(cacheKey)) {
      return this.resolvedPythonCache.get(cacheKey) ?? null;
    }

    const repoRoot = join(hermesHome, "hermes-agent");
    if (!existsSync(repoRoot)) {
      this.resolvedPythonCache.set(cacheKey, null);
      return null;
    }

    // 1. Inspect the launcher script (`~/.local/bin/hermes` or `~/.hermes/hermes-agent/.hermes/bin/hermes`)
    const launcherCandidates = [
      bin,
      join(repoRoot, ".hermes", "bin", "hermes"),
    ];
    for (const candidate of launcherCandidates) {
      try {
        if (!existsSync(candidate)) continue;
        const text = readFileSync(candidate, "utf-8");
        const execMatch = text.match(/exec\s+([^\s"']+\/python3?(?:\.\d+)?)\b/);
        if (execMatch && execMatch[1] && existsSync(execMatch[1])) {
          const found = { pythonBin: execMatch[1], repoRoot };
          this.resolvedPythonCache.set(cacheKey, found);
          return found;
        }
      } catch {
        // ignore
      }
    }

    // 2. Check `~/.hermes/tools/python-*/bin/python3`
    try {
      const toolsDir = join(hermesHome, "tools");
      if (existsSync(toolsDir)) {
        for (const entry of readdirSync(toolsDir)) {
          if (entry.startsWith("python")) {
            const py = join(
              toolsDir,
              entry,
              process.platform === "win32" ? "python.exe" : "bin/python3"
            );
            if (existsSync(py)) {
              const found = { pythonBin: py, repoRoot };
              this.resolvedPythonCache.set(cacheKey, found);
              return found;
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // 3. Check standard venv inside hermes-agent
    const venvPy = join(
      repoRoot,
      ".venv",
      process.platform === "win32" ? "Scripts/python.exe" : "bin/python"
    );
    if (existsSync(venvPy)) {
      const found = { pythonBin: venvPy, repoRoot };
      this.resolvedPythonCache.set(cacheKey, found);
      return found;
    }

    this.resolvedPythonCache.set(cacheKey, null);
    return null;
  }

  /**
   * Run a short Python introspection snippet inside the Hermes runtime.
   */
  private async execHermesPython(
    script: string,
    extraArgs: string[] = []
  ): Promise<string | null> {
    const runtime = this.resolveHermesPython();
    if (!runtime) return null;
    try {
      const bootstrap = [
        "import os, sys",
        "os.environ.pop('PYTHONHOME', None)",
        "os.environ.pop('PYTHONPATH', None)",
        `sys.path.insert(0, ${JSON.stringify(runtime.repoRoot)})`,
        "import hermes_bootstrap",
        script,
      ].join("\n");
      return await this.execCli(runtime.pythonBin, [
        "-I",
        "-c",
        bootstrap,
        ...extraArgs,
      ]);
    } catch {
      return null;
    }
  }

  async getVersion(): Promise<string> {
    return this.fetchCliVersion(this.getBin(), "hermes");
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

    // 1. Query Hermes' native Python model discovery (`hermes_cli.models`)
    // This works universally for ANY provider the user authenticated in Hermes.
    const requestedProvider = this.getConfig().options.provider?.trim() || "";
    const pyScript = `
import json, sys
from hermes_cli.config import load_config
from hermes_cli.models import list_available_providers, cached_provider_model_ids, provider_model_ids

req_prov = sys.argv[1] if len(sys.argv) > 1 else ""
force = sys.argv[2] == "1" if len(sys.argv) > 2 else False
cfg = load_config()
m = cfg.get("model") if isinstance(cfg, dict) else {}
default_model = (m.get("default") or m.get("model") or "") if isinstance(m, dict) else (m if isinstance(m, str) else "")
cfg_provider = req_prov or ((m.get("provider") or "") if isinstance(m, dict) else "")

providers = []
if cfg_provider and cfg_provider != "auto":
    providers.append(cfg_provider)
for p in list_available_providers():
    pid = p.get("id")
    if p.get("authenticated") and pid and pid not in providers:
        providers.append(pid)

models = []
if default_model:
    models.append(str(default_model).strip())

for pid in providers:
    try:
        rows = provider_model_ids(pid, force_refresh=force) if force else (cached_provider_model_ids(pid) or provider_model_ids(pid))
        for mid in (rows or []):
            models.append(str(mid).strip())
    except Exception:
        pass

print(json.dumps({"models": models}))
`;
    const pyOut = await this.execHermesPython(pyScript, [
      requestedProvider,
      forceRefresh ? "1" : "0",
    ]);
    if (pyOut) {
      try {
        const parsed = JSON.parse(pyOut.trim()) as { models?: string[] };
        for (const m of parsed.models || []) {
          addModel(m);
        }
      } catch {
        // ignore and continue to file/CLI fallbacks
      }
    }

    // 2. Fallback: read ~/.hermes/config.yaml and ~/.hermes/provider_models_cache.json
    const hermesHome = this.getHermesHome();
    for (const cfgModel of this.readConfiguredDefaultModels()) {
      addModel(cfgModel);
    }

    try {
      const provCachePath = join(hermesHome, "provider_models_cache.json");
      if (existsSync(provCachePath)) {
        const parsed = JSON.parse(readFileSync(provCachePath, "utf-8")) as Record<
          string,
          { models?: string[]; fallback?: boolean }
        >;
        const entries = Object.entries(parsed);
        entries.sort(([, a], [, b]) =>
          (a.fallback ? 1 : 0) - (b.fallback ? 1 : 0)
        );
        for (const [, entry] of entries) {
          for (const m of entry.models || []) {
            if (typeof m === "string") {
              addModel(m);
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // 3. Fallback: read Hermes static/curated catalog if no authenticated provider models were found
    if (seen.size <= 1) {
      try {
        const catalogPath = join(hermesHome, "cache", "model_catalog.json");
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
    }

    // 4. Final fallback: `hermes models` CLI (e.g. mock CLI simulator)
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

  public parseHermesConfigModels(raw: string): string[] {
    const found: string[] = [];
    const modelSection = raw.match(/^model:\s*\n((?:[ \t]+.*|\s*)\n)*/m);
    if (modelSection) {
      const defMatch = modelSection[0].match(
        /^\s+(?:default|model)\s*:\s*["']?([^\s"'#]+)/m
      );
      if (defMatch && defMatch[1]) {
        found.push(defMatch[1].trim());
      }
    }
    const topMatch = raw.match(
      /^\s*(?:default_)?model\s*:\s*["']?([^\s"'#:]+)["']?\s*$/m
    );
    if (topMatch && topMatch[1]) {
      const top = topMatch[1].trim();
      if (!found.includes(top)) found.push(top);
    }
    return found;
  }

  private readConfiguredDefaultModels(): string[] {
    try {
      const cfgPath = join(this.getHermesHome(), "config.yaml");
      if (existsSync(cfgPath)) {
        return this.parseHermesConfigModels(readFileSync(cfgPath, "utf-8"));
      }
    } catch {
      // ignore
    }
    return [];
  }

  private readConfiguredDefaultModel(): string {
    return this.readConfiguredDefaultModels()[0] ?? "";
  }

  async getModelContextLimit(model: string): Promise<number> {
    const effective =
      model.trim() ||
      this.getConfig().model.trim() ||
      this.readConfiguredDefaultModel();
    const configuredProvider =
      (this.getConfig().options.provider ?? "").trim();
    const cacheKey = `${configuredProvider}:${effective}`;
    const cached =
      this.contextLimits.get(cacheKey) ?? this.contextLimits.get(effective);
    if (cached && cached > 0) return cached;

    const failedAt = this.contextLimitFailedAt.get(cacheKey);
    if (failedAt !== undefined && Date.now() - failedAt < 60_000) {
      return this.estimateModelContextLimit(effective, 256_000);
    }

    try {
      const script = [
        "import json, sys",
        "from agent.model_metadata import get_model_context_length",
        "from hermes_cli.runtime_provider import resolve_runtime_provider",
        "from hermes_cli.models import PROVIDER_REGISTRY",
        "mod = sys.argv[1] if len(sys.argv) > 1 else ''",
        "req_prov = sys.argv[2] if len(sys.argv) > 2 else ''",
        "if '/' in mod and not req_prov:",
        "    prefix, rest = mod.split('/', 1)",
        "    if prefix in PROVIDER_REGISTRY and prefix != 'openrouter':",
        "        req_prov = prefix",
        "        mod = rest",
        "rt = resolve_runtime_provider(requested=req_prov or None, target_model=mod or None)",
        "eff_mod = mod or rt.get('model') or ''",
        "ctx = get_model_context_length(",
        "    eff_mod,",
        "    base_url=rt.get('base_url', '') or '',",
        "    api_key=rt.get('api_key', '') or '',",
        "    provider=rt.get('provider', '') or req_prov,",
        ")",
        "print(json.dumps({'context_length': ctx, 'model': eff_mod}))",
      ].join("\n");

      const out = await this.execHermesPython(script, [
        effective,
        configuredProvider,
      ]);
      if (out) {
        const parsed = JSON.parse(out) as {
          context_length?: number;
          model?: string;
        };
        if (
          typeof parsed.context_length === "number" &&
          parsed.context_length > 0
        ) {
          this.contextLimits.set(cacheKey, parsed.context_length);
          this.contextLimitFailedAt.delete(cacheKey);
          if (effective) {
            this.contextLimits.set(effective, parsed.context_length);
          }
          if (parsed.model) {
            this.contextLimits.set(parsed.model, parsed.context_length);
          }
          return parsed.context_length;
        }
      }
    } catch {
      // Fallback to heuristic estimation below
    }

    this.contextLimitFailedAt.set(cacheKey, Date.now());
    return this.estimateModelContextLimit(effective, 256_000);
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
