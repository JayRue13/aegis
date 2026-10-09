import { beforeEach, describe, expect, it, vi } from "vitest";
import { authMode, checkAccess, rateLimit, resetRateLimits } from "@/lib/server/access";

const req = (headers: Record<string, string> = {}) => new Request("http://x/api/chat", { headers });
const SUPA = { NEXT_PUBLIC_SUPABASE_URL: "https://p.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" };

describe("authMode", () => {
  it("picks the strongest configured mode", () => {
    expect(authMode({ ...SUPA, AEGIS_ACCESS_CODE: "c" })).toBe("supabase");
    expect(authMode({ AEGIS_ACCESS_CODE: "c" })).toBe("access-code");
    expect(authMode({ NODE_ENV: "development", GROQ_API_KEY: "k" })).toBe("open");
    expect(authMode({ NODE_ENV: "production" })).toBe("open"); // demo only, nothing to protect
  });

  it("locks production deployments that have real keys but no sign-in", () => {
    expect(authMode({ NODE_ENV: "production", GROQ_API_KEY: "k" })).toBe("locked");
  });
});

describe("checkAccess", () => {
  it("requires a matching access code", async () => {
    const env = { AEGIS_ACCESS_CODE: "s3cret" };
    expect((await checkAccess(req(), env)).ok).toBe(false);
    expect((await checkAccess(req({ "x-aegis-access-code": "wrong" }), env)).ok).toBe(false);
    expect((await checkAccess(req({ "x-aegis-access-code": "s3cret" }), env)).ok).toBe(true);
  });

  it("refuses locked deployments", async () => {
    const r = await checkAccess(req(), { NODE_ENV: "production", GROQ_API_KEY: "k" });
    expect(r).toMatchObject({ ok: false, status: 503 });
  });

  it("verifies Supabase tokens and the invite list", async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const auth = (init.headers as Record<string, string>).Authorization;
      if (auth === "Bearer good") return Response.json({ id: "u1", email: "Jay@Example.com" });
      if (auth === "Bearer other") return Response.json({ id: "u2", email: "stranger@example.com" });
      return new Response("bad", { status: 401 });
    }) as unknown as typeof fetch;
    const env = { ...SUPA, AEGIS_ALLOWED_EMAILS: "jay@example.com" };

    expect(await checkAccess(req(), env, fetchImpl)).toMatchObject({ ok: false, status: 401 });
    expect(await checkAccess(req({ authorization: "Bearer bad" }), env, fetchImpl)).toMatchObject({
      ok: false,
      status: 401,
    });
    expect(await checkAccess(req({ authorization: "Bearer other" }), env, fetchImpl)).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(await checkAccess(req({ authorization: "Bearer good" }), env, fetchImpl)).toMatchObject({
      ok: true,
      userId: "u1",
    });
  });
});

describe("rateLimit", () => {
  beforeEach(() => resetRateLimits());
  it("allows N per minute then blocks until the window resets", () => {
    const t = 1_000_000;
    expect(rateLimit("a", 2, t)).toBe(true);
    expect(rateLimit("a", 2, t + 1)).toBe(true);
    expect(rateLimit("a", 2, t + 2)).toBe(false);
    expect(rateLimit("b", 2, t + 2)).toBe(true);
    expect(rateLimit("a", 2, t + 60_001)).toBe(true);
  });
});
