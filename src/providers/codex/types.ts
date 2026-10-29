export interface CodexItem {
  id?: string;
  type?:
    | "agent_message"
    | "reasoning"
    | "command_execution"
    | "file_change"
    | "mcp_tool_call"
    | "web_search"
    | string;
  status?: "in_progress" | "completed" | "failed" | string;
  text?: string;
  command?: string;
  aggregated_output?: string;
  exit_code?: number;
  changes?: Array<{ path?: string; kind?: string }>;
  tool?: string;
  arguments?: unknown;
  result?: unknown;
  query?: string;
}

export interface CodexUsage {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
}

export interface CodexStreamEvent {
  type?:
    | "thread.started"
    | "turn.started"
    | "turn.completed"
    | "turn.failed"
    | "item.started"
    | "item.updated"
    | "item.completed"
    | "item.failed"
    | "error"
    | string;
  thread_id?: string;
  item?: CodexItem;
  usage?: CodexUsage;
  error?: { message?: string } | string;
  message?: string;
}
