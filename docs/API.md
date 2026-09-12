# Studify API Reference

Base URL: `http://localhost:5000/api` (dev) or your Render URL in production.

All authenticated endpoints require `Authorization: Bearer <accessToken>`. Successful responses
are shaped `{ "success": true, "data": {...} }`; errors are `{ "success": false, "message": "..." }`.

## Auth

### POST /auth/register
No auth. Body:
```json
{ "name": "Alice", "username": "alice", "email": "a@x.com", "password": "min8chars", "confirmPassword": "min8chars", "educationLevel": "UNIVERSITY", "grade": "optional", "institution": "optional" }
```
Response `201`: `{ user, accessToken }`. Sets an httpOnly refresh cookie.
Errors: `409` email/username taken, `400` validation failure.

### POST /auth/login
No auth. Body: `{ "identifier": "email-or-username", "password": "..." }`.
Response `200`: `{ user, accessToken }`. Errors: `401` invalid credentials.

### POST /auth/refresh
No auth (uses the httpOnly cookie). Response `200`: `{ accessToken }`. Errors: `401` if missing/expired.

### POST /auth/logout
No auth required to call. Revokes the current refresh token and clears the cookie.

### GET /auth/me
Auth required. Returns the current user.

## Users

### GET /users/profile
Auth required. Returns `{ user, stats, achievements, groups, weakTopics }`.

### PUT /users/profile
Auth required. Body: any of `{ name, grade, institution, educationLevel }`.

### PUT /users/profile/password
Auth required. Body: `{ currentPassword, newPassword }`. Errors: `401` wrong current password.

### POST /users/profile/avatar
Auth required. `multipart/form-data` with field `avatar` (image, max 5MB).

## Materials

### GET /materials
Auth required. Lists the user's materials (no full text).

### POST /materials
Auth required. `multipart/form-data`: `title` (required), `category`, either `file` (PDF/text,
max 15MB) or `text` (plain text body instead of a file).

### GET /materials/:id
Auth required. Owner only. Returns full material including extracted text.

### DELETE /materials/:id
Auth required. Owner only.

## AI

All AI endpoints are rate-limited (15 requests/minute/user) and auth-required.

### POST /ai/chat
Body: `{ conversationId?, message, materialId?, topic? }`. Creates a conversation if
`conversationId` is omitted. Returns `{ conversationId, message }` (the assistant's message).

### POST /ai/summarize
Body: `{ materialId }` or `{ text }`. Returns `{ summary }` (Markdown).

### POST /ai/generate-quiz
Body: `{ topic, subject?, difficulty?, numQuestions?, materialId? }`. Returns `{ quiz }` with
questions persisted. On malformed AI output, retries once, then returns `500`.

### POST /ai/generate-flashcards
Body: `{ topic, numCards?, materialId? }`. Returns `{ deck }`.

### POST /ai/study-plan
Body: `{ subjects?, availableHoursPerWeek? }`. Uses the user's detected weak topics. Returns
`{ plan }`.

## Conversations

- `GET /conversations` — list.
- `GET /conversations/:id` — with messages.
- `PUT /conversations/:id` — body `{ title }`, rename.
- `DELETE /conversations/:id`

## Quizzes

### GET /quizzes
Auth required. Lists quizzes created by the user.

### GET /quizzes/:id
Auth required. Returns the quiz **without** correct answers/explanations (safe to render while
taking it).

### POST /quizzes/:id/attempt
Body: `{ answers: [{ questionId, answer }], timeTakenSecs }`. Scores the attempt, awards points
and achievements, updates weak-topic tracking. Returns `{ attempt, pointsEarned, achievementsAwarded }`.

### GET /quiz-attempts
Auth required. The user's full attempt history.

## Flashcards

- `GET /flashcards/decks`
- `GET /flashcards/decks/:id`
- `POST /flashcards/decks/:id/cards` — body `{ front, back }`, manual card.
- `POST /flashcards/cards/:cardId/review` — body `{ rating: "easy"|"medium"|"hard" }`.
- `GET /flashcards/due` — cards due for review now.

## Groups

- `GET /groups?q=` — search public groups.
- `POST /groups` — body `{ name, description?, subject?, privacy }`.
- `GET /groups/:id` — private groups require membership.
- `DELETE /groups/:id` — owner only.
- `POST /groups/:id/join` — body `{ joinCode }` required for private groups.
- `POST /groups/:id/leave` — owner cannot leave (must delete).
- `GET /groups/:id/members`
- `DELETE /groups/:id/members/:userId` — owner/moderator only.
- `PATCH /groups/:id/members/:userId/moderator` — owner only, toggles moderator role.
- `GET /groups/:id/messages?cursor=` — paginated chat history (30/page, newest-first cursor).
- `GET /groups/:id/leaderboard` — aggregate group-quiz leaderboard.

## Group Quizzes (competitions)

- `POST /groups/:id/quizzes` — body `{ quizId }`. Owner/moderator only.
- `GET /groups/:id/quizzes` — list competitions for the group.
- `POST /groups/:id/quizzes/:groupQuizId/start` — owner/moderator only.
- `POST /groups/:id/quizzes/:groupQuizId/join`
- `POST /groups/:id/quizzes/:groupQuizId/submit` — body `{ answers, timeTakenSecs }`. Scores,
  awards participation/winner points.
- `GET /groups/:id/quizzes/:groupQuizId/leaderboard`

## Leaderboard / Progress / Notifications

- `GET /leaderboard` — top 50 by points, global.
- `GET /progress` — full progress payload (see Dashboard usage in the client for shape).
- `GET /notifications`
- `PATCH /notifications/:id/read`

## Admin

Auth required + `role: ADMIN`.

- `GET /admin/users`
- `PATCH /admin/users/:id/deactivate`
- `GET /admin/groups`
- `GET /admin/stats`

## Health

### GET /health
No auth. `{ success: true, status: "ok", database: "connected"|"disconnected" }`. Used as
Render's health check target.

## Socket.IO (real-time group chat)

Connect with `auth: { token: accessToken }`.

- Emit `group:join` `{ groupId }` → ack `{ success, message? }`. Server verifies membership.
- Emit `group:message` `{ groupId, content }` → ack `{ success, message? }`, broadcasts
  `group:message` (the persisted message row) to everyone in `group:<groupId>`.
