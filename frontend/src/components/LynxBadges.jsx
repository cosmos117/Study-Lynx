export function LynxBadge({ color, children }) {
  return (
    <span className="lynx-pill">
      <span className="lynx-dot" style={{ background: color }} aria-hidden="true" />
      {children}
    </span>
  );
}
