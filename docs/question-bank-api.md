# Studify — Phase 2 Canonical Question Bank & Standardized Test Engine API

## 1. Overview & Architectural Principles

Phase 2 replaces the legacy ad-hoc AI quiz structure with a **real canonical question bank system** grounded in a formal Pakistani curriculum hierarchy.

### The Single Canonical Question Pipeline
```text
Curriculum Hierarchy (Board -> Class -> Subject -> Chapter -> Topic)
   ↓
Question Bank (MCQs with normalized text, options, answers, explanations)
   ↓
Admin Review & Approval (PENDING_REVIEW -> APPROVED | REJECTED)
   ↓
Test Generator (POST /api/tests — Answers & Explanations strictly hidden)
   ↓
Attempt Taking & Client State (Questions stepper, timer, option selection)
   ↓
Server-Side Scoring (POST /api/tests/:attemptId/submit)
   ↓
Persistence, Answer Reveal, & XP Award (+10 base, +2 per correct, +15 bonus for >=80%)
```

### Strict Scope (Phase 2 Vertical Slice)
- **Board**: `Punjab Textbook Board / PECTAA`
- **Class / Grade**: `Class 9`
- **Subject / Book**: `Physics 9` (`Physics`)
- Generic database architecture to support Class 10, 11, 12 and other boards in subsequent phases without schema rewrites.
- Single source of truth: PostgreSQL Neon database via Prisma ORM.

---

## 2. Database Models (`schema.prisma`)

### `Board`
- `id`: UUID (Primary Key)
- `name`: String (e.g., `"Punjab Textbook Board / PECTAA"`)
- `code`: String (Unique, e.g., `"PUNJAB"`)
- `description`: String?

### `CurriculumSubject`
- `id`: UUID (Primary Key)
- `boardId`: UUID (Foreign Key -> `Board`)
- `classGrade`: String (e.g., `"9"`)
- `subjectName`: String (e.g., `"Physics"`)
- `bookName`: String (e.g., `"Physics 9"`)
- `code`: String? (e.g., `"PHY9"`)
- Unique constraint: `[boardId, classGrade, subjectName]`

### `CurriculumChapter`
- `id`: UUID (Primary Key)
- `subjectId`: UUID (Foreign Key -> `CurriculumSubject`)
- `chapterNumber`: Int
- `chapterName`: String
- Unique constraint: `[subjectId, chapterNumber]`

### `CurriculumTopic`
- `id`: UUID (Primary Key)
- `chapterId`: UUID (Foreign Key -> `CurriculumChapter`)
- `topicName`: String
- Unique constraint: `[chapterId, topicName]`

### `QuestionBankItem`
- `id`: UUID (Primary Key)
- `boardId`, `classGrade`, `subjectId`, `chapterId`, `topicId`
- `questionText`: String
- `normalizedText`: String (lowercased, punctuation-stripped, whitespace-collapsed for duplicate detection)
- `optionA`, `optionB`, `optionC`, `optionD`: String
- `correctAnswer`: String (`"A"` | `"B"` | `"C"` | `"D"`)
- `explanation`: String?
- `difficulty`: Enum (`EASY`, `MEDIUM`, `HARD`)
- `status`: Enum (`PENDING_REVIEW`, `APPROVED`, `REJECTED`)
- `questionType`: Enum (`MCQ`)
- `sourceType`: Enum (`ORIGINAL`, `IMPORTED`, `AI_GENERATED`)
- `sourceReference`: String?
- `createdById`: UUID? (Foreign Key -> `User`)

### `StandardTestAttempt`
- `id`: UUID (Primary Key)
- `userId`: UUID (Foreign Key -> `User`)
- `boardId`, `classGrade`, `subjectId`, `chapterId`
- `questionCount`: Int
- `difficulty`: String (`"MIXED"`, `"EASY"`, `"MEDIUM"`, `"HARD"`)
- `score`: Int
- `totalQuestions`: Int
- `percentage`: Float
- `correctCount`, `wrongCount`, `unansweredCount`: Int
- `timeTakenSecs`: Int
- `isSubmitted`: Boolean
- `startedAt`, `submittedAt`: DateTime?

