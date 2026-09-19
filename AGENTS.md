# Base44 Dev Environment

## Architecture
Single-origin app: an Express server (`server.ts`) runs on port 3000 with Vite in
middleware mode, serving the React frontend from `src/` and the API under `/api/*`.
No external database — `serverDb.ts` is a JSON file-based store persisted to `data/`
and `uploads/` (both gitignored, created at runtime).

## Run
`docker compose -f docker-compose.base44.yml up -d` — uses `node:22`, bind-mounts the
repo, installs deps into a named `node_modules` volume, and runs `npm run dev`
(`tsx server.ts`). Live reload is enabled (chokidar polling for bind mounts).

## Environment
All external-service keys default to empty, so the app boots without credentials:
- `GROQ_API_KEY` / `GEMINI_API_KEY` — AI caption/hashtag generation (optional).
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_ADMIN_CHAT_ID` — admin/moderation bot (optional).
- `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` — live streaming (optional).
- `RESEND_API_KEY` / `EMAIL_FROM` — email verification; in dev mode signup returns a
  local verification URL instead of sending real email, so signup works without it.

Real secrets are delivered via `/run/base44/app.env`; repo-level placeholders live in
`.env.base44-defaults` (loaded first, overridden by platform secrets).

## Verify
`curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/` → 200, and
`curl -s http://localhost:3000/api/auth/me` → `{"user":null}`.
