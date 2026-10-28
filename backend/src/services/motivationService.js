import motivations from '../data/motivation.json' with { type: 'json' };

export function getMotivationToday(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const current = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayOfYear = Math.floor((current - start) / 86400000);
  return motivations[dayOfYear % motivations.length];
}
