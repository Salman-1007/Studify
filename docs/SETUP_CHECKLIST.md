# Studify Setup Checklist

## Local setup
- [ ] Install Node.js 20+
- [ ] Clone/extract the repo
- [ ] `cd client && npm install`
- [ ] `cd server && npm install`
- [ ] Create a Neon account and project
- [ ] Copy the Neon connection string into `server/.env` as `DATABASE_URL`
- [ ] Generate JWT secrets and add to `server/.env` (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`)
- [ ] Add your Groq API key to `server/.env` (`GROQ_API_KEY`)
- [ ] `cd server && npx prisma generate`
- [ ] `npx prisma migrate dev --name init`
- [ ] `npm run seed`
- [ ] `npm run dev` (server) in one terminal
- [ ] `cd client && npm run dev` in another terminal

## Functional smoke test
- [ ] Sign up a new account
- [ ] Log in with the demo account (`demo@studify.app` / `Demo1234`)
- [ ] Dashboard loads with real (not hard-coded) stats
- [ ] Edit profile and save
- [ ] Start an AI Mentor conversation and get a real Groq response
- [ ] Upload or paste a material
- [ ] Generate a summary from that material
- [ ] Generate a quiz, take it, submit, see scored results
- [ ] Progress page reflects the new attempt
- [ ] Create a study group
- [ ] Join the same group from a second account (or the seeded `bob_demo` account)
- [ ] Open group chat, send a message, confirm the other account receives it live
- [ ] Host a group quiz competition, have both accounts join and submit
- [ ] Group leaderboard reflects both scores
- [ ] Check an achievement was awarded (e.g. "First Quiz")
- [ ] Refresh the browser — session persists, data persists
- [ ] Log out — protected routes redirect to `/login`

## Before pushing to GitHub
- [ ] `server/.env` and `client/.env` are in `.gitignore` (already set up)
- [ ] No real API keys/secrets committed — check `git status` / `git diff` before first push
- [ ] `.env.example` files are complete and accurate

## Deployment
- [ ] Push repository to GitHub
- [ ] Deploy backend to Render (root dir `server`, see README)
- [ ] Deploy frontend to Vercel (root dir `client`, `VITE_API_URL` set to the Render URL)
- [ ] Set `CLIENT_URL` on Render to the exact Vercel domain
- [ ] Run `npx prisma migrate deploy` against the production database (Render's build command
      does this automatically per `render.yaml`)
- [ ] Re-run the functional smoke test above against the deployed URLs
