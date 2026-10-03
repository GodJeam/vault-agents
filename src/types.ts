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

export interface AgentRunner {
  readonly engine: EngineType;
  getVersion(): Promise<string>;
  listModels(forceRefresh?: boolean): Promise<string[]>;
  listSessions(): Promise<SessionInfo[]>;
  renameSession(sessionId: string, title: string): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  getModelContextLimit(model: string): Promise<number>;
  getSessionTokens(sessionId: string): Promise<{ input: number; output: number }>;
  getUsageStats(): Promise<UsageStats>;
  runStream(prompt: string, fileAttachments: string[], cb: StreamCallbacks): RunHandle;
  convertDocument(absPath: string): Promise<string>;
  killAll(): void;
}
