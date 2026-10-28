import { difficultyColor, statusColor } from '../theme/tokens.js';

export function LynxBadge({ color, children }) {
  return (
    <span className="lynx-pill">
      <span className="lynx-dot" style={{ background: color }} aria-hidden="true" />
      {children}
    </span>
  );
}

export function DifficultyBadge({ level }) {
  return <LynxBadge color={difficultyColor(level)}>{level}</LynxBadge>;
}

export function StatusBadge({ status, label }) {
  return <LynxBadge color={statusColor(status)}>{label || status}</LynxBadge>;
}
