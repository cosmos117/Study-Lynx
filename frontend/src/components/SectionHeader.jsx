export default function SectionHeader({ title, description, action }) {
  return (
    <div className="lynx-section-header">
      <div>
        <h2 className="lynx-h2">{title}</h2>
        {description && <p className="lynx-muted lynx-caption">{description}</p>}
      </div>
      {action}
    </div>
  );
}
