/**
 * Inline message. Errors are announced immediately to screen readers (role="alert");
 * success and info messages are announced politely (role="status").
 */
export default function Alert({ tone = 'error', children, onRetry, className = '' }) {
  if (!children) return null;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`lynx-alert lynx-alert-${tone} ${className}`}>
      <span>{children}</span>
      {onRetry && <button type="button" onClick={onRetry} className="lynx-link-btn">Retry</button>}
    </div>
  );
}
