// Decides who may use the server's model keys. Order of precedence:
// 1. Supabase configured  -> a valid signed-in user is required
//    (optionally limited to AEGIS_ALLOWED_EMAILS).
// 2. AEGIS_ACCESS_CODE set -> the request must carry the matching code.
// 3. Neither              -> open in development or demo mode only; a
//    production deployment with real keys refuses requests so a public URL
//    can never spend someone's quota.

import { timingSafeEqual } from "node:crypto";
import { demoEnabled } from "./providers";

type Env = Record<string, string | undefined>;

export type AccessResult =
  | { ok: true; identity: string; email?: string; userId?: string; token?: string; mode: AuthMode }
  | { ok: false; status: number; message: string; mode: AuthMode };

export type AuthMode = "supabase" | "access-code" | "open" | "locked";

export function authMode(env: Env = process.env): AuthMode {
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return "supabase";
  if (env.AEGIS_ACCESS_CODE) return "access-code";
  if (env.NODE_ENV === "production" && !demoEnabled(env)) return "locked";
  return "open";
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function allowedEmails(env: Env = process.env): string[] | null {
  const list = env.AEGIS_ALLOWED_EMAILS?.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list && list.length > 0 ? list : null;
}

export async function checkAccess(
  req: Request,
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<AccessResult> {
  const mode = authMode(env);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

  if (mode === "supabase") {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return { ok: false, status: 401, message: "Sign in to use AEGIS.", mode };
    try {
      const res = await fetchImpl(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return { ok: false, status: 401, message: "Your session expired. Sign in again.", mode };
      const user = (await res.json()) as { id: string; email?: string };
      const allow = allowedEmails(env);
      if (allow && !allow.includes((user.email ?? "").toLowerCase())) {
        return { ok: false, status: 403, message: "This account is not on the AEGIS invite list.", mode };
      }
      return { ok: true, identity: `user:${user.id}`, email: user.email, userId: user.id, token, mode };
    } catch {
      return { ok: false, status: 503, message: "Could not verify your session. Try again.", mode };
    }
  }

  if (mode === "access-code") {
    const code = req.headers.get("x-aegis-access-code") ?? "";
    if (!code || !safeEqual(code, env.AEGIS_ACCESS_CODE!)) {
      return { ok: false, status: 401, message: "Enter the AEGIS access code in Settings.", mode };
    }
    return { ok: true, identity: `code:${ip}`, mode };
  }

  if (mode === "locked") {
    return {
      ok: false,
      status: 503,
      message: "This deployment has no sign-in configured. Set AEGIS_ACCESS_CODE or Supabase keys.",
      mode,
    };
  }

  return { ok: true, identity: `ip:${ip}`, mode };
}

// Simple fixed-window rate limiter. Per-instance only, which is enough to stop
// runaway loops; a shared store can replace it when AEGIS has many users.
const windows = new Map<string, { start: number; count: number }>();

export function rateLimit(identity: string, perMinute: number, now = Date.now()): boolean {
  const w = windows.get(identity);
  if (!w || now - w.start >= 60_000) {
    windows.set(identity, { start: now, count: 1 });
    if (windows.size > 10_000) windows.clear();
    return true;
  }
  if (w.count >= perMinute) return false;
  w.count++;
  return true;
}

export function resetRateLimits() {
  windows.clear();
}
