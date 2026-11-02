import type VaultAgentsPlugin from "../../main";
import type { SessionInfo } from "../../core/types";

export async function fetchDisplayedSessions(
  plugin: VaultAgentsPlugin,
  viewSession: string,
  fallbackEngine: string
): Promise<SessionInfo[]> {
  const providers = plugin.registry.getAll();
  const results = await Promise.allSettled(
    providers.map((p) => p.listSessions())
  );
  const all: SessionInfo[] = [];
  const seen = new Set<string>();

  results.forEach((res, i) => {
    if (res.status === "fulfilled") {
      const providerId = providers[i].id;
      for (const s of res.value) {
        if (!seen.has(s.id)) {
          seen.add(s.id);
          const engine = s.engine || providerId;
          all.push({ ...s, engine });
          if (!plugin.settings.sessionEngines) {
            plugin.settings.sessionEngines = {};
          }
          if (!plugin.settings.sessionEngines[s.id]) {
            plugin.settings.sessionEngines[s.id] = engine;
          }
        }
      }
    }
  });

  all.sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0));
  const pinnedSet = new Set(plugin.settings.pinned ?? []);
  const pinned = all.filter((s) => pinnedSet.has(s.id));
  const recent = all.filter((s) => !pinnedSet.has(s.id)).slice(0, 20);
  const displayed = [...pinned, ...recent];

  // Always include the currently active session so its name is shown
  const hasActive = displayed.some((s) => s.id === viewSession);
  if (viewSession && !hasActive) {
    const found = all.find((s) => s.id === viewSession);
    if (found) {
      displayed.push(found);
    } else {
      const hist = plugin.getHistory(viewSession);
      const firstUser = hist.find(
        (m) => m.role === "user" && m.text.trim()
      );
      const fallbackTitle = firstUser
        ? firstUser.text.trim().replace(/\s+/g, " ").slice(0, 40)
        : viewSession;
      displayed.push({
        id: viewSession,
        title: fallbackTitle,
        updated: Date.now(),
        engine: fallbackEngine,
      });
    }
  }

  return displayed;
}

export function buildLocalContinuationPrompt(
  plugin: VaultAgentsPlugin,
  sessionId: string,
  assistantLabel: string
): string {
  const history = plugin.getHistory(sessionId);
  const recent = history.slice(-24);
  if (recent.length === 0) {
    return plugin.t(
      "The previous session has no saved history. " +
        "Continue the work from here."
    );
  }
  const lines: string[] = [];
  for (const rec of recent) {
    const who = rec.role === "user" ? plugin.t("User") : assistantLabel;
    const text =
      rec.text.length > 800 ? rec.text.slice(0, 800) + "…" : rec.text;
    lines.push(`${who}: ${text}`);
  }
  return (
    plugin.t("[RECENT HISTORY OF THE PREVIOUS SESSION]") +
    "\n" +
    lines.join("\n\n") +
    "\n\n---\n\n" +
    plugin.t(
      "Continue the work from here, keeping the context above in mind."
    )
  );
}