### `StandardQuestionAttempt`
- `id`: UUID (Primary Key)
- `testAttemptId`: UUID (Foreign Key -> `StandardTestAttempt`)
- `questionId`: UUID (Foreign Key -> `QuestionBankItem`)
- `order`: Int
- `selectedOption`: String? (`"A"` | `"B"` | `"C"` | `"D"` | null)
- `isCorrect`: Boolean

---

## 3. Curriculum Browsing API

### `GET /api/curriculum/boards`
Returns available education boards.
- **Auth**: Required (`Bearer <token>`)
- **Response `200`**:
```json
{
  "success": true,
  "data": {
    "boards": [
      {
        "id": "18e6660a-a19f-4616-96e8-30ea090ba756",
        "name": "Punjab Textbook Board / PECTAA",
        "code": "PUNJAB",
        "description": "Punjab Curriculum and Textbook Board / Punjab Examination Commission, Class 9"
      }
    ]
  }
}
```

### `GET /api/curriculum/classes`
Returns available classes for a board.
- **Query Params**: `boardId` (optional)
- **Response `200`**:
```json
{
  "success": true,
  "data": {
    "classes": ["9"]
  }
}
```

### `GET /api/curriculum/subjects`
Returns subjects filtered by board and class.
- **Query Params**: `boardId` (optional), `classGrade` or `gradeLevel` (e.g. `9`)
- **Response `200`**:
```json
{
  "success": true,
  "data": {
    "subjects": [
      {
        "id": "...",
        "name": "Physics",
        "title": "Physics 9",
        "classGrade": "9",
        "code": "PHY9"
      }
    ]
  }
}
```

### `GET /api/curriculum/chapters`
Returns chapters for a subject with approved question counts.
- **Query Params**: `subjectId` (required)
- **Response `200`**:
```json
{
  "success": true,
  "data": {
    "chapters": [
      {
        "id": "...",
        "chapterNumber": 1,
        "chapterName": "Physical Quantities and Measurement",
        "title": "Physical Quantities and Measurement",
        "topics": [],
        "_count": { "questions": 12 }
      }
    ]
  }
}
```

### `GET /api/curriculum/topics`
Returns topics for a chapter with approved question counts.
- **Query Params**: `chapterId` (required)
- **Response `200`**:
```json
{
  "success": true,
  "data": {
    "topics": [
      {
        "id": "...",
        "topicName": "Introduction to Physics",
        "title": "Introduction to Physics",
        "_count": { "questions": 3 }
      }
    ]
  }
}
```

---

## 4. Admin Question Management API

All `/api/admin/*` endpoints require `role === 'ADMIN'`.

### `GET /api/admin/questions`
List questions with filtering and pagination.
- **Query Params**: `status`, `chapterId`, `difficulty`, `search`, `page`, `limit`
- **Response `200`**:
```json
{
  "success": true,
  "data": {
    "questions": [...],
    "pagination": { "total": 21, "page": 1, "limit": 20, "totalPages": 2 }
  }
}
```

### `POST /api/admin/questions`
Create a single canonical MCQ.
- **Request Body**:
```json
{
  "chapterId": "...",
  "questionText": "What is the SI unit of electric current?",
  "optionA": "Volt",
  "optionB": "Ampere",
  "optionC": "Ohm",
  "optionD": "Coulomb",
  "correctOption": "B",
  "difficulty": "EASY",
  "explanation": "Electric current is a base physical quantity measured in amperes."
}
```
- **Response `201`**: `{ "success": true, "data": { "question": { ... } } }`

### `PATCH /api/admin/questions/:id/status`
Update question status (`APPROVED`, `PENDING_REVIEW`, `REJECTED`).
- **Request Body**: `{ "status": "APPROVED" }`
- **Response `200`**: `{ "success": true, "data": { "question": { "status": "APPROVED" } } }`

### `DELETE /api/admin/questions/:id`
Delete a question.
- **Response `200`**: `{ "success": true, "data": { "deleted": true } }`

