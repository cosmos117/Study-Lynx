import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Card from '../components/Card.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { aiAPI, flashcardAPI, mindmapAPI, notesAPI, quizAPI } from '../services/api.js';
import useGenerate from '../hooks/useGenerate.js';
import LearningResourceSection from '../components/LearningResourceSection.jsx';
import { errorMessage } from '../utils/aiErrors.js';
import Alert from '../components/Alert.jsx';
import { useFeedback } from '../components/Feedback.jsx';
import usePageTitle from '../hooks/usePageTitle.js';

const tabs = ['Notes', 'Flashcards', 'Quiz', 'Mind map'];

export default function TopicStudy() {
  const { topicId } = useParams();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || 'Notes');
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [noteText, setNoteText] = useState('');
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [usage, setUsage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [quizAttempt, setQuizAttempt] = useState(0);
  const { running: generating, run: runGeneration } = useGenerate();
  const { toast, confirm } = useFeedback();
  usePageTitle('Study workspace');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = tab === 'Notes'
        ? await notesAPI.get(topicId)
        : tab === 'Flashcards'
          ? await flashcardAPI.list(topicId)
          : tab === 'Quiz'
            ? await quizAPI.get(topicId)
            : await mindmapAPI.get(topicId);
      const data = response.data.data;
      setContent(data.note || data.aiContent || data.flashcards || data.quiz || data.mindmap || null);
      if (data.note) setNoteText(data.note.content);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tab, topicId]);
  useEffect(() => {
    aiAPI.usage().then((response) => setUsage(response.data.data)).catch(() => {});
  }, []);

  const generate = async () => {
    setError('');
    try {
      const response = await runGeneration(() => (
        tab === 'Notes'
          ? notesAPI.generate(topicId)
          : tab === 'Flashcards'
            ? flashcardAPI.generate(topicId)
            : tab === 'Quiz'
              ? quizAPI.generate(topicId)
              : mindmapAPI.generate(topicId)
      ));
      const data = response.data.data;
      setContent(data.note || data.content || data.flashcards || data.quiz || data.mindmap || null);
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  const submitQuiz = async () => {
    const total = (content?.questions || content?.content?.questions || []).length;
    const blank = total - Object.keys(quizAnswers).length;
    if (blank > 0 && !await confirm({ title: 'Submit with unanswered questions?', message: `${blank} question${blank === 1 ? ' is' : 's are'} blank and will count as incorrect.`, confirmLabel: 'Submit anyway' })) return;
    setSubmitting(true);
    try {
      const response = await quizAPI.submit(topicId, {
        answers: Object.entries(quizAnswers).map(([questionIndex, selectedIndex]) => ({
          questionIndex: Number(questionIndex), selectedIndex: Number(selectedIndex),
        })),
      });
      setQuizResult(response.data.data);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const retryQuiz = () => { setQuizAnswers({}); setQuizResult(null); setQuizAttempt((value) => value + 1); };

  const saveNote = async () => {
    try {
      await notesAPI.save(topicId, { content: noteText });
      toast('Note saved');
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  const regenerateNotes = async () => {
    if (!await confirm({ title: 'Regenerate these notes?', message: 'The AI notes will be replaced with a new version. The note you saved yourself is kept.', confirmLabel: 'Regenerate' })) return;
    try {
      await runGeneration(() => notesAPI.generate(topicId, { regenerate: true }));
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <Link to={`/topics/${topicId}`} className="lynx-link">← Topic hub</Link>
      <div className="lynx-section-head lynx-study-header">
        <p className="lynx-eyebrow">Topic study</p>
        <h1 className="lynx-h1">Study workspace</h1>
        <p className="lynx-muted lynx-sub">Generate, review, and save learning material for this topic.</p>
        <div className="lynx-page-header-actions lynx-section-gap">
          <Link to={`/recall/review?topicId=${topicId}`} className="lynx-btn lynx-btn-ghost lynx-btn-sm">Start active recall</Link>
        </div>
      </div>
      <div className="lynx-tabs" role="tablist">
        {tabs.map((item) => <button type="button" key={item} onClick={() => setTab(item)} className={`lynx-tab ${tab === item ? 'lynx-tab-active' : ''}`} role="tab" aria-selected={tab === item}>{item}</button>)}
      </div>
      <Alert className="lynx-section-gap" onRetry={load}>{error}</Alert>
      <Card className="lynx-section-gap lynx-study-card">
        {!content ? (
          <div className="lynx-empty-state">
            <p className="lynx-h2">No {tab.toLowerCase()} yet</p>
            <p className="lynx-muted lynx-sub">Generate it when you are ready. AI content should be verified.</p>
            <button type="button" disabled={generating} onClick={generate} className="lynx-btn lynx-btn-primary lynx-section-gap">{generating ? 'Generating...' : `Generate ${tab.toLowerCase()}`}</button>
          </div>
        ) : tab === 'Notes' ? (
          <NotesContent content={content} noteText={noteText} setNoteText={setNoteText} save={saveNote} regenerate={regenerateNotes} />
        ) : tab === 'Flashcards' ? (
          <FlashcardsContent cards={content} />
        ) : tab === 'Quiz' ? (
          <QuizContent key={quizAttempt} quiz={content} answers={quizAnswers} setAnswers={setQuizAnswers} submit={submitQuiz} submitting={submitting} result={quizResult} onRetry={retryQuiz} />
        ) : (
          <MindmapContent content={content} />
        )}
        {usage && <p className="lynx-muted lynx-caption lynx-section-gap">AI generations today: {usage.userUsedToday}/{usage.userLimit}</p>}
      </Card>
      <LearningResourceSection topicId={topicId} />
    </div>
  );
}

function NotesContent({ content, noteText, setNoteText, save, regenerate }) {
  const structured = content.content && typeof content.content !== 'string' ? content.content : null;
  if (!structured) return <div><p className="lynx-eyebrow">Saved note</p><textarea aria-label="Your note" value={noteText || content.content || ''} onChange={(event) => setNoteText(event.target.value)} className="lynx-input lynx-section-gap" rows="14" /><button type="button" onClick={save} className="lynx-btn lynx-btn-primary lynx-section-gap">Save changes</button></div>;
  return <div>
    <p className="lynx-eyebrow">AI-generated. Verify important facts.</p>
    <h2 className="lynx-h2 lynx-section-gap">{structured.title}</h2>
    <p className="lynx-muted lynx-sub">{structured.overview}</p>
    <h3 className="lynx-h2 lynx-section-gap">Key concepts</h3>
    <ul className="lynx-list">{structured.keyConcepts?.map((item) => <li key={item.term}><strong>{item.term}:</strong> {item.explanation}</li>)}</ul>
    <textarea aria-label="Your note" value={noteText} onChange={(event) => setNoteText(event.target.value)} className="lynx-input lynx-section-gap" rows="8" placeholder="Save or edit your note..." />
    <button type="button" onClick={save} className="lynx-btn lynx-btn-primary lynx-section-gap">Save my note</button>
    <button type="button" onClick={regenerate} disabled={!regenerate} className="lynx-btn lynx-btn-ghost lynx-section-gap lynx-button-spaced">Regenerate</button>
  </div>;
}

const RATINGS = ['AGAIN', 'HARD', 'GOOD', 'EASY'];
const RATING_LABELS = { AGAIN: 'Again', HARD: 'Hard', GOOD: 'Good', EASY: 'Easy' };

function FlashcardsContent({ cards }) {
  const items = cards.flashcards || cards;
  const { toast } = useFeedback();
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const saving = useRef(false);
  const card = items[current];

  const go = useCallback((index) => { setCurrent(index); setFlipped(false); }, []);

  // Rating a card schedules its next review, so it is only allowed once the answer has been seen.
  const rate = useCallback(async (rating) => {
    if (!card?.id || !flipped || saving.current) return;
    saving.current = true;
    try {
      await flashcardAPI.review(card.id, { rating });
      toast(`Marked ${RATING_LABELS[rating]}. Its next review is scheduled.`);
      if (current < items.length - 1) go(current + 1);
    } catch (requestError) {
      toast(requestError.response?.data?.message || 'Unable to save that rating', 'error');
    } finally {
      saving.current = false;
    }
  }, [card, flipped, current, items.length, go, toast]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      if (event.code === 'Space' && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); setFlipped((value) => !value); }
      if (['1', '2', '3', '4'].includes(event.key)) rate(RATINGS[Number(event.key) - 1]);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [rate]);

  if (!card) return <p className="lynx-muted">No flashcards yet.</p>;
  return (
    <div>
      <p className="lynx-eyebrow">AI-generated. Verify important facts.</p>
      <button type="button" className={`lynx-flip-card ${flipped ? 'lynx-flip-card-flipped' : ''}`} onClick={() => setFlipped((value) => !value)} aria-live="polite">
        <span className="sr-only">{flipped ? 'Answer: ' : 'Question: '}</span>
        <span className="lynx-flip-card-face">{flipped ? card.answer : card.question}</span>
        <span className="sr-only"> Press to {flipped ? 'show the question' : 'reveal the answer'}.</span>
      </button>
      {flipped && (
        <div className="lynx-rating-grid lynx-section-gap" role="group" aria-label="How well did you remember it?">
          {RATINGS.map((rating, index) => (
            <button type="button" key={rating} onClick={() => rate(rating)} className={`lynx-btn lynx-rating-${rating.toLowerCase()}`}><span aria-hidden="true">{index + 1}</span>{RATING_LABELS[rating]}</button>
          ))}
        </div>
      )}
      <div className="lynx-row-between lynx-section-gap">
        <span className="lynx-muted">{current + 1} / {items.length}</span>
        <div className="lynx-hub-actions">
          <button type="button" disabled={current === 0} onClick={() => go(current - 1)} className="lynx-btn lynx-btn-ghost lynx-btn-sm">Previous</button>
          <button type="button" disabled={current === items.length - 1} onClick={() => go(current + 1)} className="lynx-btn lynx-btn-primary lynx-btn-sm">Next</button>
        </div>
      </div>
      <p className="lynx-muted lynx-caption lynx-section-gap">Space: flip · after flipping, 1 Again · 2 Hard · 3 Good · 4 Easy</p>
    </div>
  );
}

function QuizContent({ quiz, answers, setAnswers, submit, submitting, result, onRetry }) {
  const { topicId } = useParams();
  const questions = quiz.questions || quiz.content?.questions || [];
  return (
    <div>
      <p className="lynx-eyebrow">AI-generated. Verify important facts.</p>
      {questions.map((question, index) => {
        const graded = result?.answers?.[index];
        return (
          <fieldset key={question.question} className="lynx-quiz-question" disabled={Boolean(result)}>
            <legend>{index + 1}. {question.question}</legend>
            {question.options.map((option, optionIndex) => (
              <label key={option} className="lynx-option">
                <input type="radio" name={`question-${index}`} onChange={() => setAnswers({ ...answers, [index]: optionIndex })} /> {option}
              </label>
            ))}
            {graded && (
              <p className={graded.correct ? 'lynx-quiz-correct' : 'lynx-quiz-wrong'} role="status">
                <strong>{graded.correct ? 'Correct.' : `Not quite. The answer is "${question.options[question.correctIndex]}".`}</strong>{' '}
                {graded.explanation}
              </p>
            )}
          </fieldset>
        );
      })}
      {!result ? (
        <button type="button" onClick={submit} disabled={submitting} className="lynx-btn lynx-btn-primary lynx-section-gap">{submitting ? 'Submitting...' : 'Submit quiz'}</button>
      ) : (
        <div className="lynx-section-gap">
          <p className="lynx-h2" role="status">Score: {result.score}/{result.totalQuestions}</p>
          <div className="lynx-hub-actions">
            <button type="button" onClick={onRetry} className="lynx-btn lynx-btn-ghost">Try again</button>
            <Link to={`/topics/${topicId}?tab=Progress`} className="lynx-btn lynx-btn-primary">See what to revise next</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function MindmapContent({ content }) {
  const root = content.content || content;
  const [collapsed, setCollapsed] = useState(new Set());
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(null);
  const nodes = [];
  const layout = (node, depth = 0, parentLabel = null) => {
    const children = collapsed.has(node.label) ? [] : (node.children || []);
    const childPositions = children.map((child) => layout(child, depth + 1, node.label));
    const y = childPositions.length ? childPositions.reduce((total, value) => total + value, 0) / childPositions.length : 80 + nodes.filter((item) => item.depth === depth).length * 72;
    const item = { node, depth, parentLabel, x: 100 + depth * 230, y };
    nodes.push(item);
    return y;
  };
  if (root?.label) layout(root);
  const edges = nodes.flatMap((item) => {
    const parent = nodes.find((candidate) => candidate.node.label === item.parentLabel);
    return parent ? [{ from: parent, to: item }] : [];
  });
  const exportMap = () => {
    const escapeXml = (value) => String(value).replace(/[<>&'"]/g, (character) => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;',
    }[character]));
    const lines = [];
    const walk = (node, depth = 0) => {
      lines.push({ label: node.label, depth });
      node.children?.forEach((child) => walk(child, depth + 1));
    };
    walk(root);
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="',
      `${Math.max(160, lines.length * 42 + 40)}">`,
      '<style>text{font:16px sans-serif;fill:#0f172a} .line{stroke:#94a3b8;stroke-width:1}</style>',
      ...lines.map((line, index) => {
        const x = 30 + line.depth * 36;
        const y = 30 + index * 42;
        return `<line class="line" x1="${x - 18}" y1="${y - 6}" x2="${x}" y2="${y - 6}"/><text x="${x + 8}" y="${y}">${escapeXml(line.label)}</text>`;
      }),
      '</svg>',
    ].join('');
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'study-lynx-mindmap.svg';
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const toggle = (label) => setCollapsed((value) => { const next = new Set(value); if (next.has(label)) next.delete(label); else next.add(label); return next; });
  const onPointerDown = (event) => setDragging({ x: event.clientX - offset.x, y: event.clientY - offset.y });
  const onPointerMove = (event) => { if (dragging) setOffset({ x: event.clientX - dragging.x, y: event.clientY - dragging.y }); };
  return <div><p className="lynx-eyebrow">AI-generated. Verify important facts.</p><div className="lynx-mindmap-canvas" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => setDragging(null)} onPointerLeave={() => setDragging(null)}><svg className="lynx-mindmap-svg" viewBox="0 0 900 520" role="img" aria-label="Interactive mind map"><g transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}>{edges.map(({ from, to }) => <line key={`${from.node.label}-${to.node.label}`} className="lynx-mindmap-edge" x1={from.x + 70} y1={from.y} x2={to.x - 70} y2={to.y} />)}{nodes.map(({ node, depth, x, y }) => <g key={node.label} className={`lynx-mindmap-node ${depth === 0 ? 'root' : ''}`} transform={`translate(${x} ${y})`} onClick={(event) => { event.stopPropagation(); if (node.children?.length) toggle(node.label); }}><circle r={depth === 0 ? 60 : 52} /><text textAnchor="middle" y="4">{node.label.length > 18 ? `${node.label.slice(0, 18)}…` : node.label}</text></g>)}</g></svg></div><div className="lynx-mindmap-controls"><button type="button" onClick={() => setZoom((value) => Math.min(1.8, value + .1))} className="lynx-btn lynx-btn-ghost lynx-btn-sm">Zoom in</button><button type="button" onClick={() => setZoom((value) => Math.max(.6, value - .1))} className="lynx-btn lynx-btn-ghost lynx-btn-sm">Zoom out</button><button type="button" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }} className="lynx-btn lynx-btn-ghost lynx-btn-sm">Reset view</button><button type="button" onClick={exportMap} className="lynx-btn lynx-btn-ghost lynx-btn-sm">Export</button></div><p className="lynx-muted lynx-caption">Click a node to expand or collapse its branch. Drag to pan.</p></div>;
}
