# AEGIS audit (2026-10-09)

Labels: **Observed** (checked directly) · **Inferred** (reasoned from evidence) · **Proposed** (recommendation) · **Blocked** (cannot check yet).

## Existing code and infrastructure
- **Observed:** GitHub account JayRue13 has two repos: `bidforge` (unrelated static estimator site on GitHub Pages) and `my-first-repo` (README only). Neither mentions AEGIS.
- **Observed:** The project files held only a context document and a handoff document. Neither contained code, logo files or deployment URLs.
- **Observed:** The only folder linked from Jay's PC is "Game Merging", which isn't AEGIS.
- **Blocked:** Replit. Jay connected it after this audit's session started, so this session couldn't read it. A new session or a ZIP export is needed.
- **Inferred:** Any earlier AEGIS web app lives on Replit. The local stack (Ollama 0.32.13, Open WebUI, qwen3:4b on a GTX 1660 Ti) depends on Jay's PC being on, so it can't serve as the cloud MVP.
- **Observed:** No deployment, database or auth provider for AEGIS was found anywhere this session could reach.

## What works today
- **Observed:** This repo (v0.2) passes lint, typecheck, 52 unit tests, 14 browser tests on desktop and mobile against a production build, and the database row-level security tests on Postgres 16.
- **Blocked:** Live calls to Gemini, Groq and OpenRouter, Supabase sign-in emails, and Vercel hosting. All need Jay's accounts. The shared provider code path is tested against a fake OpenAI-compatible server.

## Costs
- **Proposed:** Vercel Hobby (free, non-commercial) and Supabase Free (500 MB database, pauses after 7 idle days). Models come from free tiers (Gemini, Groq, OpenRouter `:free` models), so the total is $0/month. Paid OpenRouter models are filtered out unless explicitly enabled.
- **Inferred:** The first likely cost is sharing AEGIS with many users. That means heavier model usage, or Supabase Pro at $25/month. Nothing gets paid for without Jay's approval.

## Risks
- **Inferred:** Free-tier rate limits will throttle heavy use. The model picker lets you switch providers when that happens.
- **Inferred:** If the Replit app turns out to be more complete in some area, the two codebases will need reconciling. See DECISIONS.md.

## Branding
- **Observed:** No final logo or colour files were available.
- **Proposed:** The star mark and palette in this repo are **placeholders**, kept in `src/components/Logo.tsx`, `src/app/icon.svg`, `public/icon*.svg` and the tokens at the top of `src/app/globals.css`. Swap them for Jay's final assets once they're provided.

## Addendum 2026-10-09: older AEGIS found on Jay's PC

**Observed** in `Desktop\Ai Corporation Files\` on Jay's PC (read-only inspection, nothing changed there):
- `AEGIS_CLOUD_SOURCE`: "AEGIS AI Corporation", a Python/Flask app with a password-gated PWA command centre, task board, and autonomous Manager, Researcher, Developer and QC agents that share a SQLite database. It routes to Ollama locally and to Groq (`openai/gpt-oss-20b`) and OpenRouter (`openrouter/free`) in the cloud, with a zero-cost-only switch. It includes a Render blueprint, unit smoke tests and a workspace safety gate that confines file edits to one folder with backups. It's a local git repo (branches `main`, `zero-cost-cloud-hardening`) that was never pushed. Its planned target was a private repo `JayRue13/aegis-ai-corporation`.
- `AEGIS_CLOUD_OPERATIONS`: a production probe script plus a workflow that checks a deployed URL.
- Backups: `AI_Corporation`, `AI_Corporation_precloud_backup_20261002`, `AEGIS_CLOUD_SOURCE_RECOVERY.zip`.
- No logo: `aegis-icon.svg` there is a 6-byte placeholder, so the logo is still missing.

**Inferred**: this is the "autonomous agents" half of the AEGIS vision. This repo covers the personal-assistant half (chat, memory, files, apps). The two don't conflict.

**Proposed**:
- Keep this app as the platform.
- Port the corporation idea later as background agents (Milestone 5): task board, role agents, and a QC review step, running on GitHub Actions or a Supabase cron at $0. Reuse the safety gate's rules (one workspace, backups, protected files).
- Add OpenRouter's `openrouter/free` auto-router as a default free model.
