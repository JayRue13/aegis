# Decisions log

Newest first. Each entry: decision, why, and what would change it.

## 2026-10-09: Web search through context injection, not tool calling
Free models support function calling unevenly. AEGIS runs the search on the server when you turn it on (or in Research mode) and passes numbered results to the model as context, so it works with every model. Wikipedia is the default because it needs no key. Real tool calling can be added later for models that support it.

## 2026-10-09: Modes are instruction presets
Research, Code, Plan and Write modes are focused system instructions, plus automatic search in Research mode. They cost nothing and work with any model. Agents that act on their own with tools are a later milestone.

## 2026-10-09: Continue the new app instead of the Replit app
Jay chose to keep building the free, self-contained app rather than depend on Replit. Reviewing the old Replit app for prompts, features or the logo is optional and still to do.

## 2026-10-09: Link reader runs on the server with SSRF protection
Fetching on the server avoids browser CORS problems and costs nothing. To keep a public deployment from being used to probe private networks, it only allows http(s), checks every resolved IP at connect time (undici custom lookup), and limits redirects, size and time. It can be turned off with `AEGIS_LINK_READER=false`.

## 2026-10-09: Images in Supabase Storage
Replaces the earlier names-only approach. Images go in a private bucket under `<user>/<conversation>/` and are shown through one-hour signed URLs. Storage policies are tested in `supabase/tests/20_storage_test.sql`.

## 2026-10-09: Placeholder branding
No final logo or palette files were available. The star mark and colour tokens are placeholders inspired by the described direction (symmetrical, fluid, star-like, subtle accents), isolated so final assets replace them in one place. See docs/AUDIT.md.

## 2026-10-09: Start a fresh codebase (now the confirmed baseline)
No existing AEGIS code was reachable from this session (GitHub had only unrelated repos; Replit was connected after the session started). Jay asked for decisions to be made while he slept, so this repo was built as a working baseline. **When the Replit app is inventoried:** if it is a sensible, working AEGIS app, import it as a tagged baseline and decide per feature whether to port it here or move this work onto its stack. The deciding factor is what already works, not which is newer. **Update:** Jay later chose this app as the baseline; Replit is only mined for ideas/assets.

## 2026-10-09: Custom Next.js app instead of hosting Open WebUI
Only a custom app delivers the distinctive design, branding and multi-user product AEGIS aims for. Open WebUI also needs an always-on server. Ollama/Open WebUI remain usable as a model backend through `OLLAMA_BASE_URL`.

## 2026-10-09: Next.js 16 + React 19 + Tailwind 4, TypeScript
One codebase for web, installable PWA, and later Tauri/Capacitor wrappers. Free hosting on Vercel; `output: "standalone"` and a Dockerfile keep it portable.

## 2026-10-09: Supabase for auth, database and (later) storage and vectors
Free tier covers auth, Postgres with RLS, storage, pgvector and realtime in one service. Fallback: the app works fully without it in guest mode.

## 2026-10-09: Provider-agnostic gateway over OpenAI-compatible APIs, free models by default
Avoids lock-in and keeps cost at $0. OpenRouter is filtered to free models unless `OPENROUTER_ALLOW_PAID=true`.

## 2026-10-09: Client-side storage writes, stateless server
Signed-in users write to Supabase directly under RLS; the server only proxies model calls. Fewer moving parts and no server database credentials. Revisit when background agents need server-side access (will use a service role in a separate worker).

## 2026-10-09: Keyword memory retrieval first
No embedding API cost or extra infrastructure. Swap for pgvector embeddings when memory counts grow.

## Open (needs Jay)
- Licence (MIT vs AGPL vs keep private).
- Product domain name.
