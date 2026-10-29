export interface HermesTokens {
  input?: number;
  output?: number;
  reasoning?: number;
  total?: number;
  cache_read?: number;
  cache_write?: number;
}

export interface HermesStreamEvent {
  timestamp?: number;
  type?:
    | "system"
    | "text"
    | "reasoning"
    | "thought"
    | "tool_use"
    | "tool_result"
    | "result"
    | "error"
    | string;
  subtype?: string;
  session_id?: string;
  model?: string;
  id?: string;
  call_id?: string;
  name?: string;
  tool?: string;
  text?: string;
  reasoning?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  duration_ms?: number;
  is_error?: boolean;
  exit_code?: number;
  tokens?: HermesTokens;
  cost?: number;
  error?: { message?: string } | string | null;
}
