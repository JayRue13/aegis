# Progress log

Newest first. Each entry records what changed and how it was verified.

## 2026-10-10: Memory editing
- The Memory panel now edits memories in place (pencil button, Enter saves, Escape cancels without closing the dialog) and shows a filter box once there are 6 or more. Edits reuse the stores' existing upsert, so they sync for signed-in users with no schema change.
- Categories stay on the roadmap: they need a schema change and a UI decision, and filtering covers the main need for now.

**Verified**
- `npm run check` and `npm run build` pass.
- 35 browser tests pass, 1 skipped by design (new on desktop and mobile: add 6 memories, cancel an edit with Escape, save an edit, filter, and see the edit survive a reload).
## 2026-10-31: Security upgrade and CI runner pin
- Next.js 16.4.0 → 16.4.3 (GHSA-2464-fhr4-w9xw and GHSA-673q-mjm6-r5xr, critical unauthenticated RCE; GHSA-p3m5-59mp-jv5r, DoS). `next build` had started refusing to run on 16.4.0. zod → 4.6.7 and undici → 7.30.1 for their high-severity advisories. `npm audit --omit=dev`: 0 vulnerabilities. A moderate minimatch advisory remains in the dev-only lint toolchain.
- CI pinned to `ubuntu-24.04`: GitHub's `ubuntu-latest` moved to 26.04, where Playwright 1.56 cannot install Chromium, so every PR's `check` job failed before running browser tests.

**Verified**
- `npm run check`, `npm run build` and the browser suite pass locally on the upgraded versions.

## 2026-10-10: Workspace knowledge files
- Workspaces can hold knowledge files (text, Markdown, PDF, Word). For each message, the most relevant excerpts (BM25 over ~1,200-character overlapping chunks, capped at ~8,000 characters) go into the system prompt, marked as information rather than instructions. Small workspaces are sent whole.
- Storage: localStorage for guests; a new `knowledge_files` table for signed-in users, with row-level security, a trigger that blocks attaching files to someone else's workspace, and cascade delete with the workspace. Backups include knowledge files.

**Verified**
- 97 unit tests pass (new: chunking, selection, LocalStore knowledge and backup, prompt section).
- Database tests pass, including the new `40_knowledge_test.sql`: owners see their files; other users can't read, plant or delete them; deleting a workspace removes its files.
- 35 browser tests pass, 1 skipped by design. New on desktop and mobile: upload a file to a workspace, the reply shows the model received it, the file is still there after reload, and it can be removed.

## 2026-10-09: v0.6.0, Agent mode, offline app, desktop and mobile shells
- **Agent mode** (src/lib/server/agent.ts): an OpenAI-style tool-calling loop on the server with web search, page reading, an exact calculator (src/lib/calc.ts, no eval) and date/time. Saving memories and creating workspaces are proposals shown as approval cards; nothing changes until the user clicks Approve, and the decision is stored with the message (also in Supabase). Up to 5 tool rounds; models that reject tools fall back to a plain answer with a note.
- **Offline**: the service worker now caches the app shell and build assets, so the installed app opens without a connection and saved chats on the device stay readable. An offline banner appears and sending is paused until the connection returns.
- **Desktop** (desktop/, Tauri 2) and **mobile** (mobile/, Capacitor 8 with Android and iOS projects) shells that open the hosted AEGIS. New on-demand GitHub Actions workflow (.github/workflows/apps.yml) builds the Windows installer and Android APK without Jay installing any tools. Guide: docs/APPS.md.

**Verified**
- 90 unit tests pass (new: calculator, every tool, the streamed tool-call loop with arguments split across chunks, the no-tools fallback, the round limit).
- 31 browser tests pass, 1 skipped by design (new on desktop and mobile: Agent mode runs the calculator, shows the approval card, saves nothing before Approve, and keeps the decision after reload; offline reload shows the banner and still opens a saved chat). The fake provider now streams tool calls.
- Desktop: `tauri build` compiles the app here into a 1.35 MB Linux package, and the app starts and stays running under a virtual display (setup page, menu and native shell work without crashing).
- Capacitor: `cap add android`, `cap add ios` and `cap sync` succeed; the committed native projects contain no server address.

