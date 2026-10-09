// Automatic memory: decides when a turn is worth learning from and parses the
// model's answer into clean, de-duplicated facts.

const PERSONAL = /\b(i|i'm|im|i've|i'd|i'll|my|mine|me|we|our)\b/i;

/** Cheap gate so the extra model call only runs when the user shared something about themselves. */
export function worthLearning(userText: string): boolean {
  const t = userText.trim();
  if (t.length < 20 || t.length > 4000) return false;
  if (/^\s*(?:please\s+)?(?:remember|keep in mind)\b/i.test(t)) return false; // handled explicitly
  return PERSONAL.test(t);
}

export const LEARN_PROMPT = `You extract durable facts about the USER from one chat exchange, for a personal assistant's long-term memory.
Only include facts that will still be useful in future conversations: identity, preferences, goals, ongoing projects, skills, constraints, relationships, schedule patterns.
Exclude: one-off requests, facts about the world, anything the assistant said, sensitive data (passwords, financial or health details, government ids), and facts already in EXISTING.
Write each fact as a short third-person sentence starting with "User" or the user's name, e.g. "User is studying computer science".
Respond with ONLY a JSON array of strings, at most 3 items. Respond [] if nothing qualifies.`;

/** Pulls a JSON string array out of a model reply, tolerating code fences and prose. */
export function parseFacts(reply: string): string[] {
  const match = reply.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim().replace(/\s+/g, " "))
      .filter((s) => s.length >= 8 && s.length <= 300)
      .slice(0, 3);
  } catch {
    return [];
  }
}

function norm(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/^(the )?user('s)?\s+/, "")
      .match(/[a-z0-9]+/g) ?? [],
  );
}

/** Jaccard similarity between two facts' word sets. */
export function similarity(a: string, b: string): number {
  const x = norm(a);
  const y = norm(b);
  if (x.size === 0 || y.size === 0) return 0;
  let inter = 0;
  for (const w of x) if (y.has(w)) inter++;
  return inter / (x.size + y.size - inter);
}

/** Drops facts that duplicate existing memories or each other. */
export function dedupeFacts(facts: string[], existing: string[], threshold = 0.6): string[] {
  const kept: string[] = [];
  for (const f of facts) {
    if ([...existing, ...kept].some((e) => similarity(e, f) >= threshold)) continue;
    kept.push(f);
  }
  return kept;
}
