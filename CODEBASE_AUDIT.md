# Codebase Audit

Audit date: 2026-10-29. Scope: whole repository. Findings were verified by reading the code, running the test suite and build, and running `npm audit`.

## 1. Stack and architecture

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 6, react-router 7, axios. Plain CSS (five global files plus `landing.css`). JavaScript, no TypeScript. |
| Backend | Node 20+, Express 4, ES modules. zod validation, helmet, express-rate-limit, multer, JWT + bcrypt, Google ID-token sign-in. |
| Data | MySQL through Prisma 6 (`backend/prisma/schema.prisma`, 14 migrations). |
| AI | Gemini primary, Groq fallback, mock provider for tests. Local embeddings for RAG. |
| Tooling | Vitest for backend tests (150). No linter, formatter, type checker or frontend tests. |

Backend request flow is already layered: `routes -> middleware (auth, rate limit, zod validate) -> controllers -> services -> prisma`. Controllers are thin, errors go through `asyncHandler` + `errorMiddleware`, and every service checks ownership by user. The AI and RAG code is split into providers, ingestion, chunking, embedding, vector store and retrieval, each with tests.

Frontend flow: `pages -> services/api.js (axios, one object per resource) -> backend`. Auth state lives in `AuthContext`, theme in `ThemeContext`, and shared UI is in `components/` (feature panels in `components/hub/`).

## 2. Directory structure (tracked files)

```
backend/
  prisma/            schema + migrations
  src/
    config/          env.js, prisma.js
    controllers/ (13) routes/ (13)  schemas/ (9)  middleware/ (6)
    services/        domain services, ai/ (+providers/), rag/
    utils/ (6)       data/motivation.json
frontend/
  public/            logo mark
  src/
    pages/ (18)  components/ (19, hub/ 6)  hooks/ (4)  utils/ (3)
    context/  layouts/  theme/  services/api.js  *.css
```

## 3. Findings

The size concern is mostly not about tracked code. Only 185 files are tracked and about 10k lines of source (the largest source file is 331 lines). The bulk on disk is `node_modules/` and `frontend/dist/`, both already gitignored and safe to regenerate.

### Medium

| # | Finding | Evidence |
|---|---|---|
| M1 | Known vulnerable dependencies. Backend: `body-parser`, `qs` (fixed), `deepmerge-ts` via prisma CLI and `zod` (documented in REFACTORING_REPORT.md). Frontend: 1 high (fixed). |
| M2 | The "request failed" message logic is copy-pasted 33 times (`err.response?.data?.message \|\| '...'`), although `utils/aiErrors.js` already provides `errorMessage()` that does the same and more. | grep across `frontend/src` |
| M3 | JWT verification does not pin an algorithm. | `backend/src/utils/jwt.js` |
| M4 | `Exams.jsx` renders its whole list card in a single ~600-character JSX line, which is hard to read and review. `Plan.jsx` has similar dense one-liners. | `Exams.jsx:74`, `Plan.jsx:60-72` |
| M5 | `ARCHITECTURE_REPORT.md` is stale. It describes the project as "analysis only" and lists YouTube, RAG, AI Tutor, planning and analytics as missing, but all of these are now implemented. | root |

### Low

| # | Finding |
|---|---|
| L1 | Product name is inconsistent: "Studylyx" in `server.js` and the health endpoint, "Study Lynx" everywhere else. |
| L2 | No root-level `test` or `build` scripts, so a new developer has to know to `cd` into each package. |
| L3 | README does not mention Google sign-in, the frontend env var, or the project layout. |
| L4 | No ESLint or Prettier configuration. Adding them means new dependencies and a large formatting diff, so this is documented rather than done. |
| L5 | JWT is stored in `localStorage` (readable by any XSS). Moving to httpOnly cookies is an API and CORS change, so it is documented only. |
| L6 | Upload type check trusts the client MIME type. Mitigated: ingestion validates the actual PDF content and the tests cover corrupt and mislabeled files. No change needed. |
| L7 | `zod` fix requires a major version bump (3 to 4), which touches all 9 schema files. Not done. See remaining debt. |

### Checked and fine

- No hard-coded secrets. `.env*` is gitignored except `.env.example`.
- No unused tracked source files. Every component, hook, util and service is imported somewhere. Every key in `api.js` is used by a page.
- No unused npm dependencies (`nodemon`, `prisma` and `vitest` are CLI tools used by scripts).
- Ownership checks, validation (zod on all write routes), rate limiting on auth, helmet, a single-origin CORS policy, upload size limits and AI daily limits are all in place.
- The error handler returns a generic message for 500s and does not leak internals. Logs are limited to error codes or messages.

### Untracked local file

`abc.exe` (135 KB) sits in the repo root. It is gitignored, referenced by nothing in the code, and not something this project builds. It was **not deleted or run**. Delete it yourself if you don't recognise it.

## 4. Plan (in order, all behaviour-preserving)

1. Baseline: run tests and build (done: 150 backend tests pass, frontend builds).
2. `npm audit fix` (non-breaking only) in both packages, then re-run tests and build.
3. Replace the 33 duplicated error-message expressions with `errorMessage()`.
4. Pin the JWT algorithm to HS256, with a test.
5. Extract `ExamCard` from `Exams.jsx`.
6. Fix the product name, add root `test` and `build` scripts, update the README, and remove the stale `ARCHITECTURE_REPORT.md`.
7. Re-run all validation and write `REFACTORING_REPORT.md`.

Not planned: directory restructuring (the current layout already follows the target), TypeScript migration, zod 4 upgrade, linter and formatter adoption.
