# Pulse — Base44 dev environment

## What this is
A vertical video social platform (React + Vite frontend, Express backend in a single `server.ts` process). The backend serves the Vite dev server in middleware mode, so the whole app runs on one port (3000).

## Architecture
- **Single process**: `tsx server.ts` starts Express + Vite middleware on port 3000. No separate frontend/backend origins.
- **Persistence**: file-based JSON store in `./data/pulse-documents.json` (see `serverDb.ts`). No external database container is needed.
- **Auth**: cookie-based sessions (`pulse_session`), same-origin. Email/password + anonymous.
- **Uploads**: saved to `./uploads/`, served at `/uploads`.

## Running
```
docker compose -f docker-compose.base44.yml up -d
```
- Image: `node:22-slim`, source bind-mounted at `/app`, deps installed on startup via `npm install`.
- Live reload: Vite HMR is enabled (dev server in middleware mode). Backend (`server.ts`) changes require a container restart (`docker compose -f docker-compose.base44.yml restart web`) because `tsx` does not watch by default.
- Health check: `curl http://localhost:3000/` returns 200; `/api/auth/me` returns `{"user":null}`.

## Credentials (all optional — the app boots without them)
The app starts cleanly with empty/placeholder credentials. These only matter when their features are used:
- `GEMINI_API_KEY`, `GROQ_API_KEY` — AI caption/hashtag generation.
- `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` — live audio/video streaming.
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_ADMIN_CHAT_ID` — Telegram admin moderation bot.
- `RESEND_API_KEY` / `EMAIL_FROM` — email verification on signup (without it, verification URLs are logged/returned locally).

Real values are delivered via `/run/base44/app.env` (Base44 secrets panel) and override the placeholders in `.env.base44-defaults`.

## Quirks
- On startup the server runs `cleanDatabaseOfFakeAccounts()` to purge seed/demo documents from the JSON store.
- Telegram bot polling is skipped when `TELEGRAM_BOT_TOKEN` is empty (logged, not an error).
- `vite.config.ts` disables HMR when `DISABLE_HMR=true`; left enabled here for live reload.
