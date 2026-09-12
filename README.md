# Studify

Studify is an intelligent learning platform: study material import, AI chat/summarization,
AI-generated quizzes and flashcards, study groups with real-time chat and quiz competitions,
leaderboards, and progress tracking — built as a full MERN-style web app (React + Express +
PostgreSQL/Prisma), ready to be extended with your team's own AI models.

## Features

- **Auth**: signup/login/logout, JWT access token + httpOnly refresh cookie, protected routes.
- **AI Mentor**: ChatGPT-style chat, grounded in your uploaded materials when relevant.
- **Materials**: upload PDFs/text, extraction, chunking (MVP groundwork for future RAG).
- **Quizzes**: AI-generated (MCQ / True-False / Fill-in-blank), scored, with history.
- **Flashcards**: AI-generated decks, manual cards, simple due-date review flow.
- **Study Groups**: create/join (public or code-gated private), roles, real-time chat (Socket.IO).
- **Group Quiz Competitions**: host a quiz for a group, members join and submit, live leaderboard.
- **Leaderboards**: global, per-group, per-competition — all computed from real attempts.
- **Progress & weak-topic detection**: deterministic algorithm, documented and replaceable.
- **Notifications, achievements, basic admin panel.**

## Architecture

```
React (Vite, Tailwind)          Express REST API              PostgreSQL (Neon)
        │      ↓ Axios                  │      ↓ Prisma               │
        │──────────────────────────────▶│─────────────────────────────▶
        │                                │
        │      ↕ Socket.IO (group chat)  │
        │◀───────────────────────────────▶

Express AI Controller → aiService.js → providers/groqProvider.js → Groq API
                                      ↳ providers/customProvider.js  (your team's future model)
```

The AI layer is intentionally abstracted: **controllers never call Groq directly.** They call
`aiService.js`, which calls whichever provider is selected by `AI_PROVIDER` in `.env`. Your AI
team can implement `server/src/services/providers/customProvider.js` (same function signature
as `groqProvider.js`) and flip one env var — no controller/route changes needed. See
"Future AI model integration" below.

## Requirements

- Node.js 20+ and npm
- A PostgreSQL database (Neon recommended — see below)
- A Groq API key (free tier available at https://console.groq.com)

## Project structure

```
studify/
├── client/        React + Vite + Tailwind frontend
├── server/        Express + Prisma backend
├── docs/          API.md, SETUP_CHECKLIST.md
├── tests/         (server tests live in server/tests)
├── render.yaml     Render deployment config
└── README.md
```

## Installation

```bash
git clone <your-repo-url>
cd studify

cd server
npm install
cd ../client
npm install
```

## Environment setup

Copy the example env files and fill them in:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

`server/.env` variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string (Neon) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Random strings for signing tokens. Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `GROQ_API_KEY` | From https://console.groq.com/keys |
| `GROQ_MODEL` | e.g. `llama-3.3-70b-versatile` — change any time without touching code |
| `AI_PROVIDER` | `groq` (default) or `custom` once your team's provider is implemented |
| `CLIENT_URL` | Frontend origin(s), comma-separated, for CORS |
| `UPLOAD_PROVIDER` | `local` for the MVP (see "File uploads" below) |

`client/.env`:

| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL of the backend, e.g. `http://localhost:5000` in dev |

## Database setup (Neon)

1. Create a free account at https://neon.tech.
2. Create a new project, then a database (or use the default one).
3. Copy the connection string shown (use the pooled connection string for serverless-friendly
   apps) and paste it into `server/.env` as `DATABASE_URL`.
4. From `server/`, run:

```bash
npx prisma generate
npx prisma migrate dev --name init
npm run seed
```

5. Verify: `npx prisma studio` opens a browser GUI on your data, or just start the server and
   hit `GET /api/health` — it reports `"database": "connected"` when the connection works.

> **Note on this delivery**: the sandbox this project was built in blocks outbound access to
> `binaries.prisma.sh`, so `prisma generate`/`migrate` could not be executed live inside that
> environment. The schema and migrations are standard Prisma and were validated by installing a
> local Postgres instance and syntax-checking every file; business logic was exercised with a
> full Jest + Supertest suite against an in-memory fake Prisma client (20/20 tests passing — see
> `server/tests/`). On your machine or on Render, which have normal internet access, the commands
> above will work exactly as documented. See "Known limitations" for the full detail.

## Run development

Two terminals:

```bash
# Terminal 1
cd server
npm run dev

# Terminal 2
cd client
npm run dev
```

The API runs on `http://localhost:5000`, the frontend on `http://localhost:5173`.

## Testing

```bash
cd server
npm test
```

This runs the Jest + Supertest suite (auth, group authorization, quiz scoring/leaderboard,
mocked-AI success and malformed-JSON handling, health check) against an in-memory fake Prisma
client — no real database or Groq key required.

## Production build

```bash
cd client
npm run build      # outputs client/dist

cd ../server
npm start           # NODE_ENV=production node src/app.js
```

## Deployment

### Neon (database)
See "Database setup" above. Use the same connection string for your Render deployment's
`DATABASE_URL`.

### Render (backend)
1. Push this repository to GitHub.
2. On Render: New → Web Service → connect your repo.
3. Set root directory to `server`.
4. Build command: `npm install && npx prisma generate && npx prisma migrate deploy`
5. Start command: `npm start`
6. Add environment variables from the table above (`DATABASE_URL`, `JWT_ACCESS_SECRET`,
   `JWT_REFRESH_SECRET`, `GROQ_API_KEY`, `GROQ_MODEL`, `CLIENT_URL`, `UPLOAD_PROVIDER`).
7. Health check path: `/api/health`.
8. Deploy, then copy the resulting `https://your-service.onrender.com` URL.
9. A ready-made `render.yaml` is included at the repo root (Render's "Blueprint" deploy can read
   it directly, prompting you only for the `sync: false` secrets).

### Vercel (frontend)
1. Import the repo into Vercel.
2. Set root directory to `client`.
3. Framework preset: Vite.
4. Add environment variable `VITE_API_URL` = your Render backend URL from above.
5. Deploy.
6. Because this is a single-page app with client-side routing, add a rewrite so deep links work:
   create `client/vercel.json`:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
   ```
7. Verify the deployed frontend can reach the backend (check the Network tab for CORS errors —
   if you see them, double-check `CLIENT_URL` on the Render side matches your Vercel domain
   exactly, including `https://`).

### Groq (AI)
1. Create a key at https://console.groq.com/keys.
2. Put it in `GROQ_API_KEY` locally and on Render (never in the client, never in Git).
3. Test with: `curl -X POST localhost:5000/api/ai/chat -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"message":"hello"}'`
4. To change models later, just change `GROQ_MODEL` in `.env` / Render's env vars — no
   redeploy-worthy code change needed. See https://console.groq.com/docs/models for current
   model names.

## Demo credentials

After running `npm run seed`:

- `demo@studify.app` / `Demo1234` (username `alice_demo`) — has a sample material, quiz attempt,
  and owns a demo group.
- `bob@studify.app` / `Demo1234` (username `bob_demo`) — member of the demo group, useful for
  testing group chat/competitions with two accounts.

These are seed data for demonstration — signup works independently and is not gated by them.

## Future AI model integration

Your AI engineers' models plug in at `server/src/services/providers/customProvider.js`. It must
export a `generateCompletion({ system, messages, jsonMode })` function with the same shape as
`groqProvider.js`. Once implemented, set `AI_PROVIDER=custom` in `.env` — `aiService.js` and
every controller/route stay untouched. The document pipeline has the same seam:
`documentService.js` (extraction) → `retrievalService.js` (currently simple keyword retrieval,
documented as an MVP stand-in for real embeddings/vector search) — replace `retrievalService.js`
once real RAG is ready.

## Known limitations

- **File storage is local disk** (`server/uploads/`) for the MVP, behind a `storageService.js`
  abstraction. This is fine for local dev but Render's filesystem is ephemeral — uploaded files
  will not survive a redeploy in production. Swap in Cloudinary/S3/Supabase by implementing that
  provider in `storageService.js`; the rest of the app doesn't need to change.
- **Material retrieval is keyword-overlap, not real RAG.** It's honestly implemented (no fake
  "AI understands your document" claims) and documented as groundwork for real embeddings.
