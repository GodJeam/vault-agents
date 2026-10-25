export interface OpencodePartState {
  status?: string;
  title?: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  time?: {
    start?: number;
    end?: number;
  };
}

export interface OpencodePart {
  type?: string;
  id?: string | number;
  text?: string;
  tool?: string;
  callID?: string;
  state?: OpencodePartState;
  tokens?: {
    total?: number;
    input?: number;
    output?: number;
    reasoning?: number;
    cache?: { read?: number; write?: number };
  };
  cost?: number;
}

export interface OpencodeEvent {
  type?: "text" | "reasoning" | "tool_use" | "step_finish" | "error" | string;
  sessionID?: string;
  part?: OpencodePart;
  error?: unknown;
}

/** Model metadata returned by `opencode api GET /api/model`. */
export interface OpencodeModelInfo {
  id?: string;
  modelID?: string;
  providerID?: string;
  limit?: { context?: number; output?: number };
}

/**
 * Assistant message metadata returned by
 * `opencode api GET /api/session/{id}/message`.
 */
export interface OpencodeMessageInfo {
  role?: string;
  type?: string;
  tokens?: {
    input?: number;
    output?: number;
    reasoning?: number;
    cache?: { read?: number; write?: number };
  };
}
