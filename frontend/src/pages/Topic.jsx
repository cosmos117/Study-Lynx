import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import AskTab from '../components/topic/AskTab.jsx';
import FlashcardsTab from '../components/topic/FlashcardsTab.jsx';
import MindmapTab from '../components/topic/MindmapTab.jsx';
import QuizTab from '../components/topic/QuizTab.jsx';
import SourcesTab from '../components/topic/SourcesTab.jsx';
import WatchTab from '../components/topic/WatchTab.jsx';
import { usePomodoro } from '../context/PomodoroContext.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import { hubAPI } from '../services/api.js';
import { errorMessage } from '../utils/aiErrors.js';

// One tab per study feature, in the order a student would normally use them.
export const TOPIC_TABS = [
  { key: 'sources', label: 'Sources', Panel: SourcesTab },
  { key: 'ask', label: 'Ask AI', Panel: AskTab },
  { key: 'flashcards', label: 'Flashcards', Panel: FlashcardsTab },
  { key: 'quiz', label: 'Quiz', Panel: QuizTab },
  { key: 'watch', label: 'Watch', Panel: WatchTab },
  { key: 'mindmap', label: 'Mind map', Panel: MindmapTab },
];

export default function Topic() {
  const { topicId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const pomodoro = usePomodoro();
  const [hub, setHub] = useState(null);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  usePageTitle(hub?.topic.name || 'Topic');

  const tab = TOPIC_TABS.find((item) => item.key === searchParams.get('tab')) || TOPIC_TABS[0];
  const selectTab = (key) => setSearchParams({ tab: key });

  const load = useCallback(async () => {
    try {
      setHub((await hubAPI.get(topicId)).data.data);
      setError('');
    } catch (requestError) {
      setNotFound(requestError.response?.status === 404);
      setError(errorMessage(requestError, 'Unable to load this topic'));
    }
  }, [topicId]);

  useEffect(() => { setHub(null); load(); }, [load]);

  // AI generation is grounded in every ready source on the topic: documents and video transcripts.
  const sourceBody = useMemo(() => ({
    documentIds: (hub?.learn.documents || []).filter((document) => document.status === 'READY').map((document) => document.id),
    resourceIds: (hub?.learn.videos || []).filter((video) => video.hasTranscript).map((video) => video.id),
  }), [hub]);

  if (error && !hub) {
    return <div className="lynx-stack-tight"><Alert onRetry={notFound ? undefined : load}>{error}</Alert><Link to="/subjects" className="lynx-btn lynx-btn-ghost">Back to subjects</Link></div>;
  }
  if (!hub) return <LoadingSpinner />;

  const focusingHere = pomodoro.phase !== 'idle' && String(pomodoro.topicId) === String(topicId);
  const { Panel } = tab;

  return (
    <div>
      <Link to="/subjects" className="lynx-link">← {hub.topic.subject.name}</Link>
      <div className="lynx-page-header">
        <div>
          <p className="lynx-eyebrow">{hub.topic.subject.name}</p>
          <h1 className="lynx-h1">{hub.topic.name}</h1>
        </div>
        <div className="lynx-page-header-actions">
          <button
            type="button"
            disabled={focusingHere}
            onClick={() => pomodoro.start({ id: Number(topicId), name: hub.topic.name })}
            className="lynx-btn lynx-btn-primary"
          >
            {focusingHere ? 'Focusing…' : '▶ Start focus'}
          </button>
        </div>
      </div>

      <div className="lynx-tabs lynx-topic-tabs" role="tablist" aria-label="Study tools">
        {TOPIC_TABS.map((item) => (
          <button type="button" key={item.key} role="tab" aria-selected={tab.key === item.key} onClick={() => selectTab(item.key)} className={`lynx-tab ${tab.key === item.key ? 'lynx-tab-active' : ''}`}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="lynx-section-gap" role="tabpanel" aria-label={tab.label}>
        <Panel topicId={topicId} hub={hub} reload={load} sourceBody={sourceBody} onAddSources={() => selectTab('sources')} />
      </div>
    </div>
  );
}
