export function uid(): string {
  return globalThis.crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Derives a short conversation title from the first user message. */
export function deriveTitle(text: string, max = 48): string {
  const clean = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*_`>\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "New chat";
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd() + "…";
}

/** Groups items by recency bucket for the sidebar. */
export function recencyGroup(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= startOfToday) return "Today";
  if (t >= startOfToday - 86_400_000) return "Yesterday";
  if (t >= startOfToday - 7 * 86_400_000) return "Previous 7 days";
  if (t >= startOfToday - 30 * 86_400_000) return "Previous 30 days";
  return "Older";
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
