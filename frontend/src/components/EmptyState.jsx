export default function EmptyState({ icon = '✦', title, description, action }) {
  return (
    <div className="lynx-empty-state">
      <span className="lynx-empty-icon" aria-hidden="true">{icon}</span>
      <h3 className="lynx-h3">{title}</h3>
      {description && <p className="lynx-muted lynx-sub">{description}</p>}
      {action}
    </div>
  );
}
