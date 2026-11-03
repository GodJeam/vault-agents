/**
 * Best-effort secret redaction for strings that end up in the UI or in logs
 * (CLI stderr, API errors, exception messages).
 *
 * This is intentionally conservative: it targets well-known credential
 * shapes and explicit `key=value` pairs, and leaves normal prose untouched.
 */
interface RedactionRule {
  pattern: RegExp;
  replacement: string;
}

const RULES: RedactionRule[] = [
  // OpenAI-style and generic sk- keys
  { pattern: /\bsk-[A-Za-z0-9_-]{8,}/g, replacement: "sk-[REDACTED]" },
  // GitHub tokens
  { pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}/g, replacement: "gh*_[REDACTED]" },
  {
    pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
    replacement: "github_pat_[REDACTED]",
  },
  // Google API keys
  { pattern: /\bAIza[0-9A-Za-z_-]{20,}/g, replacement: "AIza[REDACTED]" },
  // Slack tokens
  {
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g,
    replacement: "xox*-[REDACTED]",
  },
  // AWS access key ids
  { pattern: /\bAKIA[0-9A-Z]{16}\b/g, replacement: "AKIA[REDACTED]" },
  // JWTs
  {
    pattern:
      /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g,
    replacement: "[REDACTED JWT]",
  },
  // Authorization headers
  {
    pattern: /\b(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi,
    replacement: "$1[REDACTED]",
  },
  {
    pattern: /\b(Basic\s+)[A-Za-z0-9+/=]{8,}/gi,
    replacement: "$1[REDACTED]",
  },
  // Explicit credential assignments (avoid bare "token"/"secret" to reduce
  // false positives on normal token-count messages).
  {
    pattern:
      /((?:api[_-]?key|access[_-]?key|secret[_-]?key|client[_-]?secret|password|passwd|auth[_-]?token|access[_-]?token|refresh[_-]?token)\s*[:=]\s*["']?)[^\s"',;]{4,}/gi,
    replacement: "$1[REDACTED]",
  },
  // Credentials embedded in URLs
  {
    pattern: /\b(https?:\/\/[^/\s:@]+:)[^/\s@]+@/gi,
    replacement: "$1[REDACTED]@",
  },
];

export function redact(input: unknown): string {
  let text: string;
  if (input instanceof Error) {
    text = input.message ? `${input.name}: ${input.message}` : input.name;
  } else if (typeof input === "string") {
    text = input;
  } else {
    text = String(input ?? "");
  }
  for (const rule of RULES) {
    text = text.replace(rule.pattern, rule.replacement);
  }
  return text;
}
