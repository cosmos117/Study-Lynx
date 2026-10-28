import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import Card from '../components/Card.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import EmptyState from '../components/EmptyState.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import PageHeader from '../components/PageHeader.jsx';
import useTopicOptions from '../hooks/useTopicOptions.js';
import { documentAPI, tutorAPI } from '../services/api.js';

const DEFAULT_TOP_K = 5;
const DEFAULT_THRESHOLD = 0.35;
const ACTIONS = [
  ['simpler', 'Explain simpler'],
  ['example', 'Give example'],
  ['quiz', 'Test me'],
  ['flashcards', 'Create flashcards'],
];

const sourceLabel = (source) => [
  source.page ? `page ${source.page}` : null,
  `passage ${source.chunkIndex}`,
].filter(Boolean).join(', ');

function Answer({ result, onAction, busy }) {
  return (
    <>
      {!result.sourceBacked && (
        <Alert tone="info">
          {result.retrievedChunks === 0
            ? 'Nothing in the selected sources matched this question.'
            : 'Your selected sources did not fully support an answer.'}
        </Alert>
      )}
      <p className="lynx-eyebrow">{result.sourceBacked ? 'From your materials' : 'Answer'}</p>
      <div className="lynx-tutor-answer">{result.answer}</div>

      {result.generalExplanation && (
        <>
          <p className="lynx-eyebrow lynx-section-gap">General explanation (not from your materials)</p>
          <div className="lynx-tutor-answer lynx-tutor-general">{result.generalExplanation}</div>
        </>
      )}

      <h2 className="lynx-h2 lynx-section-gap">Sources used</h2>
      {result.sources.length ? (
        <ul className="lynx-list">
          {result.sources.map((source) => (
            <li key={`${source.documentId}-${source.chunkIndex}`}>
              <strong>{source.name}</strong> — {sourceLabel(source)}
              <details className="lynx-source-excerpt">
                <summary className="lynx-caption">Show passage</summary>
                <p className="lynx-muted lynx-caption">{source.excerpt}{source.excerpt.length >= 240 ? '…' : ''}</p>
              </details>
            </li>
          ))}
        </ul>
      ) : (
        <p className="lynx-muted lynx-sub">No source passages were cited for this answer.</p>
      )}

      {result.retrievedChunks > 0 && (
        <div className="lynx-tutor-actions">
          {ACTIONS.map(([mode, label]) => (
            <button key={mode} type="button" disabled={busy} onClick={() => onAction(mode)} className="lynx-btn lynx-btn-ghost lynx-btn-sm">{label}</button>
          ))}
        </div>
      )}
    </>
  );
}

export default function AiTutor() {
  usePageTitle('AI Tutor');
  const { topics } = useTopicOptions();
  const [params] = useSearchParams();
  const [documents, setDocuments] = useState(null);
  const [topicId, setTopicId] = useState(params.get('topicId') || '');
  const [unchecked, setUnchecked] = useState(() => new Set());
  const [question, setQuestion] = useState(params.get('q') || '');
  const [topK, setTopK] = useState(DEFAULT_TOP_K);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [result, setResult] = useState(null);
  const [asked, setAsked] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    documentAPI.list()
      .then(({ data }) => setDocuments(data.data.documents))
      .catch((requestError) => {
        setError(requestError.response?.data?.message || 'Unable to load your materials');
        setDocuments([]);
      });
  }, []);

  const ready = useMemo(() => (documents || []).filter((document) => document.status === 'READY'), [documents]);
  const visible = useMemo(
    () => (topicId ? ready.filter((document) => String(document.topicId) === topicId) : ready),
    [ready, topicId],
  );
  const selected = visible.filter((document) => !unchecked.has(document.id));
  const pending = (documents || []).filter((document) => document.status === 'PROCESSING' || document.status === 'UPLOADING').length;

  const toggle = (id) => {
    const next = new Set(unchecked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setUnchecked(next);
  };

  const ask = async (text, mode = 'ask') => {
    setBusy(true);
    setError('');
    try {
      const { data } = await tutorAPI.ask({
        question: text,
        mode,
        documentIds: selected.map((document) => document.id),
        topK: Number(topK),
        threshold: Number(threshold),
      });
      setResult(data.data);
      setAsked(text);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'AI Tutor could not answer right now');
    } finally {
      setBusy(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    ask(question.trim());
  };

  if (!documents) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        eyebrow="AI Tutor"
        title="Ask questions grounded in your materials."
        description="Study Lynx finds the most relevant passages in your sources first, then answers from them and shows exactly what it used."
      />
      <div className="lynx-tutor-grid">
        <Card>
          <form onSubmit={submit} className="lynx-form">
            <label className="lynx-label">Topic
              <select value={topicId} onChange={(event) => setTopicId(event.target.value)} className="lynx-input">
                <option value="">All topics</option>
                {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.label}</option>)}
              </select>
            </label>

            <div className="lynx-tutor-sources">
              <div className="lynx-row-between">
                <strong>Sources</strong>
                <span className="lynx-muted lynx-caption">{selected.length} of {visible.length} selected</span>
              </div>
              {visible.map((document) => (
                <label key={document.id} className="lynx-source-row">
                  <input type="checkbox" checked={!unchecked.has(document.id)} onChange={() => toggle(document.id)} />
                  {document.name}
                </label>
              ))}
              {!visible.length && (
                <EmptyState
                  title={ready.length ? 'No sources on this topic' : 'No sources yet'}
                  description={ready.length ? 'Attach materials to this topic, or choose All topics.' : 'Upload a PDF or save notes before asking grounded questions.'}
                  action={<Link to="/materials" className="lynx-btn lynx-btn-ghost lynx-btn-sm">Go to materials</Link>}
                />
              )}
              {pending > 0 && <p className="lynx-muted lynx-caption">{pending} still processing — they&apos;ll appear once ready.</p>}
            </div>

            <label className="lynx-label">Question
              <textarea
                required
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                maxLength={2000}
                rows="4"
                placeholder="Why is BCNF stricter than 3NF?"
                className="lynx-input"
              />
            </label>

            <details className="lynx-retrieval-settings">
              <summary className="lynx-caption">Retrieval settings</summary>
              <div className="lynx-form-two lynx-section-gap">
                <label className="lynx-label">Passages (top K)
                  <input type="number" min="1" max="20" value={topK} onChange={(event) => setTopK(event.target.value)} className="lynx-input" />
                </label>
                <label className="lynx-label">Min. similarity
                  <input type="number" min="0" max="1" step="0.05" value={threshold} onChange={(event) => setThreshold(event.target.value)} className="lynx-input" />
                </label>
              </div>
            </details>

            <Alert>{error}</Alert>
            <button disabled={busy || !selected.length || !question.trim()} className="lynx-btn lynx-btn-primary lynx-btn-block">
              {busy ? 'Thinking...' : 'Ask AI Tutor'}
            </button>
          </form>
        </Card>

        <Card>
          <div aria-live="polite" aria-busy={busy}>
            {busy && <p className="lynx-muted lynx-caption">Searching your sources and writing an answer…</p>}
            {result ? (
              <>
                <p className="lynx-muted lynx-caption">You asked: {asked}</p>
                <Answer result={result} busy={busy} onAction={(mode) => ask(asked, mode)} />
              </>
            ) : (
              <EmptyState icon="✦" title="Your grounded answer will appear here" description="Ask a question to search your selected sources and see which passages the answer came from." />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
