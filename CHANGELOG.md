# Changelog

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
