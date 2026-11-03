import type { HistoryMap, HistoryMessage } from "./types";

export interface PruneHistoryOptions {
  /** Maximum number of sessions to keep (keepIds are always preserved). */
  maxSessions: number;
  /** Maximum approximate serialized size in bytes (keepIds are preserved). */
  maxBytes: number;
  /** Session ids that must never be dropped (active view, pinned, current). */
  keepIds?: string[];
}

interface HistoryEntry {
  id: string;
  messages: HistoryMessage[];
  updated: number;
  size: number;
}

function lastTimestamp(messages: HistoryMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const ts = messages[i]?.timestamp;
    if (typeof ts === "number" && ts > 0) return ts;
  }
  return 0;
}

function serializedSize(messages: HistoryMessage[]): number {
  try {
    return new TextEncoder().encode(JSON.stringify(messages)).length;
  } catch {
    return 0;
  }
}

/**
 * Bound the persisted chat history by session count and approximate size.
 * Active and pinned sessions are always retained, even when they alone exceed
 * the configured limits, so the open chat never loses its messages.
 */
export function pruneHistoryMap(
  histories: HistoryMap,
  opts: PruneHistoryOptions
): HistoryMap {
  const keepIds = new Set((opts.keepIds ?? []).filter(Boolean));
  const entries: HistoryEntry[] = Object.entries(histories).map(
    ([id, messages]) => ({
      id,
      messages,
      updated: lastTimestamp(messages),
      size: serializedSize(messages),
    })
  );

  const byNewest = (a: HistoryEntry, b: HistoryEntry) => b.updated - a.updated;
  const kept = entries.filter((e) => keepIds.has(e.id)).sort(byNewest);
  const rest = entries.filter((e) => !keepIds.has(e.id)).sort(byNewest);

  const result: HistoryMap = {};
  let count = 0;
  let bytes = 0;

  for (const entry of kept) {
    result[entry.id] = entry.messages;
    count++;
    bytes += entry.size;
  }

  const maxSessions = Math.max(1, Math.trunc(opts.maxSessions) || 1);
  const maxBytes = Math.max(0, opts.maxBytes) || 0;
  for (const entry of rest) {
    if (count >= maxSessions) break;
    if (maxBytes > 0 && bytes + entry.size > maxBytes) continue;
    result[entry.id] = entry.messages;
    count++;
    bytes += entry.size;
  }

  return result;
}
