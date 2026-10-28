import { Link } from 'react-router-dom';
import Card from '../Card.jsx';
import SourcePicker from './SourcePicker.jsx';

export default function RecallPanel({ hub, busy, onGenerate, sources, excluded, onToggle }) {
  const { cardsTotal, cardsDue, recallRate, reviews, hasMindmap } = hub.recall;
  const topicId = hub.topic.id;
  return (
    <div className="lynx-stack-tight">
      <div className="lynx-hub-grid">
        <Card className="lynx-hub-card">
          <div className="lynx-row-between">
            <div>
              <p className="lynx-eyebrow">Flashcards</p>
              <p className="lynx-hub-big">{cardsDue}</p>
              <p className="lynx-muted lynx-caption">due now · {cardsTotal} card{cardsTotal === 1 ? '' : 's'} in total</p>
            </div>
            {cardsDue > 0
              ? <Link to={`/recall/review?topicId=${topicId}`} className="lynx-btn lynx-btn-primary lynx-btn-sm">Start Recall</Link>
              : <span className="lynx-muted lynx-caption">{cardsTotal ? 'All caught up' : 'No cards yet'}</span>}
          </div>
          {recallRate !== null && <p className="lynx-muted lynx-sub">You remembered {recallRate}% of your last {reviews} review{reviews === 1 ? '' : 's'}.</p>}
          <div className="lynx-hub-actions">
            <button type="button" disabled={busy} onClick={() => onGenerate('flashcards')} className="lynx-btn lynx-btn-ghost lynx-btn-sm">
              {busy ? 'Generating…' : cardsTotal ? 'Add flashcards from sources' : 'Generate flashcards'}
            </button>
            {cardsTotal > 0 && <Link to={`/topics/${topicId}/study?tab=Flashcards`} className="lynx-btn lynx-btn-ghost lynx-btn-sm">Manage cards</Link>}
          </div>
        </Card>

        <Card className="lynx-hub-card">
          <div className="lynx-row-between">
            <div>
              <p className="lynx-eyebrow">Mind map</p>
              <h2 className="lynx-h2">{hasMindmap ? 'Ready to explore' : 'Not created yet'}</h2>
            </div>
            {hasMindmap && <Link to={`/topics/${topicId}/study?tab=Mind map`} className="lynx-btn lynx-btn-primary lynx-btn-sm">Open</Link>}
          </div>
          <div className="lynx-hub-actions">
            <button type="button" disabled={busy} onClick={() => onGenerate('mindmap')} className="lynx-btn lynx-btn-ghost lynx-btn-sm">
              {hasMindmap ? 'Rebuild from sources' : 'Generate mind map'}
            </button>
          </div>
        </Card>
      </div>
      <Card className="lynx-hub-card">
        <SourcePicker sources={sources} excluded={excluded} onToggle={onToggle} />
      </Card>
    </div>
  );
}
