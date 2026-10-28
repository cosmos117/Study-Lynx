# Study Lynx — Architecture Report

**Status:** Analysis only. No application code was created, modified, or deleted during this phase.
**Stack confirmed:** React 18 + Vite (frontend) · Node.js + Express (backend) · MySQL + Prisma ORM · JWT auth · AI providers: Gemini (primary), Groq (fallback), mock.

## 1. Executive summary

Study Lynx already implements a large part of the intended product: auth, the Exam → Subject → Topic flow, AI-generated Notes/Flashcards/Quiz/Mind Map, SM-2 spaced repetition, study sessions, quiz results, and a dashboard summary. What is missing is mostly additive: YouTube learning, document upload/RAG, AI Tutor chat, study planning, Pomodoro, topic mastery recalculation, and analytics on the dashboard. The existing layered structure (routes → controllers → services → Prisma), the AI provider abstraction, zod validation, and the design system can be reused with little or no change.

## 2. Current state inventory

### 2.1 Backend (`backend/src`)

| File/area | Responsibility |
|---|---|
| `app.js`, `server.js` | Express app: helmet, cors, JSON, health check, route mounting, 404 + error middleware |
| `config/env.js` | Port, CORS, DATABASE_URL, JWT, AI provider settings (gemini/groq), limits, timeouts |
| `config/prisma.js` | Singleton PrismaClient |
| `routes/authRoutes.js` | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| `routes/dashboardRoutes.js` | `GET /dashboard/summary` |
| `routes/examRoutes.js` | CRUD for exams (`/api/exams`) |
| `routes/subjectRoutes.js` | CRUD for subjects (`/api/exams/:examId/subjects`, `/api/subjects/:id`) |
| `routes/topicRoutes.js` | CRUD for topics (`/api/subjects/:subjectId/topics`, `/api/topics/:id`) |
| `routes/learningRoutes.js` | Notes, flashcards, quiz, mindmap generate/get/submit/review/due; `GET /ai/usage` |
| `routes/motivationRoutes.js` | `GET /motivation/today` |
| `controllers/*` | Thin controllers calling services (auth, exam, subject, topic, ai, learning, dashboard, motivation) |
| `services/authService.js` | Register/login/me with bcrypt + JWT |
| `services/examService.js`, `subjectService.js`, `topicService.js` | Ownership-verified CRUD (user → exam → subject → topic) |
| `services/learningService.js` | AI content get/generate/save, flashcard CRUD + SM-2 review, due list, quiz submit, QuizResult creation |
| `services/aiContentService.js` | `getOrGenerate` with GENERATING→READY/FAILED lock, lock timeout (90s), regenerate guard |
| `services/sm2.js` | Pure SM-2 review scheduler (AGAIN → 10 min, ease floor 1.3) — unit tested |
| `services/dashboardService.js` | `getDashboardSummary`: totals (exams/subjects/topics), recent sessions (5), topic progress (10) |
| `services/ai/aiService.js` | Provider abstraction: primary/fallback, retry+backoff, output repair loop, abort/timeout, usage limits |
| `services/ai/providers/{gemini,groq,mock}.js` | Provider implementations |
| `services/ai/features.js` | Zod schemas + system prompts for NOTES, FLASHCARDS, QUIZ, MINDMAP |
| `services/ai/{errors,json,limits}.js` | AiError hierarchy, JSON fence stripping/validation, Prisma-backed daily usage counters |
| `middleware/authMiddleware.js` | Bearer JWT verification → `request.user.id` |
| `middleware/validateMiddleware.js` | Zod request validation |
| `middleware/errorMiddleware.js` | Centralized error handler; `AI_*` codes masked from logs |
| `middleware/rateLimiters.js`, `aiRateLimiters.js` | Auth and AI generation rate limits |
| `utils/{asyncHandler,httpError,jwt,pagination,password,user}.js` | Shared utilities |
| `prisma/schema.prisma` | Data model (see 2.3) |
| `prisma/migrations/` | `init`, `add_ai_learning_features` |
| `*.test.js` | vitest: sm2, motivationService, aiService — **10 tests passing** |

### 2.2 Frontend (`frontend/src`)

| File/area | Responsibility |
|---|---|
| `App.jsx` | Routes: Landing, Login, Register, protected dashboard/exams/exam details/topic study |
| `layouts/AppLayout.jsx` | Header (logo, user, theme toggle, logout) + sidebar nav (Overview, Exams) + outlet |
| `pages/Dashboard.jsx` | Welcome hero, streak badge, stat cards (exams/subjects/topics), motivation, recent sessions, topic progress |
| `pages/Exams.jsx` | Exam list + create form |
| `pages/ExamDetails.jsx` | Exam update, subject/topic CRUD, links to topic study |
| `pages/TopicStudy.jsx` | Tabs: Notes / Flashcards / Quiz / Mind map; flip-card review; quiz submit + score; mind map SVG export |
| `pages/Login.jsx`, `Register.jsx` | Auth forms (shared `AuthFormShell`) |
| `pages/Landing.jsx` | Marketing page with feature list |
| `context/AuthContext.jsx` | JWT in localStorage, `/auth/me` refresh, login/register/logout |
| `hooks/useGenerate.js` | AI_BUSY retry polling with 90s deadline |
| `services/api.js` | Axios client with Bearer interceptor; wrappers for auth/dashboard/ai/motivation/notes/flashcards/quiz/mindmap/exam/subject/topic |
| `theme/ThemeContext.jsx` | Light/dark theme (localStorage + prefers-color-scheme) |
| `theme/tokens.js` | Color tokens, `difficultyColor()`, `statusColor()` |
| `components/` | Card, BrandMark, LoadingSpinner, LynxBadges (DifficultyBadge, StatusBadge, StreakBadge, ActiveSessionCard), ProtectedRoute, SubjectCard, ThemeToggle |
| `index.css`, `lynx-a/b/c/d.css` | Custom-property design system (`--lynx-*`), light/dark variants, layout utilities |
