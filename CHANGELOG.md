# Changelog

## Unreleased
- Security: upgraded Next.js to 16.4.3, which fixes two critical remote-code-execution advisories and a denial-of-service advisory in 16.4.0. Also upgraded zod and undici. `npm audit` reports no vulnerabilities in shipped code.
- Workspace knowledge files: add text, Markdown, PDF or Word files to a workspace (Edit workspace → Add files). In that workspace's chats, AEGIS reads the most relevant parts of them. Small workspaces are sent whole; larger ones send the best-matching excerpts. Files sync for signed-in users (new migration `0004_knowledge.sql`) and are included in backups.
- OpenRouter's free auto-router ("Free auto (best available)") is listed first when an OpenRouter key is set. It picks whichever free model is available, so chats keep working when one free model is busy.
- Security: the server now refuses paid OpenRouter models even if a client asks for one directly. Before, only the model picker hid them. Paid models still work if `OPENROUTER_ALLOW_PAID=true` is set or the model is listed in `OPENROUTER_MODELS`.

## 0.6.0 (2026-10-09)
- Agent mode: AEGIS can search the web, read pages, calculate exactly and check the date on its own, showing each step it took. Anything that changes your data (saving a memory, creating a workspace) appears as a card you approve or dismiss; nothing is saved without your click. Models that can't use tools fall back to a normal answer.
- Works offline once installed: the app and your saved chats on this device open without a connection, and a banner says when you're offline.
- Desktop app (Windows, macOS, Linux) and Android/iOS app shells around your hosted AEGIS, built on demand with the new Apps workflow. See docs/APPS.md.
- Accessibility: automated WCAG 2.1 AA scans pass in dark and light themes on desktop and mobile. Faint text now has higher contrast. Dialogs take focus, keep Tab inside, and return focus when closed.
- Security: images in model replies are shown as links instead of being loaded, which blocks data leaks through injected image URLs. Added a strict Content Security Policy, HSTS and COOP. Security notes are in docs/SECURITY.md.

## 0.5.0 (2026-10-09)
- Optional daily message limit per signed-in user (`AEGIS_DAILY_MESSAGE_LIMIT`), with admins exempt. This protects free model quotas once friends and family use AEGIS.

## 0.4.0 (2026-10-09)
- Assistant modes: Chat, Research, Code, Plan and Write.
- Web search toggle. Research mode always searches and cites sources as [1], [2]. It uses Wikipedia with no key, or SearXNG or Brave if configured.
- Custom instructions in Settings.
- Read any reply aloud.
- Fixed: the focus ring around the message box, and the composer toolbar overflowing on narrow phones.

## 0.3.0 (2026-10-09)
- Paste a link and AEGIS reads the page. Private and internal addresses are refused, and the reply shows which pages were read.
- Voice input through the browser's speech recognition.
- Signed-in users' images are stored in a private Supabase Storage bucket, so they survive across devices without filling the database.

## 0.2.0 (2026-10-09)
- PDF and Word attachments are read and used as chat context.
- AEGIS learns lasting facts about you from conversations (toggle in Settings).
- Download any chat as Markdown.

## 0.1.0 (2026-10-09)
- First release: streaming multi-provider chat, demo model, memory, workspaces, file and image attachments, history and search, optional Supabase accounts with row-level security, access-code mode, PWA, dark/light themes, CI and deployment docs.
