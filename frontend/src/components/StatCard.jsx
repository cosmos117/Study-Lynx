import Card from './Card.jsx';

export default function StatCard({ label, value, detail, tone = 'primary', icon = '•' }) {
  return (
    <Card className={`lynx-stat-card lynx-stat-${tone}`}>
      <div className="lynx-stat-icon" aria-hidden="true">{icon}</div>
      <p className="lynx-muted lynx-stat-label">{label}</p>
      <p className="lynx-stat-value">{value}</p>
      {detail && <p className="lynx-muted lynx-caption">{detail}</p>}
    </Card>
  );
}
