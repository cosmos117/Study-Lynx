# Studylyx

Studylyx is a full-stack study management application. The first implementation phase establishes the project structure and development tooling; AI features will be added in a later phase.

## Project Structure

```text
ai-study-planner/
├── frontend/   # React and Vite client
└── backend/    # Express API and Prisma data layer
```

## Current Phase

Phase 2 establishes the backend foundation and Prisma database contract. Authentication, protected CRUD routes, and frontend pages will be added incrementally.

## Development

Install all dependencies:

```bash
npm run install:all
```

Run the frontend and backend together:

```bash
npm run dev
```

The frontend runs on `http://localhost:5173` and the backend runs on `http://localhost:5000`.

## Backend Environment

Copy the example environment file before starting the backend:

```bash
copy backend\.env.example backend\.env
```

Update `backend/.env` with your local MySQL credentials:

```env
PORT=5000
DATABASE_URL="mysql://username:password@localhost:3306/ai_study_planner"
JWT_SECRET="replace-with-a-long-random-secret"
JWT_EXPIRES_IN="7d"
CORS_ORIGIN="http://localhost:5173"
```

The backend currently exposes:

```text
GET /api/health
```

Authentication endpoints are available under `/api/auth`:

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
GET  /api/dashboard/summary
```

The `me` endpoint requires:

```http
Authorization: Bearer <jwt>
```

Registration and login return this response shape:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "John",
      "email": "john@example.com"
    },
    "token": "..."
  }
}
```

Passwords are hashed with bcrypt and are never included in API responses.

Request bodies are validated with Zod. Emails are trimmed and lowercased,
passwords must be at least 8 characters, and dashboard data is restricted to
the authenticated JWT user.

List endpoints accept `page` and `limit` query parameters. Defaults are page
`1` and limit `20`, with a maximum limit of `100`.

Study session duration is stored in minutes. Exam dates are stored as UTC
`DateTime` values, and daily study hours use a floating-point value. Exam →
subject → topic deletion cascades, as do topic-linked study sessions and quiz
results.

## AI study workspace

The protected topic study workspace is available at `/topics/:topicId/study`
and provides cached, on-demand notes, flashcards, quizzes, and mind maps.
Generated content is stored in `AiContent`; notes and flashcards can also be
edited manually. Flashcard reviews use SM-2 scheduling, with `AGAIN` due in
10 minutes and `HARD`/`EASY` applying 1.2x/1.3x interval modifiers.

The AI layer requires backend-only provider configuration in `backend/.env`.
Copy the new `AI_*`, `GEMINI_API_KEY`, and `GROQ_API_KEY` entries from
`backend/.env.example`. No provider key is exposed to the frontend.

After pulling the AI schema migration, run:

```bash
cd backend
npm run prisma:validate
npm run prisma:generate
npx prisma migrate status
```

AI generation endpoints are rate limited and daily usage is available at
`GET /api/ai/usage`. If a provider is unavailable, saved content remains
available and the deterministic motivation endpoint continues to work.

## Materials and AI Tutor (RAG)

`/materials` lets a student upload PDFs or text files, paste notes or YouTube
transcripts, attach each source to a topic, inspect the indexed passages, and
delete it. `/ai-tutor` answers questions from the selected sources and lists the
passages (document, page, passage number) the answer used. It can also explain
simpler, give an example, quiz the student, or draft flashcards from the same
sources. The existing Notes/Quiz/Flashcard generation is unchanged.

**Ingestion:** upload → validate (type, size, real file signature) → extract text
(per page for PDFs) → clean → chunk → embed → store. Processing runs in the
background; a document moves `PROCESSING → READY | FAILED` and the Materials page
polls until it settles. Raw files are not kept: only cleaned chunks, embeddings
and metadata are stored.

**Query:** question → query embedding → similarity search → top-K chunks above the
threshold → grounded prompt → LLM (through the existing provider abstraction) →
answer + source references. If nothing relevant is found, the LLM is not called
and the student is told the material doesn't cover the question.

