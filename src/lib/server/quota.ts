// Optional per-user daily message limit (Supabase mode). Counts are kept in
// Postgres by the bump_usage() function, called with the user's own token.

type Env = Record<string, string | undefined>;

export type QuotaResult = { ok: true; used?: number; limit?: number } | { ok: false; used: number; limit: number };

export async function checkDailyQuota(
  user: { token?: string; email?: string },
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<QuotaResult> {
  const limit = Number(env.AEGIS_DAILY_MESSAGE_LIMIT ?? 0);
  if (!limit || !user.token || !env.NEXT_PUBLIC_SUPABASE_URL) return { ok: true };
  const admins = (env.AEGIS_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (user.email && admins.includes(user.email.toLowerCase())) return { ok: true };

  try {
    const res = await fetchImpl(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/bump_usage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${user.token}`,
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
        "Content-Type": "application/json",
      },
      body: "{}",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: true }; // fail open: a missing migration must not lock users out
    const used = Number(await res.json());
    return used > limit ? { ok: false, used, limit } : { ok: true, used, limit };
  } catch {
    return { ok: true };
  }
}
