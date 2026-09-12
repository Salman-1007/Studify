# Tests

The automated test suite lives in `server/tests/` (Jest + Supertest) and runs with:

```bash
cd server
npm test
```

It covers authentication, group authorization, quiz scoring/leaderboards, and mocked-AI
success/failure handling, using an in-memory fake Prisma client (`server/tests/fakePrisma.js`)
so no live database or Groq key is needed to run it.
