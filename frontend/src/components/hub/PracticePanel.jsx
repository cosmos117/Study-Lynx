import { Link } from 'react-router-dom';
import Card from '../Card.jsx';
import ProgressBar from '../ProgressBar.jsx';
import SourcePicker from './SourcePicker.jsx';
import { formatDate } from '../../utils/format.js';

export default function PracticePanel({ hub, busy, onGenerate, sources, excluded, onToggle }) {
  const { quizReady, latest, attempts, history } = hub.practice;
  const quizLink = `/topics/${hub.topic.id}/study?tab=Quiz`;
  return (
    <div className="lynx-stack-tight">
      <div className="lynx-hub-grid">
        <Card className="lynx-hub-card">
          <div className="lynx-row-between">
            <div>
              <p className="lynx-eyebrow">Latest quiz</p>
              <p className="lynx-hub-big">{latest ? `${latest.percent}%` : '—'}</p>
              <p className="lynx-muted lynx-caption">
                {latest ? `${latest.score}/${latest.total} on ${formatDate(latest.attemptedAt)} · ${attempts} attempt${attempts === 1 ? '' : 's'}` : 'You have not taken a quiz on this topic yet'}
              </p>
            </div>
            {quizReady && <Link to={quizLink} className="lynx-btn lynx-btn-primary lynx-btn-sm">{latest ? 'Retake Quiz' : 'Take Quiz'}</Link>}
          </div>
          <div className="lynx-hub-actions">
            <button type="button" disabled={busy} onClick={() => onGenerate('quiz')} className="lynx-btn lynx-btn-ghost lynx-btn-sm">
              {busy ? 'Generating…' : quizReady ? 'New quiz from sources' : 'Generate quiz'}
            </button>
          </div>
        </Card>

        <Card className="lynx-hub-card">
          <p className="lynx-eyebrow">Recent attempts</p>
          {history.length ? history.map((attempt) => (
            <ProgressBar key={attempt.attemptedAt} value={attempt.percent} label={formatDate(attempt.attemptedAt)} />
          )) : <p className="lynx-muted lynx-sub">Your scores will appear here after your first quiz.</p>}
        </Card>
      </div>
      <Card className="lynx-hub-card">
        <SourcePicker sources={sources} excluded={excluded} onToggle={onToggle} />
      </Card>
    </div>
  );
}