**Blocked here**: the Android APK can't be compiled in this environment because Google's download servers are blocked by its network policy. The Apps workflow builds it on GitHub instead.

## 2026-10-09: Security and accessibility pass
- axe-core WCAG 2.1 A/AA scans were added to the browser tests (home, chat and settings; dark and light; desktop and mobile). The first run found low-contrast "faint" text in the mobile drawer and settings, so the colour was raised to at least 4.5:1. All scans now pass.
- Dialogs: focus moves into the dialog, stays trapped while it's open, and returns to the trigger on close. A browser test covers this.
- Model output can no longer load remote images (an exfiltration risk via prompt injection), and raw HTML and `javascript:` links are confirmed blocked (3 jsdom tests).
- A production CSP was added, and a browser test confirms it causes no violations during a chat.
- Dependency audit: two advisories, both unreachable from AEGIS code (details in docs/SECURITY.md).
- Totals: 78 unit tests and 28 browser tests (1 skipped by design on mobile).

## 2026-10-09: v0.5. Per-user daily limits
- Built: migration `0003_usage.sql` (the `usage_daily` table and `bump_usage()`), `src/lib/server/quota.ts`, and a check in `/api/chat`.
- Verified: 75 unit tests and 20 browser tests pass. New database tests confirm the counter increments, users can't edit or reset their own counts, and users can't see each other's usage.

## 2026-10-09: v0.4. Modes, web search, custom instructions, read aloud

**Built**
- A mode picker in the composer (Chat, Research, Code, Plan, Write) and a web search toggle. Results show up as source chips.
- Server-side search (`src/lib/server/search.ts`) through SearXNG, Brave or Wikipedia, with numbered results for citation.
- Custom instructions in Settings. Read-aloud on replies using `speechSynthesis`.
- Fixes: the global focus ring overrode the composer's styles, and the toolbar overflowed on narrow phones.

**Verified**
- 71 unit tests pass. New ones cover provider selection, parsing for Wikipedia, SearXNG and Brave, error handling, query cleanup, and the mode and instruction prompt sections.
- 20 browser tests pass. A new end-to-end check confirms Research mode searches through a fake SearXNG, sends the results and the mode instructions to the model, and shows the sources.

**Not verified:** live Wikipedia and Brave calls, because the build sandbox has no internet.

## 2026-10-09: v0.3, links, voice, cloud images

Jay chose to continue with this app rather than the Replit one (see DECISIONS.md).

**Built**
- Link reader. URLs in a message are fetched by the server with SSRF protection, turned into text and added as context. The reply shows chips for the pages read or refused.
- Voice input using the Web Speech API, with interim transcript display.
- A private Supabase Storage bucket for images, with signed URLs for display and cleanup when a chat is deleted.

**Verified**
- 63 unit tests pass. New ones cover private-IP detection (IPv4, IPv6 and mapped addresses), URL finding, HTML to text, fetching and redirects, blocking by IP and by hostname (DNS), and refusing credentials and non-http schemes. Image upload, signing and cleanup are checked against a fake Supabase client.
- 18 browser tests pass. New ones check that the link reader refuses a private address in the production build and shows why, and that voice input fills the message box.
- Database tests pass. The storage policies keep each user inside their own folder.

**Not verified:** a real Supabase Storage bucket, and fetching real public websites. The build sandbox has no direct internet access.

## 2026-10-09: v0.2, documents, learned memory, export

**Built**
- PDF and Word (.docx) attachments: server-side text extraction (`/api/extract`, unpdf + mammoth), magic-byte checks, 4 MB limit, page markers.
- Automatic memory: after a reply, if the user shared something personal, one short call to the same model extracts up to 3 lasting facts, de-duplicated against existing memories (`/api/memory/extract`). Toggle in Settings.
- Download any chat as Markdown.
- Browser tests now also run against a fake OpenAI-compatible provider, so the real provider path (not just demo mode) is tested end to end.

**Verified**
- 52 unit tests pass (new: PDF/DOCX extraction on generated files, fact parsing and de-duplication, Markdown export).
- 14 browser tests pass on desktop and mobile (new: PDF upload becomes context, fake PDF rejected with a clear message, provider streaming + memory injection + automatic learning).

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
