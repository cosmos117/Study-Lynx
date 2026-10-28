import { Link } from 'react-router-dom';
import Card from '../Card.jsx';
import MasteryMeter from '../MasteryMeter.jsx';
import StatCard from '../StatCard.jsx';
import { DifficultyBadge } from '../LynxBadges.jsx';
import { formatMinutes, orDash } from '../../utils/format.js';

export default function ProgressPanel({ hub, onStudyNow }) {
  const { mastery, studyMinutes, sessionsCompleted, weakAreas } = hub.progress;
  const topicId = hub.topic.id;
  return (
    <div className="lynx-stack-tight">
      <Card className="lynx-hub-card">
        <div className="lynx-row-between">
          <div>
            <p className="lynx-eyebrow">Mastery</p>
            <p className="lynx-hub-big">{orDash(mastery.score)}</p>
          </div>
          {mastery.level && <DifficultyBadge level={mastery.level} />}
        </div>
        {mastery.score !== null
          ? <MasteryMeter mastery={mastery} label="Overall mastery" />
          : <p className="lynx-muted lynx-sub">Not enough data yet. Review some flashcards, take a quiz, or finish a study session to see your mastery.</p>}
        <p className="lynx-muted lynx-caption">Mastery blends quiz results (50%), recall performance (35%) and study time (15%), using only the signals you have so far.</p>
      </Card>

      <div className="lynx-grid-3">
        <StatCard label="Study time" value={formatMinutes(studyMinutes)} detail={`${sessionsCompleted} session${sessionsCompleted === 1 ? '' : 's'} completed`} icon="◷" />
        <StatCard label="Recall performance" value={orDash(hub.recall.recallRate)} detail={hub.recall.reviews ? `Last ${hub.recall.reviews} reviews` : 'No reviews yet'} tone="success" icon="↻" />
        <StatCard label="Quiz performance" value={orDash(hub.practice.averagePercent)} detail={hub.practice.attempts ? `Recent average · ${hub.practice.attempts} attempt${hub.practice.attempts === 1 ? '' : 's'}` : 'No quizzes yet'} tone="amber" icon="?" />
      </div>

      <Card className="lynx-hub-card">
        <p className="lynx-eyebrow">Weak areas</p>
        {weakAreas.length ? weakAreas.map((area) => (
          <div key={`${area.kind}-${area.text}`} className="lynx-hub-item">
            <p>{area.text}</p>
            <div className="lynx-hub-actions">
              <span className="lynx-muted lynx-caption">{area.kind === 'quiz' ? 'Missed in your last quiz' : 'Recently rated hard'}</span>
              <Link to={`/ai-tutor?topicId=${topicId}&q=${encodeURIComponent(`Explain: ${area.text}`)}`} className="lynx-btn lynx-btn-ghost lynx-btn-sm">Ask AI</Link>
            </div>
          </div>
        )) : <p className="lynx-muted lynx-sub">No weak spots found yet. They show up from missed quiz questions and cards you rate Again or Hard.</p>}
        <div className="lynx-hub-actions">
          {hub.recall.cardsTotal > 0 && <Link to={`/recall/review?topicId=${topicId}`} className="lynx-btn lynx-btn-primary lynx-btn-sm">Review weak topic</Link>}
          <button type="button" onClick={onStudyNow} className="lynx-btn lynx-btn-ghost lynx-btn-sm">Study now</button>
        </div>
      </Card>
    </div>
  );
}
