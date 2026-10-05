export interface TurnContext {
  label: string;
  content: string;
}

export interface SessionStats {
  input: number;
  output: number;
  total: number;
  cost: number;
}

export interface SuggestItem {
  label: string;
  desc?: string;
  action: () => void;
}

export interface AttachmentItem {
  path: string;
  label: string;
  image?: boolean;
}
