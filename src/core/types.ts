import type { Language } from "../i18n";

export type EngineType = string;

export type ReasoningEffort = "low" | "medium" | "high" | "xhigh" | "max";

export interface EngineConfig {
  binary: string;
  model: string;
  options: Record<string, string>;
}

export interface RunRequest {
  prompt: string;
  fileAttachments: string[];
  sessionId?: string;
  cwd?: string;
}

export interface RunHandle {
  abort: () => void;
}

export interface SessionInfo {
  id: string;
  title?: string;
  updated?: number;
  created?: number;
  projectId?: string;
  directory?: string;
  engine?: EngineType;
}

export interface StepInfo {
  id: string;
  tool: string;
  title: string;
  state: string;
  input?: unknown;
  output?: unknown;
  durationMs?: number;
}

export interface AgentQuestionOption {
  label: string;
  description?: string;
}

export interface AgentQuestion {
  header?: string;
  question: string;
  options: AgentQuestionOption[];
  multiple?: boolean;
}

export interface FinishInfo {
  tokens?: {
    total?: number;
    input?: number;
    output?: number;
    reasoning?: number;
    cache?: {
      read?: number;
      write?: number;
    };
  };
  cost?: number;
}

export interface UsageWindow {
  input: number;
  output: number;
  cost: number;
}

export interface UsageStats {
  h5: UsageWindow;
  week: UsageWindow;
  month: UsageWindow;
}

export interface StreamCallbacks {
  onSession: (sessionId: string) => void;
  onText: (text: string, partId: string) => void;
  onReasoning: (text: string, partId: string) => void;
  onStep: (step: StepInfo) => void;
  onQuestion?: (questions: AgentQuestion[]) => void;
  onActivity?: (activity: string) => void;
  onFinish: (info: FinishInfo) => void;
  onError: (message: string) => void;
  onDone: (exitCode: number) => void;
  onRaw?: (line: string) => void;
}

export interface HistoryUser {
  role: "user";
  text: string;
  contextLabel?: string;
  timestamp?: number;
}

export interface HistoryAssistant {
  role: "assistant";
  text: string;
  reasoning?: string;
  tokens?: {
    total?: number;
    input?: number;
    output?: number;
    reasoning?: number;
    cache?: { read?: number; write?: number };
  };
  cost?: number;
  timestamp?: number;
}

export type HistoryMessage = HistoryUser | HistoryAssistant;
export type HistoryMap = Record<string, HistoryMessage[]>;

export interface PromptTemplate {
  name: string;
  text: string;
}

export interface PluginSettings {
  language: Language;
  engine: EngineType;
  /** Per-engine configuration map */
  engines: Record<string, EngineConfig>;
  // Shared settings
  anydocEnabled: boolean;
  anydocBinary: string;
  /** Send scanned documents to the hosted Firecrawl Parse OCR service. */
  anydocHostedOcr: boolean;
  autoApprove: boolean;
  showThinking: boolean;
  showToolIO: boolean;
  sessionId: string;
  sessionEngines?: Record<string, EngineType>;
  pinned: string[];
  prompts: PromptTemplate[];
  /** Persist chat history in the plugin's data.json. */
  saveHistory: boolean;
  /** Maximum number of history sessions kept on disk. */
  historyMaxSessions: number;
  /** Maximum approximate size of the persisted history, in bytes. */
  historyMaxBytes: number;
  dbAutoCleanup: boolean;
  dbCleanupMaxMB: number;
  dbCleanupAgeDays: number;
  maxAttachMB: number;
}

export const DEFAULT_ENGINE_CONFIGS: Record<string, EngineConfig> = {
  antigravity: {
    binary: "agy",
    model: "gemini-3.8-flash-high",
    options: {
      effort: "high",
    },
  },
  opencode: {
    binary: "opencode",
    model: "opencode-go/deepseek-v4.1-flash",
    options: {
      agent: "",
    },
  },
  hermes: {
    binary: "hermes",
    model: "",
    options: {
      provider: "",
    },
  },
  pi: {
    binary: "pi",
    model: "",
    options: {
      provider: "",
      thinking: "",
    },
  },
};

export function createDefaultEnginesMap(): Record<string, EngineConfig> {
  const map: Record<string, EngineConfig> = {};
  for (const [id, def] of Object.entries(DEFAULT_ENGINE_CONFIGS)) {
    map[id] = {
      binary: def.binary,
      model: def.model,
      options: { ...def.options },
    };
  }
  return map;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  language: "en",
  engine: "antigravity",
  engines: createDefaultEnginesMap(),
  anydocEnabled: false,
  anydocBinary: "anydoc",
  anydocHostedOcr: false,
  autoApprove: false,
  showThinking: false,
  showToolIO: true,
  sessionId: "",
  sessionEngines: {},
  pinned: [],
  prompts: [],
  saveHistory: true,
  historyMaxSessions: 50,
  historyMaxBytes: 5_000_000,
  dbAutoCleanup: false,
  dbCleanupMaxMB: 5,
  dbCleanupAgeDays: 7,
  maxAttachMB: 20,
};

