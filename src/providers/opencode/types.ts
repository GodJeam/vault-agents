export interface OpencodePartState {
  status?: string;
  title?: string;
  input?: unknown;
  output?: unknown;
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
  };
  cost?: number;
}

export interface OpencodeEvent {
  type?: "text" | "reasoning" | "tool_use" | "step_finish" | "error" | string;
  sessionID?: string;
  part?: OpencodePart;
  error?: unknown;
}
