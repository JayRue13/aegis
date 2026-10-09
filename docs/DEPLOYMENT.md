# Deploying AEGIS for $0/month

About 20 minutes. None of these services needs a credit card.

## 1. Get a free model key (pick one or more)

| Provider | Where | Env var |
|---|---|---|
| Google Gemini (recommended first: generous free tier, vision) | https://aistudio.google.com/apikey | `GEMINI_API_KEY` |
| Groq (very fast Llama models) | https://console.groq.com/keys | `GROQ_API_KEY` |
| OpenRouter (many free models) | https://openrouter.ai/keys | `OPENROUTER_API_KEY` |

AEGIS lists only free OpenRouter models unless you set `OPENROUTER_ALLOW_PAID=true`. Gemini and Groq free tiers are rate-limited, not billed, as long as you do not attach billing to those accounts.

## 2. Create the Supabase project (accounts + sync)

1. https://supabase.com → New project (Free plan). Save the database password somewhere safe.
2. **SQL Editor** → New query → paste `supabase/migrations/0001_init.sql` → Run. Then do the same with `0002_attachments_storage.sql`, which creates the private image bucket.
3. **Project Settings → API**: copy the Project URL and the `anon` public key.
4. Later, after step 3 gives you a URL: **Authentication → URL Configuration** → set Site URL to your Vercel URL and add it under Redirect URLs.

Free projects pause after 7 days without activity; opening the app wakes them (first load is slower).

Skipping Supabase is fine: set `AEGIS_ACCESS_CODE` instead and chats stay in each browser.

## 3. Deploy on Vercel

1. https://vercel.com → sign in with GitHub → **Add New → Project** → import `aegis`.
2. Framework is detected as Next.js. Add environment variables:
   - your model key(s) from step 1
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `AEGIS_ALLOWED_EMAILS` = your email (so only you can use your quota)
3. Deploy. Every push to `main` redeploys automatically; pull requests get preview URLs.

Vercel Hobby is free for personal, non-commercial use. If AEGIS is ever sold, move to Pro or self-host (below).

## 4. Use it everywhere

- **Phone**: open the URL → Share → *Add to Home Screen* (iOS) or menu → *Install app* (Android).
- **Desktop**: Chrome/Edge address bar → install icon.
- Open Settings → enter your email → click the link in your inbox. Use *Copy chats from this device* once to move guest chats into your account.

## 5. Using your local Ollama (optional)

Vercel cannot reach `localhost` on your PC. Expose Ollama privately (e.g. Tailscale Funnel or a Cloudflare Tunnel, both free) and set `OLLAMA_BASE_URL` to that address. Protect it: anyone with the URL can use your GPU.

## Self-hosting instead of Vercel

`docker build -t aegis --build-arg NEXT_PUBLIC_SUPABASE_URL=... --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... .` then `docker run -p 3000:3000 --env-file .env aegis`. Works on Oracle Cloud Always Free, a Raspberry Pi, or any VPS.

## Checking a deployment

`GET /api/health` returns which providers and sign-in mode are active (no secrets). If chat says *"This deployment has no sign-in configured"*, add Supabase keys or `AEGIS_ACCESS_CODE`: that lock is deliberate so a public URL cannot spend your quota.
