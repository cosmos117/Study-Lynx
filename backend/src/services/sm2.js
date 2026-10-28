const qualityByRating = { AGAIN: 0, HARD: 3, GOOD: 4, EASY: 5 };

export function reviewCard(review, rating, now = new Date()) {
  const quality = qualityByRating[rating];
  if (quality === undefined) throw new Error('Invalid review rating');
  let { easeFactor, intervalDays, repetitions, lapses } = review;

  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
    lapses += 1;
  } else {
    repetitions += 1;
    const baseInterval = repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.round(intervalDays * easeFactor);
    const multiplier = rating === 'HARD' ? 1.2 : rating === 'EASY' ? 1.3 : 1;
    intervalDays = Math.max(1, Math.round(baseInterval * multiplier));
  }

  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );
  const dueAt = new Date(now.getTime() + intervalDays * 86400000);
  if (rating === 'AGAIN') dueAt.setTime(now.getTime() + 10 * 60000);

  return {
    easeFactor, intervalDays, repetitions, lapses, dueAt, lastReviewedAt: now,
  };
}
