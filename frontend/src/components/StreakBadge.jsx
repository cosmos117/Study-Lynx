/** A compact study-streak badge. The fire only shows while the streak is running. */
export default function StreakBadge({ days }) {
  const label = `${days} day${days === 1 ? '' : 's'}`;
  return (
    <div className={`lynx-streak ${days > 0 ? 'is-active' : ''}`} title="Days in a row with study or recall" aria-label={`Study streak: ${label}`}>
      {days > 0 && <span className="lynx-streak-fire" aria-hidden="true">🔥</span>}
      <strong>{label}</strong>
      <span>streak</span>
    </div>
  );
}
