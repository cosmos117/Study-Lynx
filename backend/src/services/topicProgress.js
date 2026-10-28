/**
 * Pure rules behind the Topic Learning Hub: how mastery is scored and which step of the
 * learning loop (plan → learn → recall → quiz → analyze → revise) comes next.
 * No I/O here, so the rules are easy to test and change in one place.
 */

// Share of the mastery score each signal contributes. Signals the student hasn't
// produced yet are left out and the remaining weights are rescaled.
const WEIGHTS = { quiz: 0.5, recall: 0.35, study: 0.15 };
const STUDY_MINUTES_FOR_FULL_SCORE = 120;
const WEAK_BELOW = 50;
const STRONG_AT = 75;
const LOW_QUIZ = 0.6;

const clamp01 = (value) => Math.min(1, Math.max(0, value));

/**
 * @param {{ quizAverage: number|null, recallRate: number|null, studyMinutes: number }} signals
 *   quizAverage: mean fraction (0–1) of the last few quiz attempts
 *   recallRate: fraction (0–1) of recent flashcard reviews rated GOOD or EASY
 * @returns {{ score: number|null, level: 'WEAK'|'AVERAGE'|'STRONG'|null, components: object }}
 */
export function computeMastery({ quizAverage = null, recallRate = null, studyMinutes = 0 }) {
  const parts = {
    quiz: quizAverage === null ? null : clamp01(quizAverage),
    recall: recallRate === null ? null : clamp01(recallRate),
    study: studyMinutes > 0 ? clamp01(studyMinutes / STUDY_MINUTES_FOR_FULL_SCORE) : null,
  };
  const used = Object.keys(parts).filter((key) => parts[key] !== null);
  if (!used.length) return { score: null, level: null, components: parts };

  const totalWeight = used.reduce((sum, key) => sum + WEIGHTS[key], 0);
  const raw = used.reduce((sum, key) => sum + parts[key] * WEIGHTS[key], 0) / totalWeight;
  const score = Math.round(raw * 100);
  const level = score < WEAK_BELOW ? 'WEAK' : score < STRONG_AT ? 'AVERAGE' : 'STRONG';
  return { score, level, components: parts };
}

/**
 * Recommend the single most useful next action for a topic.
 * `stage` places it on the learning loop so the UI can show where the student is.
 */
export function recommendNextStep({
  documentCount = 0,
  videoCount = 0,
  cardsTotal = 0,
  cardsDue = 0,
  quizReady = false,
  latestQuizFraction = null,
  mastery = { score: null },
  weakAreaCount = 0,
}) {
  if (cardsDue > 0) {
    return { key: 'REVIEW_RECALL', stage: 'RECALL', title: `Review ${cardsDue} due card${cardsDue === 1 ? '' : 's'}`, reason: 'Spaced repetition works best when cards are reviewed on time.' };
  }
  if (documentCount + videoCount === 0 && cardsTotal === 0) {
    return { key: 'ADD_MATERIAL', stage: 'LEARN', title: 'Add something to learn from', reason: 'Add a video or upload notes so flashcards, quizzes and AI Tutor can use your own material.' };
  }
  if (cardsTotal === 0) {
    return { key: 'GENERATE_FLASHCARDS', stage: 'RECALL', title: 'Create flashcards', reason: 'Turn what you have learned into cards you can review.' };
  }
  if (latestQuizFraction === null) {
    return quizReady
      ? { key: 'TAKE_QUIZ', stage: 'QUIZ', title: 'Take the quiz', reason: 'A quiz shows what you actually remember.' }
      : { key: 'GENERATE_QUIZ', stage: 'QUIZ', title: 'Create a quiz', reason: 'Test yourself to find the gaps.' };
  }
  if (latestQuizFraction < LOW_QUIZ || (mastery.score !== null && mastery.score < WEAK_BELOW)) {
    return weakAreaCount > 0 || documentCount + videoCount > 0
      ? { key: 'ASK_TUTOR', stage: 'REVISE', title: 'Revise your weak spots', reason: 'Ask AI Tutor to explain what you missed, then review your cards.' }
      : { key: 'STUDY_NOW', stage: 'REVISE', title: 'Study this topic again', reason: 'Your recent results show room to improve.' };
  }
  if (mastery.score !== null && mastery.score >= STRONG_AT) {
    return { key: 'TAKE_QUIZ', stage: 'QUIZ', title: 'Confirm it with a quiz', reason: 'You are doing well. Retake the quiz to lock it in.' };
  }
  return { key: 'STUDY_NOW', stage: 'LEARN', title: 'Start a study session', reason: 'Keep building momentum on this topic.' };
}

