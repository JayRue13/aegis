# Decisions log

Newest first. Each entry: decision, why, and what would change it.

## 2026-10-09: Start a fresh codebase
No existing AEGIS code was reachable (GitHub had only unrelated repos; Replit and PC code not accessible). Started fresh; any older code can be merged in later.

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

## 2026-10-09: Images stored as names only in Supabase
Base64 images would exhaust the 500 MB free database. Moving images to Supabase Storage is on the roadmap. Guest mode keeps images locally until storage fills, then drops image data.

## Open (needs Jay)
- Licence (MIT vs AGPL vs keep private).
- Product domain name.
