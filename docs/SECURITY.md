# Security notes

## Protections in place
- **Secrets stay on the server.** Model keys are only read by route handlers in `src/lib/server`. The browser receives only the Supabase anon key, which is public by design and protected by row-level security.
- **Who can spend quota.** Supabase JWTs are verified on every request, with an optional invite list (`AEGIS_ALLOWED_EMAILS`). Without Supabase, a shared access code compared in constant time is used. A production deployment with model keys and no sign-in configured refuses requests. There is also a per-identity rate limit and an optional daily cap per user.
- **Data isolation.** Every table and the image bucket use "own rows only" RLS policies. A trigger blocks attaching messages to someone else's conversation. `scripts/test-db.sh` proves all of this, and its tests fail if a policy is removed.
- **Input limits.** Requests are validated with zod (sizes, counts, image types). Uploads are capped at 4 MB, and document types are checked by their magic bytes.
- **Link reader (SSRF).** Only http(s) links are followed. Every resolved IP is checked at connect time, so DNS rebinding can't reach private, loopback, link-local, CGNAT or cloud-metadata addresses. Links with embedded credentials are refused. Fetches are limited to 3 redirects, 2 MB and 8 s.
- **Rendering.** Model output is Markdown without raw HTML. `javascript:` links are stripped. Images in model output are shown as links and never loaded, which stops data exfiltration through prompt-injected image URLs.
- **Headers.** In production: a strict CSP (scripts limited to this origin, connections limited to this origin plus Supabase), `frame-ancestors 'none'`, HSTS, COOP, `nosniff`, and a strict referrer policy.

## Known, accepted issues
- `npm audit` lists `sprintf-js` (moderate) through `mammoth` → `argparse`. That code is only used by mammoth's command-line tool, which AEGIS never runs.
- `npm audit` lists `braces` (high) through the ESLint plugin. It's a development tool only, run on our own code.
- The rate limiter is in memory, so it applies per server instance. The daily cap in Postgres is the shared limit.
- The CSP allows `'unsafe-inline'` scripts because Next.js inlines bootstrap scripts. Moving to nonces is possible later.

## Reporting
Email the owner (see the GitHub profile) instead of opening a public issue.

## Paid-model guard
The model picker lists only free OpenRouter models, and the server enforces the same rule: `resolveProvider` rejects any OpenRouter model that isn't `:free` or the free router (HTTP 403), unless `OPENROUTER_ALLOW_PAID=true` is set or the model is pinned in `OPENROUTER_MODELS`. A client therefore can't spend account credit by sending a paid model id directly.
