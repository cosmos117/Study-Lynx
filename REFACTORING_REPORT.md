# Refactoring Report

Companion to [CODEBASE_AUDIT.md](CODEBASE_AUDIT.md). All changes preserve behaviour, API responses, the database schema (apart from the earlier Google sign-in migration) and the UI. Nothing is committed.

## Outcome in one paragraph

The audit found the repository already well structured and small: 185 tracked files and about 10k lines, with a layered backend and no unused source files. The apparent size comes from `node_modules/` and `dist/`, which are gitignored. So the work was targeted fixes rather than a restructure.

## Changes

| Area | Change |
|---|---|
| Duplication (M2) | 33 copies of `err.response?.data?.message \|\| '...'` across 16 frontend files now call the existing `errorMessage()` helper. The local `errorText` helper in `Materials.jsx` is gone. Side effect: AI error codes now get their friendly text on these pages too. |
| Readability (M4) | `Exams.jsx`: a 600-character nested-ternary JSX line became `ExamList` and `ExamCard` components. |
| Security (M3) | JWT signing and verification pin `HS256`. New `backend/src/utils/jwt.test.js` covers round trip, a different algorithm, and an unsigned token. |
| Security (M1) | Backend `body-parser` and `qs` updated to patched versions (within the existing `express` range). Frontend `npm audit` now reports 0 vulnerabilities. |
| Docs (M5, L3) | Removed the stale `ARCHITECTURE_REPORT.md` (still in git history). README now covers Google sign-in, env vars, project layout, and the test and build commands. |
| DX (L2) | Root `npm test` and `npm run build` scripts. |
| Naming (L1) | "Studylyx" became "Study Lynx" in the server log and health message. |

## Files

- Added: `CODEBASE_AUDIT.md`, `REFACTORING_REPORT.md`, `backend/src/utils/jwt.test.js`
- Removed: `ARCHITECTURE_REPORT.md`
- Modified: `package.json`, `README.md`, `backend/package-lock.json`, `backend/src/utils/jwt.js`, `backend/src/server.js`, `backend/src/app.js`, `frontend/src/pages/Exams.jsx`, plus the 16 frontend files that now use `errorMessage()`
- Directory structure: unchanged (it already matched the target layout).

## Validation (actually run)

| Check | Before | After |
|---|---|---|
| Backend tests (`npm test`) | 150 passed | 153 passed (3 new) |
| Frontend build | passes | passes |
| `npm audit --omit=dev`, backend | 6 issues | 4 high (see below) |
| `npm audit --omit=dev`, frontend | 1 high | 0 |

No failures before or after. There is no linter, type checker or frontend test suite to run.

## Known limitations and remaining debt

1. **`zod` < 4.6.6 (high).** The fix is a major upgrade (3 to 4) across 9 schema files. Run the suite after upgrading. Not done.
2. **`deepmerge-ts` via the Prisma CLI (high, dev tooling).** `npm audit fix` "resolves" it by downgrading Prisma to 6.12.0, which mismatches the 6.19.3 client. I tried that, saw the mismatch and rolled it back. Wait for a Prisma release that updates the dependency.
3. **Token storage.** The JWT lives in `localStorage`. httpOnly cookies would be safer but change the API and CORS contract.
4. **No linting or formatting.** ESLint and Prettier would add dev dependencies and a large formatting diff. `Plan.jsx` still has dense one-line handlers (lines 60-72).
5. **No frontend tests**, and no integration tests against a real database.
6. **Untracked `abc.exe`** in the repo root was left alone. It was not run or deleted. Remove it if you don't recognise it.
7. **Pre-existing working-tree changes** (your landing-page work and the Google sign-in) are mixed with these edits in `git status`. Review the diff before committing.

## Recommended next steps

1. Review and commit the changes, ideally as separate commits: Google sign-in, landing page, cleanup.
2. Upgrade zod to v4 and re-run the suite.
3. Add ESLint (flat config) with `react-hooks` rules, then Prettier, as one dedicated formatting commit.
4. Add Vitest and React Testing Library tests for Login and Register, and Supertest integration tests for auth and exams.
5. Consider httpOnly cookie sessions.

---

## Simplification around 5 core features (2026-10-29)

The app had grown confusing: one topic's work was split across two layers of tabs (Topic Hub and Topic Study) plus separate Plan, Quizzes, Materials, AI Tutor and Analytics pages, and setup was three levels deep (Exam → Subject → Topic). It was refocused on five features: Ask AI (RAG), 10-question quizzes, flashcards with spaced repetition, distraction-free videos, and a Pomodoro timer.

### What changed

| Area | Change |
|---|---|
| Data model | Exam folded into Subject: subjects belong to the user and have an optional `examDate`. Migration `20261029140000_fold_exam_into_subject` backfills subjects from their exam before dropping `Exam`. |
| Navigation | Sidebar is Home, Subjects, Review (with a due-card badge) and Settings. |
| Topic page | One page per topic with tabs Sources, Ask AI, Flashcards, Quiz, Watch and Mind map. Replaces Topic Hub, Topic Study, Materials and the global AI Tutor page. |
| Pomodoro | Floating widget on every signed-in page. Time is stored as an end timestamp in `localStorage`, so it survives navigation and refreshes. Chime and popup at the end of each block; the break starts automatically. Custom lengths in Settings. Each focus block is a study session, so it counts toward the streak. |
| Quiz | Always exactly 10 questions (schema and prompt). |
| Ask AI | Answers can be saved to the topic's notes; a "Make notes from my sources" shortcut. |
| Old URLs | Redirect to the nearest new page. |

### Removed

- Backend: exam routes, controller, service and schemas; the unused `/api/dashboard/summary`; the study-plan generator (`POST /api/study-sessions/generate`); `goalMinutes` in the overview (it came from the exam's daily hours).
- Frontend pages: Plan, Quizzes, Analytics, Materials, AI Tutor, Focus Session, Topic Hub, Topic Study, Exams, Exam Details; components in `hub/`, `SectionTabs`, `StudySessionCard`, `SubjectCard`, `MasteryMeter`, `LearningResourceSection`; hook `useStartSession`; unused API client functions.
- Backend services that still work (analytics, notes generation, topic ranking) are kept but no longer shown.

### Added

- `GET /api/flashcards/due/count` (a single COUNT, for the sidebar badge).
- Frontend: `pages/Subjects.jsx`, `pages/Topic.jsx`, `components/topic/*`, `context/PomodoroContext.jsx`, `components/PomodoroWidget.jsx`, `utils/pomodoro.js`, `utils/chime.js`.
- Tests: subject and topic ownership (mocked Prisma), subjects route validation, removed routes return 404, quiz is exactly 10 questions, and 17 frontend tests for the timer logic (Vitest added to the frontend as a dev dependency).

### Validation

- Backend: 208 tests pass. Frontend: 17 tests pass. Frontend production build passes.
- Migration applied to the dev database (which had no exams or subjects). Live read-only check: `/api/subjects`, `/api/overview`, `/api/flashcards/due/count`, `/api/recall/summary` return 200; `/api/exams` returns 404.
- Not checked in a browser: the UI, the chime, and the popups.

### Known limitations

- The Pomodoro timer and its settings are stored per browser, not per account.
- Flashcards can't be edited or deleted one by one (they couldn't before either).
- Some CSS for the removed pages is still in the stylesheets.

