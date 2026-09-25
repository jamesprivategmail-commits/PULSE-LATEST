# Agent notes

- Single process: `server.ts` (Express) serves the API and mounts Vite in middleware mode on port 3000. Run via `docker compose -f docker-compose.base44.yml up -d`.
- `tsx watch` restarts the server when `server.ts`/`serverDb.ts` change. Frontend (`src/`) is transformed by Vite on request; Vite's HMR websocket (separate port 24678) isn't reachable through the preview proxy, so reload the preview after frontend edits.
- Storage is a JSON file: `data/pulse-documents.json` (gitignored, created on boot). Uploads go to `uploads/`. No database service needed.
- Every external integration is optional at boot (Groq, Gemini, LiveKit, Resend, Telegram). Without `RESEND_API_KEY`/`EMAIL_FROM`, dev mode logs/returns a local verification URL instead of emailing.
- `.env.example` contains credential-looking values (Telegram token, LiveKit key/secret) — do not use them; real values come from `/run/base44/app.env`.
- Type check: `docker compose -f docker-compose.base44.yml exec app npm run lint`.
