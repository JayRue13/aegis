# Roadmap

Status: ✅ done · 🔨 in progress · ⏳ next · 💤 later

## Milestone 0: Foundation ✅
- ✅ Next.js 16 + TypeScript + Tailwind 4 app, ESLint, Vitest, Playwright
- ✅ CI (lint, typecheck, unit, build, browser tests, database RLS tests)
- ✅ Brand: star mark, dark/light design tokens, PWA icons
- ✅ Docs: architecture, decisions, deployment, progress log

## Milestone 1: Cloud chat MVP ✅ (code) / ⏳ (deployment needs Jay's accounts)
- ✅ Streaming chat with Markdown and code highlighting; stop, regenerate, edit
- ✅ Multi-provider gateway (OpenRouter free, Gemini, Groq, Ollama, custom), model picker
- ✅ Offline demo model
- ✅ Supabase auth (email link, optional OAuth), synced history with RLS, invite list
- ✅ Guest mode in localStorage; export/import; copy guest data to account
- ✅ Access-code mode, production lock, rate limiting, input validation, security headers
- ⏳ Deploy to Vercel + Supabase (see DEPLOYMENT.md)

## Milestone 2: Memory and workspaces 🔨
- ✅ Manual and “remember that …” memories, relevance-ranked injection
- ✅ Workspaces with instructions; conversation search
- ✅ Automatic memory extraction (on by default, toggle in Settings; runs only when the user shares something personal)
- ⏳ pgvector embeddings for memory + chat search (Gemini free embeddings)
- 💤 Memory editing and categories

## Milestone 3: Files and multimodal 🔨
- ✅ Text/code file context, image input for vision models
- ✅ PDF and DOCX text extraction
- ✅ Images in a private Supabase Storage bucket
- ⏳ Workspace knowledge files with retrieval
- ✅ Download a chat as Markdown
- ✅ Voice input (browser speech recognition)
- ✅ Read replies aloud
- 💤 Export as PDF/DOCX

## Milestone 4: Agents and tools 🔨
- ✅ Tool-calling agent loop (Agent mode) with step trace and approval cards for data changes
- ✅ Calculator and date/time tools
- ✅ URL reader (links in a message are fetched with SSRF protection)
- ✅ Web search (Wikipedia with no key, SearXNG or Brave optional)
- ✅ Specialist modes: Research, Code, Plan, Write (instruction presets)
- ✅ Sandboxed JavaScript runner for code blocks (in the browser, no network)
- 💤 Python runner (Pyodide); calendar/email integrations

## Milestone 5: Automation and sync 💤
- Scheduled tasks (Supabase cron / GitHub Actions), notifications
- Realtime sync of open chats across devices

## Milestone 6: Sharing and polish 💤
- ✅ Per-user daily message limit (admins exempt)
- Usage dashboard; admin panel; invite flow
- ✅ Tauri desktop and Capacitor mobile wrappers (store publishing needs Jay's developer accounts)
- ✅ Offline app shell for the installed PWA
- ✅ Accessibility audit (automated WCAG 2.1 AA scans)
- Monitoring, backups
