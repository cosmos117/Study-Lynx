export const formatMinutes = (minutes) => (minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`);

export const formatDate = (value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export const orDash = (value) => (value === null || value === undefined ? '—' : `${value}%`);

/** Local YYYY-MM-DD, for the date parameter the study-session API expects. */
export const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
