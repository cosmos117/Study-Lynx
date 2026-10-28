# Study Lynx

A study planner that helps you decide what to study, learn it from your own materials, and remember it.

## What it does

- **Plan:** add exams, subjects and topics, then get daily study sessions with a focus timer.
- **Topic hub:** every topic has one page with its videos, materials, flashcards, quiz and progress, plus a suggested next step.
- **AI Tutor:** ask questions and get answers from your own PDFs, notes and video transcripts, with the passages shown.
- **Active recall:** flashcards that come back on a spaced schedule.
- **Quizzes:** practice questions with an explanation for each answer.
- **Progress:** mastery for each topic, weak areas, study time and a streak.

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

Make a good secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

The frontend only needs `VITE_API_URL` (default `http://localhost:5000/api`). Other optional settings are listed in `backend/.env.example`.

## Tests

```bash
cd backend
npm test
```

## Privacy

Your materials, notes and results belong to your account. AI Tutor only searches your own uploads.

## Putting it online

Run `npx prisma migrate deploy` on every release, serve the API over HTTPS, and build the frontend with `npm --prefix frontend run build`. Serve the `frontend/dist` folder as static files, sending unknown paths to `index.html`.