/**
 * Retrieve (and initialize if missing) the EngineConfig for a given engine ID.
 */
export function getEngineConfig(
  settings: PluginSettings,
  engineId: string
): EngineConfig {
  if (!settings.engines) {
    settings.engines = {};
  }
  if (!settings.engines[engineId]) {
    const def = DEFAULT_ENGINE_CONFIGS[engineId];
    settings.engines[engineId] = {
      binary: def?.binary ?? engineId,
      model: def?.model ?? "",
      options: { ...(def?.options ?? {}) },
    };
  }
  return settings.engines[engineId];
}

const MAX_HISTORY_TEXT = 50_000;
const MAX_HISTORY_MESSAGES = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function trimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function clampInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function asStringRecord(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isRecord(value)) return out;
  for (const [key, item] of Object.entries(value)) {
    if (key && typeof item === "string") out[key] = item;
  }
  return out;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out = new Set<string>();
  for (const item of value) {
    const trimmed = trimmedString(item);
    if (trimmed) out.add(trimmed);
  }
  return Array.from(out);
}

function asPrompts(value: unknown): PromptTemplate[] {
  if (!Array.isArray(value)) return [];
  const out: PromptTemplate[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const name = trimmedString(item.name);
    if (!name || typeof item.text !== "string" || !item.text) continue;
    out.push({ name, text: item.text });
  }
  return out;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function sanitizeTokens(
  value: unknown
): HistoryAssistant["tokens"] | undefined {
  if (!isRecord(value)) return undefined;
  let cache: { read?: number; write?: number } | undefined;
  if (isRecord(value.cache)) {
    const read = finiteNumber(value.cache.read);
    const write = finiteNumber(value.cache.write);
    if (read !== undefined || write !== undefined) cache = { read, write };
  }
  const total = finiteNumber(value.total);
  const input = finiteNumber(value.input);
  const output = finiteNumber(value.output);
  const reasoning = finiteNumber(value.reasoning);
  if (
    total === undefined &&
    input === undefined &&
    output === undefined &&
    reasoning === undefined &&
    !cache
  ) {
    return undefined;
  }
  return { total, input, output, reasoning, cache };
}

function sanitizeHistory(value: unknown): HistoryMap {
  const out: HistoryMap = {};
  if (!isRecord(value)) return out;
  for (const [sessionId, rawMessages] of Object.entries(value)) {
    if (!sessionId || !Array.isArray(rawMessages)) continue;
    const messages: HistoryMessage[] = [];
    for (const rawMessage of rawMessages) {
      if (!isRecord(rawMessage)) continue;
      const role = rawMessage.role;
      const text =
        typeof rawMessage.text === "string"
          ? rawMessage.text.slice(0, MAX_HISTORY_TEXT)
          : "";
      const timestamp = finiteNumber(rawMessage.timestamp);
      if (role === "user") {
        messages.push({
          role: "user",
          text,
          contextLabel:
            typeof rawMessage.contextLabel === "string"
              ? rawMessage.contextLabel
              : undefined,
          timestamp,
        });
      } else if (role === "assistant") {
        messages.push({
          role: "assistant",
          text,
          reasoning:
            typeof rawMessage.reasoning === "string"
              ? rawMessage.reasoning.slice(0, MAX_HISTORY_TEXT)
              : undefined,
          tokens: sanitizeTokens(rawMessage.tokens),
          cost: finiteNumber(rawMessage.cost),
          timestamp,
        });
      }
    }
    if (messages.length > MAX_HISTORY_MESSAGES) {
      messages.splice(0, messages.length - MAX_HISTORY_MESSAGES);
    }
    if (messages.length > 0) out[sessionId] = messages;
  }
  return out;
}

function applyEngineOverrides(
  target: Record<string, EngineConfig>,
  raw: unknown
): void {
  if (!isRecord(raw)) return;
  for (const [id, rawConfig] of Object.entries(raw)) {
    if (!id || !isRecord(rawConfig)) continue;
    const existing = target[id] ?? {
      binary: DEFAULT_ENGINE_CONFIGS[id]?.binary ?? id,
      model: DEFAULT_ENGINE_CONFIGS[id]?.model ?? "",
      options: { ...(DEFAULT_ENGINE_CONFIGS[id]?.options ?? {}) },
    };
    target[id] = {
      binary: trimmedString(rawConfig.binary) ?? existing.binary,
      model:
        typeof rawConfig.model === "string"
          ? rawConfig.model.trim()
          : existing.model,
      options: { ...existing.options, ...asStringRecord(rawConfig.options) },
    };
  }
}

/**
 * Migrate raw data loaded from Obsidian's `data.json` into the structured
 * multi-engine `PluginSettings` and `HistoryMap`.
 *
 * The input is untrusted: vault settings can be edited by hand or synced from
 * another machine, so every field is validated and coerced to its expected
 * type before it reaches the rest of the plugin.
 */
export function migrateSettings(
  raw: Record<string, unknown> | null | undefined
): { settings: PluginSettings; histories: HistoryMap } {
  const data: Record<string, unknown> = isRecord(raw) ? raw : {};
  const {
    histories,
    engines: rawEngines,
    binaryPath,
    model,
    agent,
    antigravityBinary,
    antigravityModel,
    antigravityEffort,
  } = data;

  const base: PluginSettings = {
    ...DEFAULT_SETTINGS,
    engines: createDefaultEnginesMap(),
    sessionEngines: {},
    pinned: [],
    prompts: [],
  };

  base.language =
    data.language === "en" || data.language === "it"
      ? data.language
      : DEFAULT_SETTINGS.language;
  base.anydocEnabled = asBool(
    data.anydocEnabled,
    DEFAULT_SETTINGS.anydocEnabled
  );
  base.anydocBinary =
    trimmedString(data.anydocBinary) ?? DEFAULT_SETTINGS.anydocBinary;
  base.anydocHostedOcr = asBool(
    data.anydocHostedOcr,
    DEFAULT_SETTINGS.anydocHostedOcr
  );
  base.autoApprove = asBool(data.autoApprove, DEFAULT_SETTINGS.autoApprove);
  base.showThinking = asBool(data.showThinking, DEFAULT_SETTINGS.showThinking);
  base.showToolIO = asBool(data.showToolIO, DEFAULT_SETTINGS.showToolIO);
  base.sessionId =
    typeof data.sessionId === "string" ? data.sessionId.trim() : "";
  base.sessionEngines = asStringRecord(data.sessionEngines);
  base.pinned = asStringArray(data.pinned);
  base.prompts = asPrompts(data.prompts);
  base.dbAutoCleanup = asBool(
    data.dbAutoCleanup,
    DEFAULT_SETTINGS.dbAutoCleanup
  );
  base.dbCleanupMaxMB = clampInt(
    data.dbCleanupMaxMB,
    DEFAULT_SETTINGS.dbCleanupMaxMB,
    1,
    200
  );
  base.dbCleanupAgeDays = clampInt(
    data.dbCleanupAgeDays,
    DEFAULT_SETTINGS.dbCleanupAgeDays,
    0,
    365
  );
  base.maxAttachMB = clampInt(
    data.maxAttachMB,
    DEFAULT_SETTINGS.maxAttachMB,
    1,
    500
  );
  base.saveHistory = asBool(data.saveHistory, DEFAULT_SETTINGS.saveHistory);
  base.historyMaxSessions = clampInt(
    data.historyMaxSessions,
    DEFAULT_SETTINGS.historyMaxSessions,
    1,
    500
  );
  base.historyMaxBytes = clampInt(
    data.historyMaxBytes,
    DEFAULT_SETTINGS.historyMaxBytes,
    1_048_576,
    209_715_200
  );

  // 1. Apply legacy top-level fields if present in raw data.
  if (typeof antigravityBinary === "string" && antigravityBinary.trim()) {
    base.engines.antigravity.binary = antigravityBinary.trim();
  }
  if (typeof antigravityModel === "string" && antigravityModel.trim()) {
    base.engines.antigravity.model = antigravityModel.trim();
  }
  if (typeof antigravityEffort === "string" && antigravityEffort.trim()) {
    base.engines.antigravity.options.effort = antigravityEffort.trim();
  }
  if (typeof binaryPath === "string" && binaryPath.trim()) {
    base.engines.opencode.binary = binaryPath.trim();
  }
  if (typeof model === "string") {
    base.engines.opencode.model = model.trim();
  }
  if (typeof agent === "string") {
    base.engines.opencode.options.agent = agent.trim();
  }

  // 2. Apply structured `engines` map if present (overrides legacy fields).
  applyEngineOverrides(base.engines, rawEngines);

  const requestedEngine =
    typeof data.engine === "string" ? data.engine.trim() : "";
  base.engine =
    requestedEngine && base.engines[requestedEngine]
      ? requestedEngine
      : DEFAULT_SETTINGS.engine;

  return { settings: base, histories: sanitizeHistory(histories) };
}