// How much history counts: the last 50 flashcard reviews and the last 3 quiz attempts.
export const RECALL_WINDOW = 50;
export const QUIZ_WINDOW = 3;

/**
 * Turn raw rows for one topic into the signals the app reports everywhere (hub, dashboard,
 * quizzes, analytics), so they can never disagree.
 * `reviews` and `quizResults` must be newest first.
 */
export function summarizeSignals({ reviews = [], quizResults = [], sessions = [] }) {
  const recent = reviews.slice(0, RECALL_WINDOW);
  const remembered = recent.filter((review) => review.rating === 'GOOD' || review.rating === 'EASY').length;
  const recallRate = recent.length ? remembered / recent.length : null;

  const fraction = (result) => (result.totalQuestions ? result.score / result.totalQuestions : 0);
  const lastAttempts = quizResults.slice(0, QUIZ_WINDOW);
  const quizAverage = lastAttempts.length ? lastAttempts.reduce((sum, result) => sum + fraction(result), 0) / lastAttempts.length : null;
  const latestQuizFraction = quizResults.length ? fraction(quizResults[0]) : null;

  const completed = sessions.filter((session) => session.status === 'COMPLETED');
  const studyMinutes = completed.reduce((sum, session) => sum + (session.actualDuration || session.plannedDuration || 0), 0);

  return {
    recallRate,
    recallReviews: recent.length,
    quizAverage,
    latestQuizFraction,
    quizAttempts: quizResults.length,
    studyMinutes,
    sessionsCompleted: completed.length,
    mastery: computeMastery({ quizAverage, recallRate, studyMinutes }),
  };
}

/** Local calendar day as YYYY-MM-DD (the server's day, matching how "today" is used elsewhere). */
export function localDateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Consecutive days with any study activity. A streak is not broken until a whole day has
 * passed without activity, so it still counts if the student has not studied yet today.
 */
export function computeStreak(activeDayKeys, today = new Date()) {
  const days = activeDayKeys instanceof Set ? activeDayKeys : new Set(activeDayKeys);
  const cursor = new Date(today);
  cursor.setHours(12, 0, 0, 0);
  if (!days.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const UNKNOWN_MASTERY = 40;

/**
 * Order topics by what the student should study first, and say why.
 * Due cards come first, then closer exams, then the lowest mastery.
 */
export function rankTopics(topics, now = new Date()) {
  return topics
    .map((topic) => {
      const reasons = [];
      let score = 0;
      if (topic.cardsDue > 0) {
        score += 40 + Math.min(topic.cardsDue, 20);
        reasons.push(`${topic.cardsDue} card${topic.cardsDue === 1 ? '' : 's'} due`);
      }
      const mastery = topic.mastery?.score ?? null;
      score += (100 - (mastery ?? UNKNOWN_MASTERY)) * 0.5;
      reasons.push(mastery === null ? 'Not started yet' : `Mastery ${mastery}%`);
      const daysLeft = topic.examDate ? Math.ceil((new Date(topic.examDate) - now) / DAY_MS) : null;
      if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 30) {
        score += daysLeft <= 7 ? 30 : 15;
        reasons.push(daysLeft === 0 ? 'Exam today' : `Exam in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`);
      }
      return { ...topic, priority: { score: Math.round(score), reasons } };
    })
    .sort((a, b) => b.priority.score - a.priority.score || a.id - b.id);
}
