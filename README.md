# AEGIS

A personal AI platform: streaming chat across multiple free model providers, persistent memory, workspaces, file and image attachments, and optional accounts with cross-device sync. Runs in any browser and installs on phones and desktops as an app (PWA).

**Cost to run: $0/month** on free tiers (Vercel Hobby + Supabase Free + free model APIs).

## Features (v0.1)

- **Chat** with streaming replies, Markdown, syntax-highlighted code with copy buttons, stop, regenerate and edit-and-resend.
- **Model picker** across OpenRouter (free models), Google Gemini, Groq, your own Ollama, or any OpenAI-compatible endpoint. Keys stay on the server.
- **Offline demo model** so the app works before any key is added.
- **Memory**: say “remember that …” or add facts in the Memory panel; the most relevant ones are added to each conversation.
- **Workspaces** with their own instructions (like project folders).
- **Attachments**: text and code files are added as context; images go to vision models.
- **History**: conversations grouped by date, pin, rename, delete, full-text search.
- **Accounts (optional)**: Supabase email sign-in, synced history, row-level security, invite list.
- **Protection**: shared access code mode, per-user rate limiting, production lock when no sign-in is configured.
- **Your data**: JSON export and import, copy guest chats into your account.
- Dark and light themes, mobile layout, installable PWA, security headers.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional: add a free model key
npm run dev                  # http://localhost:3000
```

With no keys, AEGIS runs in demo mode. Add `GEMINI_API_KEY`, `GROQ_API_KEY` or `OPENROUTER_API_KEY` for real answers.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run check` | Lint, typecheck and unit tests |
| `npm run test:e2e` | Browser tests (desktop + mobile) against a production build |
| `scripts/test-db.sh` | Applies the Supabase schema to a scratch Postgres and tests row-level security |

## Docs

- [Deployment guide](docs/DEPLOYMENT.md): Vercel + Supabase, step by step
- [Architecture](docs/ARCHITECTURE.md)
- [Decisions log](docs/DECISIONS.md)
- [Roadmap](docs/ROADMAP.md)
- [Progress log](docs/PROGRESS.md)
