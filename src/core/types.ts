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

/**
 * Migrate raw data loaded from Obsidian's `data.json` into the structured
 * multi-engine `PluginSettings` and `HistoryMap`.
 */
export function migrateSettings(
  raw: Record<string, unknown> | null | undefined
): { settings: PluginSettings; histories: HistoryMap } {
  const data = raw ?? {};
  const {
    histories,
    engines: rawEngines,
    binaryPath,
    model,
    agent,
    antigravityBinary,
    antigravityModel,
    antigravityEffort,
    ...rest
  } = data as {
    histories?: HistoryMap;
    engines?: Record<string, Partial<EngineConfig>>;
  } & Record<string, unknown>;

  const base: PluginSettings = Object.assign(
    {},
    DEFAULT_SETTINGS,
    {
      engines: createDefaultEnginesMap(),
      sessionEngines: {},
      pinned: [],
      prompts: [],
    },
    rest
  );

  // 1. Apply legacy top-level fields if present in raw data
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

  // 2. Apply structured `engines` map if present (overrides legacy fields)
  if (rawEngines && typeof rawEngines === "object") {
    for (const [id, cfg] of Object.entries(rawEngines)) {
      if (!cfg || typeof cfg !== "object") continue;
      const existing = base.engines[id] ?? {
        binary: DEFAULT_ENGINE_CONFIGS[id]?.binary ?? id,
        model: DEFAULT_ENGINE_CONFIGS[id]?.model ?? "",
        options: { ...(DEFAULT_ENGINE_CONFIGS[id]?.options ?? {}) },
      };
      base.engines[id] = {
        binary:
          typeof cfg.binary === "string" && cfg.binary.trim()
            ? cfg.binary.trim()
            : existing.binary,
        model:
          typeof cfg.model === "string" ? cfg.model.trim() : existing.model,
        options: {
          ...existing.options,
          ...(cfg.options && typeof cfg.options === "object"
            ? cfg.options
            : {}),
        },
      };
    }
  }

  return {
    settings: base,
    histories: histories && typeof histories === "object" ? histories : {},
  };
}