**Services** (`backend/src/services/rag/`): `EmbeddingService`,
`VectorStoreService`, `DocumentIngestionService`, `RetrievalService`,
`RagService`. The app talks to these interfaces only. The default embedder is a
local, dependency-free lexical embedder (no API key; it matches shared words, not
meaning), and the default vector store keeps embeddings as JSON in MySQL and ranks
them in memory after the user/document/topic filters run in SQL. Replace either
behind the same interface (e.g. a hosted embedding model, pgvector) when needed.

**Security:** every `Document` and `DocumentChunk` carries a `userId`, and every
vector-store call requires one and fails closed without it. Source text is treated
as untrusted data: system instructions are static, and sources and the question go
in the user message as escaped, delimited data. Source references come from the
retrieved chunks, never from model-written citations. Retrieval logs record
counts, scores and ids, never question text, contents or keys.

**Configuration** (`backend/.env`, see `.env.example`): `RAG_TOP_K`,
`RAG_SIMILARITY_THRESHOLD`, `RAG_MAX_CHUNK_CHARS`, `RAG_CHUNK_OVERLAP_CHARS`,
`RAG_MAX_DOCUMENT_CHARS`, `RAG_MAX_FILE_SIZE_MB`, `RAG_ALLOWED_MIME_TYPES`,
`RAG_EMBEDDING_PROVIDER`. `topK` and the similarity threshold can also be set per
question from the AI Tutor page.

```http
POST   /api/documents            multipart: file, name?, topicId?
POST   /api/documents/text       { type: NOTE | YOUTUBE, name, text, topicId?, sourceUrl? }
GET    /api/documents            ?topicId&status&type
GET    /api/documents/:id
GET    /api/documents/:id/chunks ?limit&offset
PATCH  /api/documents/:id/topic  { topicId | null }
DELETE /api/documents/:id
POST   /api/ai-tutor/ask         { question, mode?, documentIds?, topicId?, topK?, threshold? }
```

After pulling these changes, apply the new migrations (`20261028120000_add_chunk_user_id`
adds `DocumentChunk.userId` and drops the unused `Document.fileKey`;
`20261028130000_add_recall_review_topic` adds the `RecallReview.topicId` column that the
schema already had but no migration created, and is safe to run if the column exists):

```bash
cd backend
npx prisma migrate deploy
npm test
```

## Topic Learning Hub

Every topic has a hub at `/topics/:topicId` (linked from exams, subjects, topic cards
and study sessions) that joins the existing features into one loop:
**plan → learn → recall → quiz → analyze → revise**.

| Tab | What it shows | Where its actions go |
|---|---|---|
| Learn | videos, attached materials, AI Tutor, notes | `/learn/youtube/:id`, `/materials`, `/ai-tutor?topicId=`, study workspace |
| Recall | cards due, mind map | `/recall/review?topicId=` (Active Recall), study workspace |
| Practice | latest quiz, attempts | `/topics/:id/study?tab=Quiz` |
| Progress | mastery, study time, recall and quiz performance, weak areas | AI Tutor, Active Recall, Study now |

A **Next step** banner recommends one action from the topic's state (cards due →
add material → create flashcards → quiz → revise weak spots → study).

