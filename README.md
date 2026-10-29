# Study Lynx

A distraction-free study app: learn a topic from your own material, ask AI your doubts, and remember it with flashcards and quizzes.

## What it does

- **Ask AI (RAG):** ask doubts or make notes, answered from your own PDFs and notes, with the passages shown. Save any answer to your notes.
- **Quiz:** 10 multiple-choice questions built from your sources, with an explanation for every answer.
- **Flashcards:** generated from your sources, reviewed with spaced repetition (Again / Hard / Good / Easy) for active recall.
- **Distraction-free videos:** YouTube lectures without recommendations, comments or autoplay, next to a notes panel.
- **Pomodoro timer:** floats over every page, chimes and pops up when it's break time, and builds your 🔥 streak. Focus and break lengths are set in Settings.
- Also: a month calendar with exam dates, and mind maps for a topic.

## How to use it

1. **Subjects:** add a subject (with an optional exam date), then its topics.
2. **Open a topic → Sources:** upload a PDF or paste notes.
3. **Start focus:** the Pomodoro starts and follows you across pages.
4. **Ask AI:** clear doubts, or tap *Make notes from my sources* and save the answer.
5. **Flashcards:** generate a set, then rate each card. Due cards come back in **Review**.
6. **Quiz:** take 10 questions and read the explanations.
7. **Watch:** add a YouTube link and study it in the focused player.
8. **Every day:** Home shows cards due and your streak, and **Review** works through them.

## Built with

React and Vite on the frontend, Node.js and Express on the backend, MySQL with Prisma for data. AI uses Gemini, with Groq as a backup.

## Run it locally

You need Node.js 20 or newer and MySQL 8.

1. Install everything:

   ```bash
   npm run install:all
   ```

2. Create `backend/.env` from `backend/.env.example` and fill in your database details and a secret (see below).

3. Set up the database:

   ```bash
   cd backend
   npx prisma migrate deploy
   ```

4. Start the app from the project root:

   ```bash
   npm run dev
   ```

The app opens at http://localhost:5173 and the API runs on http://localhost:5000.

## Settings (`backend/.env`)

| Setting | What it is |
|---|---|
| `DATABASE_URL` | Your MySQL connection string |
| `JWT_SECRET` | A long random secret (at least 32 random bytes) |
| `CORS_ORIGIN` | The address of the frontend |
| `GEMINI_API_KEY` / `GROQ_API_KEY` | AI keys. Without one, AI features are unavailable but everything else works |
| `AI_MODEL` | The model name to use with your key |
| `GOOGLE_CLIENT_ID` | Optional. Enables "Continue with Google" (see below) |

Make a good secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

The frontend reads `frontend/.env` (see `frontend/.env.example`): `VITE_API_URL` (default `http://localhost:5000/api`) and the optional `VITE_GOOGLE_CLIENT_ID`. Other optional backend settings are listed in `backend/.env.example`.

### Google sign-in (optional)

Create an OAuth client ID of type "Web application" in Google Cloud Console and add `http://localhost:5173` (and your production URL) as an authorized JavaScript origin. Put the same client ID in `GOOGLE_CLIENT_ID` (backend) and `VITE_GOOGLE_CLIENT_ID` (frontend). Leave both blank to hide the button.

## Project layout

```
backend/src
  routes/ -> controllers/ -> services/ -> prisma     request flow
  schemas/        zod validation for request bodies
  middleware/     auth, rate limits, uploads, errors
  services/ai/    providers (Gemini, Groq, mock) and AI features
  services/rag/   ingestion, chunking, embeddings, retrieval, tutor
frontend/src
  pages/          one file per screen (Home, Subjects, Topic, Review, Settings, video player)
  components/     shared UI; topic/ holds the topic page's tabs
  context/        auth state and the app-wide Pomodoro timer
  services/api.js every backend call, grouped by resource
  utils/pomodoro.js  the timer logic (pure, unit tested)
```

## Tests and build

From the project root:

```bash
npm test        # backend and frontend tests (Vitest)
npm run build   # production build of the frontend
```

## Privacy

Your materials, notes and results belong to your account. AI Tutor only searches your own uploads.

## Putting it online

Run `npx prisma migrate deploy` on every release, serve the API over HTTPS, and build the frontend with `npm --prefix frontend run build`. Serve the `frontend/dist` folder as static files, sending unknown paths to `index.html`.
