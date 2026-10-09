# Changelog

## Unreleased
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
