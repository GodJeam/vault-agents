export interface AntigravityToolInfo {
  name?: string;
  parameters?: Record<string, unknown>;
  output?: unknown;
}

export interface AntigravityStepUpdate {
  conversation_id?: string;
  step_type?: string;
  step_index?: number;
  text_delta?: string;
  thought?: string;
  reasoning?: string;
  state?: string;
  status?: string;
  error?: unknown;
  tool_name?: string;
  tool_info?: AntigravityToolInfo;
}

export interface AntigravityResultUsage {
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  thinking_tokens?: number;
}

export interface AntigravityResult {
  response?: string;
  usage?: AntigravityResultUsage;
}

export interface AntigravityEvent {
  event?: "init" | "step_update" | "result" | "error" | string;
  conversation_id?: string;
  step_update?: AntigravityStepUpdate;
  result?: AntigravityResult;
  error?: { message?: string };
}
