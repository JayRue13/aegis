// Lightweight long-term memory helpers. Retrieval uses keyword overlap so it
// runs anywhere at no cost; a vector index can replace `rankMemories` later
// without changing callers.

import type { Memory } from "./types";

const STOP = new Set(
  "a an and are as at be but by for from has have i i'm im in is it its me my of on or our so that the their them they this to was we were what when where which who why will with you your about can do does how".split(
    " ",
  ),
);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9'+#.-]*/g) ?? [])
    .map((t) => t.replace(/['.]+$/g, ""))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

export function stem(t: string): string {
  return t.replace(/(ing|ed|es|s)$/, "");
}

/** Scores how relevant a memory is to a query (0 = unrelated). */
export function scoreMemory(memory: string, query: string): number {
  const q = new Set(tokenize(query).map(stem));
  if (q.size === 0) return 0;
  const m = tokenize(memory).map(stem);
  let hits = 0;
  for (const t of new Set(m)) if (q.has(t)) hits++;
  return hits / Math.sqrt(m.length + 1);
}

/**
 * Picks the memories to include in a prompt: the most relevant ones to the
 * query, topped up with the most recent ones so core facts are always present.
 */
export function selectMemories(
  memories: Memory[],
  query: string,
  { maxTotal = 12, recent = 4, maxChars = 4000 } = {},
): Memory[] {
  if (memories.length <= maxTotal) return capChars(memories, maxChars);

  const byRecency = [...memories].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const chosen = new Map<string, Memory>();
  for (const m of byRecency.slice(0, recent)) chosen.set(m.id, m);

  const ranked = memories
    .map((m) => ({ m, s: scoreMemory(m.content, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  for (const { m } of ranked) {
    if (chosen.size >= maxTotal) break;
    chosen.set(m.id, m);
  }
  return capChars([...chosen.values()], maxChars);
}

function capChars(memories: Memory[], maxChars: number): Memory[] {
  const out: Memory[] = [];
  let used = 0;
  for (const m of memories) {
    if (used + m.content.length > maxChars) break;
    out.push(m);
    used += m.content.length;
  }
  return out;
}

// Captures the first sentence after "remember (that)", e.g. "Remember that I
// study CS. Can you…" -> "I study CS".
const REMEMBER =
  /^\s*(?:please\s+)?(?:remember|keep in mind)\s+(?:that\s+)?(?!(?:to|when|what|how|why|where|who|if|me|this|the time)\b)(.+?)(?:[.!?](?:\s|$)|\n|$)/i;

/** Detects explicit "remember that …" requests and returns the fact to save. */
export function extractRememberRequest(text: string): string | null {
  const m = text.match(REMEMBER);
  if (!m) return null;
  const fact = m[1].trim();
  if (fact.length < 3 || fact.length > 500) return null;
  return fact.charAt(0).toUpperCase() + fact.slice(1);
}