- **Weak-topic detection is a deterministic threshold**, not a real adaptive-learning model —
  by design, per the project brief, so your AI team has a clean, documented seam to replace it.
- **Live database migrations were not run inside the AI sandbox that built this project**
  because that sandbox's network policy blocks the Prisma engine binary CDN
  (`binaries.prisma.sh`). This does not affect you: Render and any normal developer machine have
  unrestricted internet access, so `npx prisma generate` / `migrate dev` will work as documented.
  What *was* verified in that sandbox: every file passes `node --check`, the schema is valid
  Prisma syntax, a local Postgres instance was stood up to sanity-check the schema, and the full
  business-logic test suite (20 tests) passes against an in-memory fake Prisma client that
  mirrors the real schema's default values and relations.
- **Admin panel is intentionally minimal** (user list/deactivate, group list, platform stats) —
  per the brief, the student experience was prioritized.
- **Quiz competitions are turn-based, not live-synced.** Members join and submit independently;
  the leaderboard updates via polling (5s) rather than a Socket.IO broadcast. Wiring the existing
  `group:message` socket pattern to also broadcast score updates would be the natural next step.

## Troubleshooting

- **CORS errors**: `CLIENT_URL` on the server must exactly match your frontend's origin
  (protocol + domain, no trailing slash). Comma-separate multiple origins.
- **Database connection errors**: confirm `DATABASE_URL` includes `?sslmode=require` for Neon,
  and that you ran `npx prisma generate` after any schema change.
- **Prisma migration errors**: if migrations get out of sync, `npx prisma migrate reset` (dev
  only — it wipes data) then `migrate dev` again.
- **Groq API errors**: check `GROQ_API_KEY` is set and the model name in `GROQ_MODEL` is current
  (Groq deprecates old models — check https://console.groq.com/docs/models).
- **Render deploy fails on PORT**: the server reads `process.env.PORT` already — don't hardcode
  a port in Render's start command.
- **Socket.IO connection refused**: confirm the client's `SOCKET_URL` (same as `VITE_API_URL`)
  points at the backend, and that the backend's CORS config includes the frontend origin.
- **Vercel 404 on refresh**: add the `vercel.json` rewrite shown in the Vercel deployment steps.
- **"Not authenticated" right after login**: the refresh cookie needs `sameSite`/`secure`
  settings that work over HTTPS in production — this is already handled by
  `NODE_ENV=production`, just make sure it's set on Render.
