export interface PiAssistantMessageEvent {
  type?: "text_delta" | "thinking_delta" | string;
  delta?: string;
  contentIndex?: number;
}

export interface PiMessageContent {
  type?: "text" | "thinking" | string;
  text?: string;
  thinking?: string;
}

export interface PiMessage {
  role?: string;
  content?: PiMessageContent[];
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    totalTokens?: number;
    cost?: {
      total?: number;
    };
  };
}

export interface PiStreamEvent {
  type?:
    | "session"
    | "agent_start"
    | "turn_start"
    | "message_start"
    | "message_update"
    | "message_end"
    | "tool_execution_start"
    | "tool_execution_update"
    | "tool_execution_end"
    | "turn_end"
    | "agent_end"
    | "error"
    | string;
  id?: string;
  sessionId?: string;
  assistantMessageEvent?: PiAssistantMessageEvent;
  message?: PiMessage;
  messages?: PiMessage[];
  toolCallId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  isError?: boolean;
  error?: { message?: string } | string;
}
