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
  tokens?: { total?: number; input?: number; output?: number };
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
  /** Per-engine configuration map (Fase 1 multi-agent architecture) */
  engines: Record<string, EngineConfig>;
  // Legacy OpenCode settings (kept synced for backward compatibility)
  binaryPath: string;
  model: string;
  agent: string;
  // Legacy Antigravity settings (kept synced for backward compatibility)
  antigravityBinary: string;
  antigravityModel: string;
  antigravityEffort: ReasoningEffort;
  // Shared settings
  anydocEnabled: boolean;
  anydocBinary: string;
  autoApprove: boolean;
  showThinking: boolean;
  showToolIO: boolean;
  sessionId: string;
  sessionEngines?: Record<string, EngineType>;
  pinned: string[];
  prompts: PromptTemplate[];
  dbAutoCleanup: boolean;
  dbCleanupMaxMB: number;
  dbCleanupAgeDays: number;
  maxAttachMB: number;
}

export type OpencodeSettings = PluginSettings;

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
};

export const DEFAULT_SETTINGS: PluginSettings = {
  language: "en",
  engine: "antigravity",
  engines: {
    antigravity: {
      binary: DEFAULT_ENGINE_CONFIGS.antigravity.binary,
      model: DEFAULT_ENGINE_CONFIGS.antigravity.model,
      options: { ...DEFAULT_ENGINE_CONFIGS.antigravity.options },
    },
    opencode: {
      binary: DEFAULT_ENGINE_CONFIGS.opencode.binary,
      model: DEFAULT_ENGINE_CONFIGS.opencode.model,
      options: { ...DEFAULT_ENGINE_CONFIGS.opencode.options },
    },
  },
  binaryPath: "opencode",
  model: "opencode-go/deepseek-v4.1-flash",
  agent: "",
  antigravityBinary: "agy",
  antigravityModel: "gemini-3.8-flash-high",
  antigravityEffort: "high",
  anydocEnabled: true,
  anydocBinary: "anydoc",
  autoApprove: true,
  showThinking: false,
  showToolIO: true,
  sessionId: "",
  sessionEngines: {},
  pinned: [],
  prompts: [],
  dbAutoCleanup: true,
  dbCleanupMaxMB: 5,
  dbCleanupAgeDays: 7,
  maxAttachMB: 20,
};

/**
 * Retrieve (and initialize if missing) the EngineConfig for a given engine ID,
 * keeping legacy top-level fields synchronized.
 */
export function getEngineConfig(settings: PluginSettings, engineId: string): EngineConfig {
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

/**
 * Synchronize legacy flat fields from `settings.engines` so existing data.json
 * consumers and legacy getters remain consistent.
 */
export function syncSettingsFields(settings: PluginSettings): void {
  const agy = getEngineConfig(settings, "antigravity");
  const oc = getEngineConfig(settings, "opencode");

  settings.antigravityBinary = agy.binary || DEFAULT_SETTINGS.antigravityBinary;
  settings.antigravityModel = agy.model || DEFAULT_SETTINGS.antigravityModel;
  settings.antigravityEffort = (agy.options.effort as ReasoningEffort) || DEFAULT_SETTINGS.antigravityEffort;

  settings.binaryPath = oc.binary || DEFAULT_SETTINGS.binaryPath;
  settings.model = oc.model;
  settings.agent = oc.options.agent ?? "";
}

/**
 * Migrate raw data loaded from Obsidian's `data.json` into the structured
 * multi-engine `PluginSettings` and `HistoryMap`.
 */
export function migrateSettings(
  raw: Record<string, unknown> | null | undefined
): { settings: PluginSettings; histories: HistoryMap } {
  const data = raw ?? {};
  const { histories, engines: rawEngines, ...rest } = data as {
    histories?: HistoryMap;
    engines?: Record<string, Partial<EngineConfig>>;
  } & Record<string, unknown>;

  const base: PluginSettings = Object.assign(
    {},
    DEFAULT_SETTINGS,
    {
      engines: {
        antigravity: {
          binary: DEFAULT_ENGINE_CONFIGS.antigravity.binary,
          model: DEFAULT_ENGINE_CONFIGS.antigravity.model,
          options: { ...DEFAULT_ENGINE_CONFIGS.antigravity.options },
        },
        opencode: {
          binary: DEFAULT_ENGINE_CONFIGS.opencode.binary,
          model: DEFAULT_ENGINE_CONFIGS.opencode.model,
          options: { ...DEFAULT_ENGINE_CONFIGS.opencode.options },
        },
      },
      sessionEngines: {},
      pinned: [],
      prompts: [],
    },
    rest
  );

  // 1. Apply legacy top-level fields if present in raw data
  if (typeof rest.antigravityBinary === "string" && rest.antigravityBinary.trim()) {
    base.engines.antigravity.binary = rest.antigravityBinary.trim();
  }
  if (typeof rest.antigravityModel === "string" && rest.antigravityModel.trim()) {
    base.engines.antigravity.model = rest.antigravityModel.trim();
  }
  if (typeof rest.antigravityEffort === "string" && rest.antigravityEffort.trim()) {
    base.engines.antigravity.options.effort = rest.antigravityEffort.trim();
  }

  if (typeof rest.binaryPath === "string" && rest.binaryPath.trim()) {
    base.engines.opencode.binary = rest.binaryPath.trim();
  }
  if (typeof rest.model === "string") {
    base.engines.opencode.model = rest.model.trim();
  }
  if (typeof rest.agent === "string") {
    base.engines.opencode.options.agent = rest.agent.trim();
  }

  // 2. Apply structured `engines` map if present (takes precedence over legacy flat fields)
  if (rawEngines && typeof rawEngines === "object") {
    for (const [id, cfg] of Object.entries(rawEngines)) {
      if (!cfg || typeof cfg !== "object") continue;
      const existing = base.engines[id] ?? {
        binary: DEFAULT_ENGINE_CONFIGS[id]?.binary ?? id,
        model: DEFAULT_ENGINE_CONFIGS[id]?.model ?? "",
        options: { ...(DEFAULT_ENGINE_CONFIGS[id]?.options ?? {}) },
      };
      base.engines[id] = {
        binary: typeof cfg.binary === "string" && cfg.binary.trim() ? cfg.binary.trim() : existing.binary,
        model: typeof cfg.model === "string" ? cfg.model.trim() : existing.model,
        options: {
          ...existing.options,
          ...(cfg.options && typeof cfg.options === "object" ? cfg.options : {}),
        },
      };
    }
  }

  syncSettingsFields(base);
  return {
    settings: base,
    histories: histories && typeof histories === "object" ? histories : {},
  };
}
