export default function PageHeader({ eyebrow, title, description, actions, aside }) {
  return (
    <div className={`lynx-page-header ${aside ? 'lynx-page-header-has-aside' : ''}`}>
      <div>
        {eyebrow && <p className="lynx-eyebrow">{eyebrow}</p>}
        <h1 className="lynx-h1">{title}</h1>
        {description && <p className="lynx-muted lynx-sub">{description}</p>}
      </div>
      {actions && <div className="lynx-page-header-actions">{actions}</div>}
      {aside && <div className="lynx-page-header-aside">{aside}</div>}
    </div>
  );
}
