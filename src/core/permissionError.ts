/**
 * Heuristics to detect when a CLI agent stopped because a tool needed a
 * permission/approval that could not be granted interactively.
 *
 * The plugin spawns CLIs with stdin ignored, so permission prompts cannot be
 * answered. When auto-approve is disabled this is a common and actionable
 * failure mode, and the UI offers a shortcut to enable auto-approve.
 */
const PERMISSION_PATTERNS: RegExp[] = [
  /permission\s+(denied|required|requested|needed)/i,
  /requires?\s+(approval|permission|confirmation)/i,
  /approval\s+(required|needed)/i,
  /not\s+(allowed|permitted)\b/i,
  /(tool|command|operation|action)\s+.*\b(blocked|denied|not\s+allowed)\b/i,
  /access\s+denied/i,
  /auto[- ]?approve/i,
  /dangerously[- ]skip[- ]permissions/i,
  /denied\s+by\s+(the\s+)?user/i,
];

export function isPermissionError(text: string): boolean {
  if (!text) return false;
  return PERMISSION_PATTERNS.some((re) => re.test(text));
}
