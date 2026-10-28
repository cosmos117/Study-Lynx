import { Link } from 'react-router-dom';
import Card from './Card.jsx';
import { StatusBadge } from './LynxBadges.jsx';

const KIND = { COMPLETED: 'Completed session', IN_PROGRESS: 'Session in progress', SKIPPED: 'Skipped session' };

export default function StudySessionCard({ session, planned = false, onStart, onSkip }) {
  const topic = session?.topic;
  return (
    <Card className="lynx-session-card">
      <div className="lynx-session-time"><span className="lynx-session-dot" />{KIND[session?.status] || (planned ? 'Planned session' : 'Recent session')}</div>
      <div className="lynx-row-between">
        <div>
          <h3 className="lynx-h3">{topic?.name || 'Study session'}</h3>
          <p className="lynx-muted lynx-caption">{topic?.subject?.name || 'Your study workspace'} · {session?.duration || 25} min</p>
        </div>
        {session?.status === 'SKIPPED' ? <StatusBadge status="skipped" label="Skipped" /> : session?.status === 'COMPLETED' ? <StatusBadge status="completed" label="Completed" /> : session?.status === 'IN_PROGRESS' ? <StatusBadge status="planned" label="In progress" /> : <StatusBadge status="planned" label={planned ? 'Next up' : 'Planned'} />}
      </div>
      <div className="lynx-session-actions">
        {topic?.id && onStart && session?.status !== 'COMPLETED' && session?.status !== 'SKIPPED' && <button type="button" onClick={() => onStart(session)} className="lynx-btn lynx-btn-primary lynx-btn-sm">{planned ? 'Start session' : 'Start'}</button>}
        {session?.status === 'PLANNED' && onSkip && <button type="button" onClick={() => onSkip(session)} className="lynx-btn lynx-btn-ghost lynx-btn-sm">Skip</button>}
        {topic?.id && <Link to={`/topics/${topic.id}`} className="lynx-text-link lynx-session-action">Open topic hub →</Link>}
      </div>
    </Card>
  );
}
