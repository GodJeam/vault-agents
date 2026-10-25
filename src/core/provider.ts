import type {
  EngineConfig,
  EngineType,
  HistoryMap,
  HistoryMessage,
  PluginSettings,
  RunHandle,
  RunRequest,
  SessionInfo,
  StreamCallbacks,
  UsageStats,
} from "./types";

export interface ProviderOptionDescriptor {
  key: string;
  label: string;
  desc: string;
  type: "text" | "select";
  placeholder?: string;
  choices?: Array<{ value: string; label: string }>;
  default: string;
}

export interface ProviderDescriptor {
  /** Unique engine identifier (e.g. 'antigravity', 'opencode') */
  id: EngineType;
  /** Full human-readable name for settings and dropdowns */
  displayName: string;
  /** Short name displayed in chat message headers */
  shortName: string;
  /** Default CLI executable name */
  defaultBinary: string;
  /** Default model identifier */
  defaultModel: string;
  /** Description shown under the model dropdown in Settings */
  modelDesc: string;
  /** Description shown under the binary path field in Settings */
  binaryDesc: string;
  /** True when usage is included in a subscription (no per-token cost) */
  included: boolean;
  /** Human-readable note about cost/inclusion (e.g. "Google AI Pro") */
  costNote?: string;
  /** Session persistence mechanism supported by this provider */
  supportsSessions: "api" | "local-db" | "none";
  /** Whether the provider supports token/cost usage statistics */
  supportsUsageStats: boolean;
  /** Whether the provider supports database attachment self-cleanup */
  supportsDbCleanup?: boolean;
  /** Engine-specific configuration fields rendered dynamically in Settings */
  options: ProviderOptionDescriptor[];
}

/**
 * Host interface injected into CLI runners so they do not depend on the
 * Obsidian runtime module directly and can be tested in pure Node.js.
 */
export interface RunnerHost {
  readonly settings: PluginSettings;
  readonly histories: HistoryMap;
  getHistory(sessionId: string): HistoryMessage[];
  getEngineConfig(engineId: string): EngineConfig;
  getVaultPath(): string | null;
  t(text: string): string;
}

export interface AgentProvider {
  /** Static metadata and capability descriptor for this engine */
  readonly descriptor: ProviderDescriptor;

  /** Unique engine identifier (e.g. 'antigravity', 'opencode') */
  readonly id: EngineType;

  /** Human-readable display name for the UI */
  readonly displayName: string;

  /** Compatibility alias for legacy runner interface */
  readonly engine: EngineType;

  /** True when usage is included in a subscription (no per-token cost) */
  readonly included: boolean;

  /** Human-readable note about cost/inclusion (e.g. "Google AI Pro") */
  readonly costNote?: string;

  /** Check CLI version */
  getVersion(): Promise<string>;

  /** List available models */
  listModels(forceRefresh?: boolean): Promise<string[]>;

  /** List existing sessions for this engine */
  listSessions(): Promise<SessionInfo[]>;

  /** Rename an existing session */
  renameSession(sessionId: string, title: string): Promise<void>;

  /** Delete a session */
  deleteSession(sessionId: string): Promise<void>;

  /** Get context token limit for a specific model */
  getModelContextLimit(model: string): Promise<number>;

  /** Get token usage for a session (last turn prompt size + session totals) */
  getSessionTokens(sessionId: string): Promise<{
    input: number;
    output: number;
    totalInput?: number;
    totalOutput?: number;
    totalTokens?: number;
    totalCost?: number;
  }>;

  /** Get global usage statistics if supported */
  getUsageStats(): Promise<UsageStats>;

  /** Run a streaming execution with real-time callbacks */
  runStream(
    req: RunRequest | string,
    fileAttachmentsOrCb?: string[] | StreamCallbacks,
    maybeCb?: StreamCallbacks
  ): RunHandle;

  /** Convert documents (PDF, DOCX, XLSX) to Markdown via anydoc */
  convertDocument(absPath: string): Promise<string>;

  /** Optional database cleanup for engines storing file blobs in SQLite */
  pruneOversizedParts?(force?: boolean, ignoreAge?: boolean): Promise<void>;

  /** Abort and kill all running child processes for this provider */
  killAll(): void;
}

/** Backward compatibility alias */
export type AgentRunner = AgentProvider;
