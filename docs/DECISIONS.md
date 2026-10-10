# Decisions log

Newest first. Each entry: decision, why, and what would change it.

## 2026-10-10: Admins for the usage page are listed in the database
`usage_summary()` returns everyone's message counts only when the caller's email is in `public.admins`, a table no user can read or write through the API. This keeps AEGIS free of Supabase's service-role key, which would bypass row-level security if it leaked. Cost: Jay adds his email once in the SQL editor, separate from `AEGIS_ADMIN_EMAILS` (which only exempts people from the daily limit). Messages are now counted for every signed-in user, without slowing the chat when no limit is set, so the page has data. Would change if a single admin setting becomes worth a server-side key, or Jay picks another option on the decision card.

## 2026-10-09: Agent tools that change data need approval
Read-only tools (search, read a page, calculator, date) run automatically. Tools that change the user's data only propose the change; the browser shows an approval card and applies it on Approve. This keeps prompt-injected pages from silently writing memories or creating workspaces. Tools run on the server for at most 5 rounds per reply.

## 2026-10-09: Desktop and mobile apps load the hosted site
The Tauri (desktop) and Capacitor (Android/iOS) shells open the user's AEGIS deployment instead of bundling a copy, because the app needs its server routes for models and keys. One deployment updates every platform at once, and no native permissions are granted to the remote page. Builds run on demand in GitHub Actions (free minutes) rather than on Jay's PC.

## 2026-10-09: Daily limits counted in Postgres, failing open
`bump_usage()` is a security-definer function that each user calls with their own token, so the server needs no service-role key and users cannot reset their own count. If the counter is missing or unreachable, chat still works. The limit protects quota; it is not a security boundary.

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
