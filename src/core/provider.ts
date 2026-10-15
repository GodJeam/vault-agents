import type {
  EngineType,
  RunHandle,
  SessionInfo,
  StreamCallbacks,
  UsageStats,
} from "./types";

export interface AgentProvider {
  /** Unique engine identifier (e.g. 'antigravity', 'opencode') */
  readonly id: EngineType;

  /** Human-readable display name for the UI */
  readonly displayName: string;

  /** Compatibility alias for legacy runner interface */
  readonly engine: EngineType;

  /** True when usage is included in a subscription (no per-token cost is shown) */
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

  /** Get token usage for a session */
  getSessionTokens(sessionId: string): Promise<{ input: number; output: number }>;

  /** Get global usage statistics if supported */
  getUsageStats(): Promise<UsageStats>;

  /** Run a streaming execution with real-time callbacks */
  runStream(prompt: string, fileAttachments: string[], cb: StreamCallbacks): RunHandle;

  /** Convert documents (PDF, DOCX, XLSX) to Markdown via anydoc */
  convertDocument(absPath: string): Promise<string>;

  /** Abort and kill all running child processes for this provider */
  killAll(): void;
}

/** Backward compatibility alias */
export type AgentRunner = AgentProvider;
