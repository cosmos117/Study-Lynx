import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import Card from '../components/Card.jsx';
import { useFeedback } from '../components/Feedback.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import LearnPanel from '../components/hub/LearnPanel.jsx';
import LoopTracker from '../components/hub/LoopTracker.jsx';
import PracticePanel from '../components/hub/PracticePanel.jsx';
import ProgressPanel from '../components/hub/ProgressPanel.jsx';
import RecallPanel from '../components/hub/RecallPanel.jsx';
import useGenerate from '../hooks/useGenerate.js';
import { flashcardAPI, hubAPI, mindmapAPI, notesAPI, quizAPI, resourceAPI } from '../services/api.js';
import { errorMessage } from '../utils/aiErrors.js';
import { indexVideoTranscript } from '../utils/materials.js';

const TABS = ['Learn', 'Recall', 'Practice', 'Progress'];

// Generation goes through the same endpoints the study workspace uses.
const GENERATORS = {
  notes: { api: notesAPI, label: 'Notes', tab: 'Notes', exists: (hub) => hub.learn.hasNotes },
  flashcards: { api: flashcardAPI, label: 'Flashcards', tab: 'Flashcards', exists: () => false },
  quiz: { api: quizAPI, label: 'Quiz', tab: 'Quiz', exists: (hub) => hub.practice.quizReady },
  mindmap: { api: mindmapAPI, label: 'Mind map', tab: 'Mind map', exists: (hub) => hub.recall.hasMindmap },
};

const NEXT_STEP_LABEL = {
  REVIEW_RECALL: 'Start Recall',
  ADD_MATERIAL: 'Add material',
  GENERATE_FLASHCARDS: 'Create flashcards',
  GENERATE_QUIZ: 'Create quiz',
  TAKE_QUIZ: 'Take Quiz',
  ASK_TUTOR: 'Ask AI Tutor',
  STUDY_NOW: 'Study now',
};

