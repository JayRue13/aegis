# Progress log

Newest first. Each entry records what changed and how it was verified.

## 2026-10-09: v0.1.0, cloud chat MVP built from scratch

**Context.** Audit found no existing AEGIS code (GitHub had only `bidforge` and `my-first-repo`; Replit/PC code not reachable). Jay approved starting fresh with a custom app.

**Built**
- Next.js 16 app with the full chat experience, model gateway, memory, workspaces, attachments, settings, guest and Supabase storage (see README feature list).
- Supabase schema with row-level security, plus a Postgres test harness.
- CI workflow, Dockerfile, env template, deployment guide.

**Verified**
- `npm run lint`, `npm run typecheck`: clean.
- 44 unit tests pass: memory ranking and "remember that" parsing, prompt building, SSE parsing across chunk boundaries, provider discovery and free-model filter, end-to-end streaming against a fake OpenAI-compatible server, error mapping, access control (access code, Supabase token + invite list, production lock), rate limiting, local storage including quota fallback, backup round trip.
- 8 Playwright tests pass on desktop and mobile viewports against the production build: send and stream, persistence across reload, “remember that” creates a memory, workspaces, health endpoint exposes no secrets.
- Supabase migration applied twice to Postgres 16 (idempotent); RLS tests prove users cannot read, modify, delete or plant each other's data, and the tests fail if RLS is removed.
- Standalone server bundle boots and serves security headers.

**Not verified (needs accounts)**: real calls to OpenRouter/Gemini/Groq (no keys in the build environment; the shared code path is tested against a fake provider), Supabase auth emails, Vercel deployment.
