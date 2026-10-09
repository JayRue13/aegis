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
- 💤 Export as PDF/DOCX; spoken replies

## Milestone 4: Agents and tools ⏳
- Tool-calling framework in the gateway
- ✅ URL reader (links in a message are fetched with SSRF protection)
- Web search (free tier: Brave/Tavily/SearXNG)
- Specialist modes: research, coding, planning
- 💤 Sandboxed code execution; calendar/email integrations

## Milestone 5: Automation and sync 💤
- Scheduled tasks (Supabase cron / GitHub Actions), notifications
- Realtime sync of open chats across devices

## Milestone 6: Sharing and polish 💤
- Per-user quotas and usage dashboard; admin panel; invite flow
- Tauri desktop and Capacitor mobile wrappers
- Accessibility audit, monitoring, backups