export default function TopicHub() {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [hub, setHub] = useState(null);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [notice, setNotice] = useState(null);
  const [excluded, setExcluded] = useState(() => new Set());
  const [working, setWorking] = useState(false);
  const { running: generating, run } = useGenerate();
  const { confirm } = useFeedback();
  usePageTitle(hub?.topic.name || 'Topic');

  const requestedTab = searchParams.get('tab');
  const tab = TABS.includes(requestedTab) ? requestedTab : 'Learn';
  const busy = generating || working;

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

  // Everything on the topic that AI generation can be based on.
  const sources = useMemo(() => (hub ? [
    ...hub.learn.documents.filter((document) => document.status === 'READY').map((document) => ({ key: `d${document.id}`, kind: 'Material', label: document.name, documentId: document.id })),
    ...hub.learn.videos.filter((video) => video.hasTranscript).map((video) => ({ key: `v${video.id}`, kind: 'Video transcript', label: video.title, resourceId: video.id })),
  ] : []), [hub]);

  const toggleSource = (key) => {
    const next = new Set(excluded);
    if (next.has(key)) next.delete(key); else next.add(key);
    setExcluded(next);
  };

  /** Generate notes / flashcards / a quiz / a mind map, based on `only` or else the selected sources. */
  const generate = async (kind, only) => {
    const { api, label, tab: studyTab, exists } = GENERATORS[kind];
    const chosen = sources.filter((source) => !excluded.has(source.key));
    const body = only
      ? { documentIds: only.documentIds || [], resourceIds: only.resourceIds || [] }
      : { documentIds: chosen.filter((s) => s.documentId).map((s) => s.documentId), resourceIds: chosen.filter((s) => s.resourceId).map((s) => s.resourceId) };
    const count = body.documentIds.length + body.resourceIds.length;
    if (count && exists(hub) && !await confirm({ title: `Replace your ${label.toLowerCase()}?`, message: `A new ${label.toLowerCase()} will be created from ${count} source${count === 1 ? '' : 's'} and will replace the current one.`, confirmLabel: 'Replace' })) return;

    setError('');
    setNotice(null);
    try {
      await run(() => api.generate(topicId, body));
      await load();
      const target = kind === 'flashcards' ? { to: '?tab=Recall', label: 'Go to Recall' } : { to: `/topics/${topicId}/study?tab=${encodeURIComponent(studyTab)}`, label: `Open ${label.toLowerCase()}` };
      setNotice({ text: `${label} ready${count ? `, based on ${count} source${count === 1 ? '' : 's'}` : ''}.`, ...target });
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  const indexVideo = async (video) => {
    setWorking(true);
    setError('');
    try {
      const { data } = await resourceAPI.get(video.id);
      await indexVideoTranscript(data.data.resource, Number(topicId));
      setNotice({ text: `"${video.title}" is being indexed and will be searchable in AI Tutor shortly.` });
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Unable to index this transcript'));
    } finally {
      setWorking(false);
    }
  };

  const studyNow = async () => {
    setWorking(true);
    setError('');
    try {
      const { data } = await hubAPI.studyNow(topicId);
      navigate(`/study-session/${data.data.session.id}`, { state: { returnTo: `/topics/${topicId}?tab=Recall` } });
    } catch (requestError) {
      setError(errorMessage(requestError, 'Unable to start a study session'));
      setWorking(false);
    }
  };

  const runNextStep = () => {
    const actions = {
      REVIEW_RECALL: () => navigate(`/recall/review?topicId=${topicId}`),
      ADD_MATERIAL: () => navigate('/materials'),
      GENERATE_FLASHCARDS: () => generate('flashcards'),
      GENERATE_QUIZ: () => generate('quiz'),
      TAKE_QUIZ: () => navigate(`/topics/${topicId}/study?tab=Quiz`),
      ASK_TUTOR: () => navigate(`/ai-tutor?topicId=${topicId}`),
      STUDY_NOW: studyNow,
    };
    actions[hub.nextStep.key]?.();
  };

  const selectTab = (next) => setSearchParams({ tab: next });

  if (error && !hub) {
    return <div className="lynx-stack-tight"><Alert onRetry={notFound ? undefined : load}>{error}</Alert><Link to="/subjects" className="lynx-btn lynx-btn-ghost">Back to subjects</Link></div>;
  }
  if (!hub) return <LoadingSpinner />;

  const panelProps = { hub, busy, onGenerate: generate };
  const pickerProps = { sources, excluded, onToggle: toggleSource };

  return (
    <div>
      <Link to={`/exams/${hub.topic.exam.id}`} className="lynx-link">← {hub.topic.exam.name}</Link>
      <div className="lynx-page-header">
        <div>
          <p className="lynx-eyebrow">{hub.topic.subject.name} · Topic Learning Hub</p>
          <h1 className="lynx-h1">{hub.topic.name}</h1>
        </div>
        <div className="lynx-page-header-actions">
          <Link to={`/topics/${topicId}/study`} className="lynx-btn lynx-btn-ghost">Study workspace</Link>
          <button type="button" disabled={busy} onClick={studyNow} className="lynx-btn lynx-btn-primary">Study now</button>
        </div>
      </div>

      <Card className="lynx-hub-next">
        <div>
          <p className="lynx-eyebrow">Next step</p>
          <h2 className="lynx-h2">{hub.nextStep.title}</h2>
          <p className="lynx-muted lynx-sub">{hub.nextStep.reason}</p>
          <LoopTracker stage={hub.nextStep.stage} />
        </div>
        <button type="button" disabled={busy} onClick={runNextStep} className="lynx-btn lynx-btn-primary">{busy ? 'Working…' : NEXT_STEP_LABEL[hub.nextStep.key]}</button>
      </Card>

      <div className="lynx-tabs lynx-section-gap" role="tablist">
        {TABS.map((item) => (
          <button type="button" key={item} onClick={() => selectTab(item)} className={`lynx-tab ${tab === item ? 'lynx-tab-active' : ''}`} role="tab" aria-selected={tab === item}>{item}</button>
        ))}
      </div>

      <Alert className="lynx-section-gap">{error}</Alert>
      {notice && (
        <p role="status" className="lynx-hub-notice lynx-section-gap">
          <span>{notice.text}</span>
          {notice.to && <Link to={notice.to} className="lynx-text-link">{notice.label} →</Link>}
        </p>
      )}
      {generating && <p className="lynx-muted lynx-caption lynx-section-gap">Generating with AI — this can take up to a minute.</p>}

      <div className="lynx-section-gap">
        {tab === 'Learn' && <LearnPanel {...panelProps} onIndex={indexVideo} onReload={load} />}
        {tab === 'Recall' && <RecallPanel {...panelProps} {...pickerProps} />}
        {tab === 'Practice' && <PracticePanel {...panelProps} {...pickerProps} />}
        {tab === 'Progress' && <ProgressPanel hub={hub} onStudyNow={studyNow} />}
      </div>
    </div>
  );
}
