import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchUsage, summarizeOwn } from "@/lib/usage";

const now = new Date("2026-10-10T12:00:00Z");

describe("summarizeOwn", () => {
  it("adds up today, the last 7 and the last 30 days", () => {
    const own = summarizeOwn(
      [
        { day: "2026-10-10", messages: 3 },
        { day: "2026-10-04", messages: 5 },
        { day: "2026-10-03", messages: 7 },
        { day: "2026-09-11", messages: 11 },
        { day: "2026-09-10", messages: 100 },
      ],
      now,
    );
    expect(own).toEqual({ today: 3, last7: 8, last30: 26 });
  });
});

function fakeDb(isAdmin: boolean) {
  const rpc = vi.fn(async (name: string) =>
    name === "is_admin"
      ? { data: isAdmin, error: null }
      : {
          data: [{ email: "a@x.com", today: 1, last_7_days: 2, last_30_days: 3, last_active: "2026-10-10" }],
          error: null,
        },
  );
  const query = { select: () => query, gte: async () => ({ data: [{ day: "2026-10-10", messages: 4 }], error: null }) };
  return { db: { from: () => query, rpc } as unknown as SupabaseClient, rpc };
}

describe("fetchUsage", () => {
  it("returns only the viewer's own counts for non-admins", async () => {
    const { db, rpc } = fakeDb(false);
    expect(await fetchUsage(db, now)).toEqual({ own: { today: 4, last7: 4, last30: 4 }, everyone: null });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("adds everyone's totals for admins", async () => {
    const { db } = fakeDb(true);
    const usage = await fetchUsage(db, now);
    expect(usage.everyone).toEqual([{ email: "a@x.com", today: 1, last7: 2, last30: 3, lastActive: "2026-10-10" }]);
  });
});
