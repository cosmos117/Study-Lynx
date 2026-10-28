export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="lynx-page-header">
      <div>
        {eyebrow && <p className="lynx-eyebrow">{eyebrow}</p>}
        <h1 className="lynx-h1">{title}</h1>
        {description && <p className="lynx-muted lynx-sub">{description}</p>}
      </div>
      {actions && <div className="lynx-page-header-actions">{actions}</div>}
    </div>
  );
}