### `POST /api/admin/questions/import-json` (or `/import`)
Bulk import an array of MCQs with automatic deduplication.
- **Request Body**:
```json
{
  "defaultChapterId": "...",
  "questions": [
    {
      "questionText": "Which unit is used for measuring electric current?",
      "optionA": "Volt",
      "optionB": "Ampere",
      "optionC": "Ohm",
      "optionD": "Coulomb",
      "correctOption": "B",
      "difficulty": "EASY",
      "explanation": "Electric current is measured in amperes in the SI system."
    }
  ]
}
```
- **Response `200`**:
```json
{
  "success": true,
  "data": {
    "totalRecords": 1,
    "importedCount": 1,
    "skippedCount": 0,
    "invalid": 0,
    "duplicateItems": [],
    "errors": []
  }
}
```

---

## 5. Standardized Test Engine API

### `POST /api/tests`
Generate a new chapter test from approved questions.
- **Auth**: Required (`Bearer <token>`)
- **Request Body**:
```json
{
  "title": "Physics 9 Ch 1 Test",
  "chapterId": "...",
  "questionCount": 10,
  "difficulty": "MIXED",
  "mode": "TEST"
}
```
- **Response `201`**:
```json
{
  "success": true,
  "data": {
    "attempt": {
      "id": "...",
      "title": "Physics 9 Practice Test",
      "questionCount": 10,
      "questions": [
        {
          "id": "...",
          "questionId": "...",
          "order": 0,
          "questionText": "...",
          "optionA": "...",
          "optionB": "...",
          "optionC": "...",
          "optionD": "...",
          "difficulty": "EASY"
        }
      ]
    }
  }
}
```
> [!IMPORTANT]
> `correctAnswer`, `correctOption`, and `explanation` are strictly stripped from the returned questions to prevent cheating.

### `GET /api/tests/:attemptId`
Fetch test attempt state.
- **Before submission**: Returns active test with answers and explanations hidden.
- **After submission**: Returns complete results including user's selected options, correct options, score, and explanations.

### `POST /api/tests/:attemptId/submit`
Submit answers for server-side scoring.
- **Request Body**:
```json
{
  "answers": [
    { "questionId": "...", "selectedOption": "B", "timeSpentSeconds": 15 },
    { "questionId": "...", "selectedOption": "C", "timeSpentSeconds": 20 }
  ],
  "timeTakenSecs": 35
}
```
- **Response `200`**:
```json
{
  "success": true,
  "data": {
    "score": 2,
    "totalQuestions": 2,
    "percentage": 100,
    "correctCount": 2,
    "wrongCount": 0,
    "unansweredCount": 0,
    "timeTakenSecs": 35,
    "xpEarned": 29,
    "questions": [
      {
        "questionId": "...",
        "selectedOption": "B",
        "correctOption": "B",
        "isCorrect": true,
        "explanation": "..."
      }
    ]
  }
}
```
> [!NOTE]
> Re-submitting an already submitted attempt immediately returns `HTTP 400 Bad Request` ("Test attempt has already been submitted").

### `GET /api/tests/history`
Fetch authenticated student's completed test attempts.
- **Response `200`**:
```json
{
  "success": true,
  "data": {
    "attempts": [
      {
        "id": "...",
        "title": "Physics 9 Test",
        "score": 3,
        "totalQuestions": 5,
        "percentage": 60,
        "submittedAt": "2026-09-23T13:53:29.000Z",
        "subject": { "name": "Physics", "bookName": "Physics 9" },
        "chapter": { "chapterNumber": 1, "title": "Physical Quantities and Measurement" }
      }
    ]
  }
}
```

---

## 6. Duplicate Detection Specification

Duplicate detection is enforced on `(chapterId, normalizedText)`:
1. `normalizedText` is computed by lowercasing text, stripping all non-alphanumeric punctuation (`/[^\w\s]/g`), and collapsing consecutive whitespace.
2. In bulk JSON imports:
   - **In-batch duplicate check**: Deduplicates multiple identical questions within the same import payload.
   - **Database duplicate check**: Queries `prisma.questionBankItem.findFirst({ where: { chapterId, normalizedText } })` to skip existing questions without erroring out the entire batch.
   - Skipped duplicate questions are cleanly reported back in `skippedCount` and `duplicateItems`.

