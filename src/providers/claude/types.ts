export interface ClaudeContentBlock {
  type?: "text" | "thinking" | "tool_use" | "tool_result" | string;
  id?: string;
  name?: string;
  text?: string;
  thinking?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
}

export interface ClaudeUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface ClaudeStreamEvent {
  type?:
    | "system"
    | "assistant"
    | "user"
    | "stream_event"
    | "result"
    | "error"
    | string;
  subtype?: string;
  session_id?: string;
  message?: {
    id?: string;
    role?: string;
    content?: ClaudeContentBlock[];
    usage?: ClaudeUsage;
  };
  event?: {
    type?: string;
    index?: number;
    delta?: {
      type?: string;
      text?: string;
      thinking?: string;
    };
  };
  result?: string;
  total_cost_usd?: number;
  cost_usd?: number;
  duration_ms?: number;
  is_error?: boolean;
  usage?: ClaudeUsage;
  error?: { message?: string } | string;
}
