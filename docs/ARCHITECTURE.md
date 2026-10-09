# Architecture

```
Browser (Next.js client, PWA)
 ├─ UI: AegisApp → Sidebar, MessageItem, Composer, panels
 ├─ ChatStore ─┬─ LocalStore (localStorage, guest mode)
 │             └─ SupabaseStore (Postgres via supabase-js, RLS) ── Supabase
 └─ POST /api/chat (NDJSON stream) ─┐
                                    ▼
Next.js route handlers (Vercel functions / Node server)
 ├─ access.ts   who may spend model quota (Supabase JWT / access code / lock)
 ├─ schema.ts   zod validation and size limits
 ├─ prompt.ts   system prompt, memory + workspace injection, attachments
 ├─ gateway.ts  provider call, SSE → NDJSON, readable errors, demo model
 └─ providers.ts registry from env, model discovery (/models), free filter
                                    │
                                    ▼
      OpenRouter · Gemini · Groq · Ollama · any OpenAI-compatible API
```

## Key ideas

- **One provider adapter.** Every supported provider speaks the OpenAI chat-completions protocol, so `gateway.ts` has a single code path. Adding a provider is a few lines in `providers.ts`.
- **Model ids are `provider:model`**, e.g. `openrouter:meta-llama/llama-3.3-70b-instruct:free`. Only the first colon splits.
- **Storage lives in the browser layer.** The client writes through a `ChatStore`. Guests use localStorage; signed-in users write directly to Supabase, where row-level security (not the app server) guarantees isolation. The server stays stateless and cheap.
- **The server only proxies model calls**, so API keys never reach the browser. `/api/chat` receives the conversation, the user's memories and the workspace, builds the prompt, and streams NDJSON events (`delta`, `error`, `done`).
- **Memory retrieval** is keyword-based (`memory.ts`): recent facts plus the most relevant ones, capped by count and characters. The interface allows swapping in embeddings later.
- **Security defaults.** Production with real keys and no sign-in configured refuses all chat requests (`locked`). Supabase mode verifies the user's JWT on every request and can enforce an invite list. Inputs are validated and size-limited. A per-identity rate limit stops runaway loops.

## Data model (Supabase)

`projects`, `conversations`, `messages`, `memories`, all with `user_id` defaulting to `auth.uid()` and a single "own rows" RLS policy. A trigger prevents attaching messages to someone else's conversation. See `supabase/migrations/0001_init.sql`; `scripts/test-db.sh` proves the policies.

## Layout

```
src/app            routes: page, layout, manifest, api/{chat,models,health}
src/components     UI
src/lib            shared logic (memory, prompt, chat-client, util, types)
src/lib/server     server-only logic (providers, gateway, access, schema, sse)
src/lib/store      ChatStore interface + local and Supabase implementations
supabase/          migrations and RLS tests
tests/ e2e/        vitest unit tests, Playwright browser tests
```
