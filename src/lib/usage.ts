// Message counts for the Usage panel. Everyone can read their own daily rows
// (RLS); usage_summary() returns everyone's totals, but only to admins listed
// in public.admins (migration 0005).

import type { SupabaseClient } from "@supabase/supabase-js";

export interface UsageRow {
  email: string;
  today: number;
  last7: number;
  last30: number;
  lastActive: string | null;
}

export interface Usage {
  own: { today: number; last7: number; last30: number };
  /** Everyone's usage, or null when the viewer is not an admin. */
  everyone: UsageRow[] | null;
}

const dayOffset = (d: Date, days: number) => new Date(d.getTime() - days * 86_400_000).toISOString().slice(0, 10);

/** Sums the viewer's own daily rows into today / 7-day / 30-day totals (UTC days, as Postgres stores them). */
export function summarizeOwn(rows: { day: string; messages: number }[], now = new Date()) {
  const today = dayOffset(now, 0);
  const week = dayOffset(now, 6);
  const month = dayOffset(now, 29);
  const own = { today: 0, last7: 0, last30: 0 };
  for (const r of rows) {
    if (r.day === today) own.today += r.messages;
    if (r.day >= week) own.last7 += r.messages;
    if (r.day >= month) own.last30 += r.messages;
  }
  return own;
}

export async function fetchUsage(db: SupabaseClient, now = new Date()): Promise<Usage> {
  const { data: rows, error } = await db.from("usage_daily").select("day, messages").gte("day", dayOffset(now, 29));
  if (error) throw new Error(error.message);
  const own = summarizeOwn((rows ?? []) as { day: string; messages: number }[], now);

  const { data: isAdmin } = await db.rpc("is_admin");
  if (isAdmin !== true) return { own, everyone: null };
  const { data: summary, error: sumError } = await db.rpc("usage_summary");
  if (sumError) throw new Error(sumError.message);
  const everyone = ((summary ?? []) as Record<string, unknown>[]).map((r) => ({
    email: String(r.email ?? ""),
    today: Number(r.today ?? 0),
    last7: Number(r.last_7_days ?? 0),
    last30: Number(r.last_30_days ?? 0),
    lastActive: (r.last_active as string) ?? null,
  }));
  return { own, everyone };
}