**Generating from your own material.** The existing generate endpoints
(`POST /api/topics/:id/{notes,flashcards,quiz,mindmap}/generate`) accept
`documentIds` and `resourceIds` (a video's saved transcript). The text goes through the
same AI pipeline as before, as delimited, untrusted data; if it is longer than
`AI_INPUT_MAX_CHARS`, the passages most relevant to the topic are chosen with RAG
retrieval. Choosing sources always regenerates, since the cached copy was not based on
them. Without sources nothing changes.

**Study now** (`POST /api/topics/:id/study-now`) resumes the topic's in-progress session,
else starts today's planned one, else creates and starts a new one; finishing it returns
to the hub. **Hub data** is `GET /api/topics/:id/hub`.

**Mastery** (0-100) blends the average of the last three quizzes (50%), the share of the
last 50 flashcard reviews rated Good/Easy (35%) and completed study time up to two hours
(15%). Signals the student hasn't produced yet are left out and the rest rescaled. Weak
areas are questions missed on the latest quiz and cards whose latest rating was
Again/Hard. The rules live in `backend/src/services/topicProgress.js`.

## Dashboard, Quizzes and Analytics

These pages read two cross-topic endpoints that reuse the same mastery rules as the
Topic Learning Hub, so every screen agrees about how well a topic is known:

```http
GET /api/overview            per-topic mastery, due cards, quiz status, ranked "study next" with reasons; today's minutes, streak, next exam
GET /api/analytics?days=14   daily study minutes and cards reviewed, recall rate, last ten quiz scores (days: 7-90)
```

Streak counts consecutive days with a completed session or a flashcard review (it survives
until a full day is missed). "Today" uses the server's local day. The older
`GET /api/dashboard/summary` still exists but no page uses it any more.

## Deployment

**Backend environment** (`backend/.env`, see `.env.example`): `DATABASE_URL` (MySQL 8),
`JWT_SECRET` (long random value), `CORS_ORIGIN` (the exact frontend origin), `PORT`;
for AI: `AI_PROVIDER`/`AI_FALLBACK_PROVIDER`, `GEMINI_API_KEY` and/or `GROQ_API_KEY`,
`AI_MODEL`/`AI_FALLBACK_MODEL` (generation fails with a clear error until a provider and
model are set), `AI_USER_DAILY_LIMIT`, `AI_DAILY_LIMIT`; the optional `RAG_*` settings
are listed above. **Frontend:** only `VITE_API_URL` (the public API base URL, ending in
`/api`); no secret ever reaches the browser.

**Database:** run `npx prisma migrate deploy` from `backend/` on every release (never
`migrate dev` or `migrate reset` against production data). The migrations are written to
be applied in order on an empty database or on one that already has the earlier ones.

**Run:** `npm --prefix backend start` behind HTTPS, and serve `frontend/dist`
(`npm --prefix frontend run build`) as static files with a fallback to `index.html` for
client-side routes. Uploaded files are processed in memory and not stored on disk, so the
backend needs no persistent volume. Rate limits are in-memory per process, so run a single
instance or move them to a shared store before scaling out. Node 20+ is required.

## Exam API

All exam endpoints require a bearer token:

```text
POST   /api/exams
GET    /api/exams?page=1&limit=20
GET    /api/exams/:id
PUT    /api/exams/:id
DELETE /api/exams/:id
```

Create and update requests use:

```json
{
  "name": "Database Systems",
  "examDate": "2026-12-01T00:00:00.000Z",
  "dailyStudyHours": 2.5
}
```

Exam records are always filtered by the authenticated user's ID. A user
cannot read, update, or delete another user's exam. List responses include
`items` and `pagination` metadata; `limit` is capped at 100.

## Subject API

All subject endpoints require a bearer token:

```text
POST   /api/exams/:examId/subjects
GET    /api/exams/:examId/subjects?page=1&limit=20
PUT    /api/subjects/:id
DELETE /api/subjects/:id
```

Subject creation and listing first verify that the parent exam belongs to the
authenticated user. Direct update and delete operations verify the same
ownership through the subject's exam relationship.

## Topic API

All topic endpoints require a bearer token:

```text
POST   /api/subjects/:subjectId/topics
GET    /api/subjects/:subjectId/topics?page=1&limit=20
PUT    /api/topics/:id
DELETE /api/topics/:id
```

Topic requests accept the following difficulty values:

```text
WEAK
AVERAGE
STRONG
```

Every topic operation verifies ownership through the full relationship:

```text
Authenticated user → Exam → Subject → Topic
```

## Database Schema

Prisma models are defined in `backend/prisma/schema.prisma`:

- `User`
- `Exam`
- `Subject`
- `Topic`
- `StudySession`
- `QuizResult`

Validate the schema with:

```bash
$env:DATABASE_URL="mysql://username:password@localhost:3306/ai_study_planner"
npm --prefix backend run prisma:validate
```

Generate the Prisma Client after installing dependencies or changing the schema:

```bash
npm --prefix backend run prisma:generate
```

After MySQL is running and the database exists, the initial migration will be created in the next database phase:

```bash
npm --prefix backend run prisma:migrate -- --name init
```
