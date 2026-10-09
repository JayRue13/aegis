@AGENTS.md

# AEGIS working notes

- Read docs/ARCHITECTURE.md before structural changes; record decisions in docs/DECISIONS.md and results in docs/PROGRESS.md.
- Budget is $0/month: never add paid services or enable paid models by default.
- Before claiming something works: `npm run check`, `npm run build`, and `npm run test:e2e` for UI changes; `scripts/test-db.sh` for schema changes.
- Server-only code lives in src/lib/server and must never be imported by client components.
