import { describe, expect, it, vi } from "vitest";
import { checkDailyQuota } from "@/lib/server/quota";

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://p.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  AEGIS_DAILY_MESSAGE_LIMIT: "3",
};
const returning = (n: number | string, status = 200) =>
  vi.fn(async () => new Response(String(n), { status })) as unknown as typeof fetch;

describe("checkDailyQuota", () => {
  it("is off without a limit or a signed-in user", async () => {
    const f = returning(99);
    expect(await checkDailyQuota({ token: "t" }, { ...env, AEGIS_DAILY_MESSAGE_LIMIT: "" }, f)).toEqual({ ok: true });
    expect(await checkDailyQuota({}, env, f)).toEqual({ ok: true });
    expect(f).not.toHaveBeenCalled();
  });

  it("allows up to the limit, then blocks", async () => {
    expect(await checkDailyQuota({ token: "t" }, env, returning(3))).toEqual({ ok: true, used: 3, limit: 3 });
    expect(await checkDailyQuota({ token: "t" }, env, returning(4))).toEqual({ ok: false, used: 4, limit: 3 });
  });

  it("calls bump_usage with the user's token", async () => {
    const f = returning(1);
    await checkDailyQuota({ token: "user-jwt" }, env, f);
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toBe("https://p.supabase.co/rest/v1/rpc/bump_usage");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer user-jwt");
  });

  it("exempts admins and fails open on errors", async () => {
    const f = returning(100);
    expect(
      await checkDailyQuota({ token: "t", email: "Jay@x.com" }, { ...env, AEGIS_ADMIN_EMAILS: "jay@x.com" }, f),
    ).toEqual({ ok: true });
    expect(await checkDailyQuota({ token: "t" }, env, returning("missing", 404))).toEqual({ ok: true });
  });
});
