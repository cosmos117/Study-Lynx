export const NIGHT_LYNX = {
  primary: '#4F46E5',
  primaryHover: '#4338CA',
  accent: '#F59E0B',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  muted: '#64748B',
  dark: {
    background: '#0B1020',
    surface: '#151B2E',
    border: '#262E47',
    text: '#E6E9F5',
    muted: '#94A3B8',
    primary: '#818CF8',
    accent: '#FBBF24',
  },
  status: { completed: '#10B981', planned: '#38BDF8', overdue: '#EF4444' },
  difficulty: { WEAK: '#EF4444', AVERAGE: '#F59E0B', STRONG: '#10B981' },
};

/** Map backend difficulty → Night Lynx badge color. */
export function difficultyColor(difficulty) {
  return NIGHT_LYNX.difficulty[difficulty] || NIGHT_LYNX.muted;
}

/** Map session/status kind → Night Lynx status color. */
export function statusColor(status) {
  const key = String(status || '').toLowerCase();
  if (key.includes('complet') || key.includes('done')) return NIGHT_LYNX.status.completed;
  if (key.includes('plan') || key.includes('upcoming')) return NIGHT_LYNX.status.planned;
  if (key.includes('skip') || key.includes('overdue') || key.includes('miss')) return NIGHT_LYNX.status.overdue;
  return NIGHT_LYNX.muted;
}
