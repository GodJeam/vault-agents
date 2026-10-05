import type { Language } from "../i18n";

export type EngineType = "opencode" | "antigravity";

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
  onFinish: (info: FinishInfo) => void;
  onError: (message: string) => void;
  onDone: (exitCode: number) => void;
  onRaw?: (line: string) => void;
}

export interface HistoryUser {
  role: "user";
  text: string;
  contextLabel?: string;
}

export interface HistoryAssistant {
  role: "assistant";
  text: string;
  reasoning?: string;
  tokens?: { total?: number; input?: number; output?: number };
  cost?: number;
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
  // OpenCode settings
  binaryPath: string;
  model: string;
  agent: string;
  // Antigravity settings
  antigravityBinary: string;
  antigravityModel: string;
  antigravityEffort: "low" | "medium" | "high" | "max";
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

export const DEFAULT_SETTINGS: PluginSettings = {
  language: "en",
  engine: "antigravity",
  binaryPath: "opencode",
  model: "opencode-go/deepseek-v4-flash",
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
