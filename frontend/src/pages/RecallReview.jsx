import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import StatCard from '../components/StatCard.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import { flashcardAPI, recallAPI } from '../services/api.js';
import { errorMessage } from '../utils/aiErrors.js';

const RATINGS = ['AGAIN', 'HARD', 'GOOD', 'EASY'];
const LABELS = { AGAIN: 'Again', HARD: 'Hard', GOOD: 'Good', EASY: 'Easy' };

function ReviewComplete({ results, topicId }) {
  const remembered = results.filter((item) => item.rating === 'GOOD' || item.rating === 'EASY').length;
  const difficult = results.filter((item) => item.rating === 'AGAIN' || item.rating === 'HARD');
  return (
    <div className="lynx-recall-review">
      <Link to="/recall" className="lynx-logo-link">← Active Recall</Link>
      <Card>
        <p className="lynx-eyebrow">Review complete</p>
        <h1 className="lynx-h1">Nice work.</h1>
        <div className="lynx-grid-3 lynx-section-gap">
          <StatCard label="Cards reviewed" value={results.length} />
          <StatCard label="Remembered" value={`${Math.round((remembered / results.length) * 100)}%`} tone="success" />
          <StatCard label="Difficult cards" value={difficult.length} tone="amber" />
        </div>
        <div className="lynx-section-gap">
          <h2 className="lynx-h2">Next review dates</h2>
          <ul className="lynx-list">
            {results.map((item) => (
              <li key={item.flashcard.id}>{item.flashcard.question.slice(0, 80)} · {item.review?.dueAt ? new Date(item.review.dueAt).toLocaleDateString() : 'Soon'}</li>
            ))}
          </ul>
        </div>
        <div className="lynx-hub-actions lynx-section-gap">
          {topicId && <Link to={`/topics/${topicId}?tab=quiz`} className="lynx-btn lynx-btn-primary">Test yourself with a quiz</Link>}
          {topicId && <Link to={`/topics/${topicId}`} className="lynx-btn lynx-btn-ghost">Back to topic</Link>}
          <Link to="/recall" className="lynx-btn lynx-btn-ghost">Back to Active Recall</Link>
        </div>
      </Card>
    </div>
  );
}

export default function RecallReview() {
  usePageTitle('Review cards');
  const [params] = useSearchParams();
  const topicId = params.get('topicId');
  const [cards, setCards] = useState(null);
  const [current, setCurrent] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const saving = useRef(false);

  const load = useCallback(() => {
    setError('');
    recallAPI.summary()
      .then(({ data }) => {
        const due = [...data.data.overdue, ...data.data.dueToday];
        setCards(topicId ? due.filter((card) => String(card.flashcard.topic.id) === topicId) : due);
      })
      .catch((requestError) => setError(errorMessage(requestError, 'Unable to load review cards')));
  }, [topicId]);
  useEffect(load, [load]);

  const card = cards?.[current];

  const rate = useCallback(async (rating) => {
    if (!card || !revealed || saving.current) return;
    saving.current = true;
    try {
      const response = await flashcardAPI.review(card.flashcard.id, { rating });
      setResults((items) => [...items, { ...card, rating, review: response.data.data.review }]);
      setRevealed(false);
      setCurrent((value) => value + 1);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Unable to save that rating'));
    } finally {
      saving.current = false;
    }
  }, [card, revealed]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      if (event.code === 'Space') { event.preventDefault(); setRevealed((value) => !value); }
      if (['1', '2', '3', '4'].includes(event.key)) rate(RATINGS[Number(event.key) - 1]);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [rate]);

  if (error && !cards) return <div className="lynx-recall-review"><Alert onRetry={load}>{error}</Alert></div>;
  if (!cards) return <LoadingSpinner />;
  if (!cards.length) {
    return (
      <div className="lynx-recall-review">
        <Link to="/recall" className="lynx-logo-link">← Active Recall</Link>
        <Card><EmptyState icon="✓" title="Nothing is due" description="You are all caught up. New cards appear here as they come due." action={<Link to={topicId ? `/topics/${topicId}?tab=Recall` : '/recall'} className="lynx-btn lynx-btn-ghost lynx-btn-sm">Back</Link>} /></Card>
      </div>
    );
  }
  if (current >= cards.length) return <ReviewComplete results={results} topicId={topicId} />;

  return (
    <div className="lynx-recall-review">
      <div className="lynx-focus-top">
        <Link to={topicId ? `/topics/${topicId}?tab=flashcards` : '/recall'} className="lynx-logo-link">← Back</Link>
        <span className="lynx-pill">{current + 1} / {cards.length}</span>
      </div>
      <Alert>{error}</Alert>
      <Card className="lynx-recall-card">
        <p className="lynx-eyebrow">{card.flashcard.topic.name} · {card.flashcard.topic.subject.name}</p>
        <div className="lynx-recall-question" aria-live="polite">
          <p><span className="sr-only">{revealed ? 'Answer: ' : 'Question: '}</span>{revealed ? card.flashcard.answer : card.flashcard.question}</p>
        </div>
        {!revealed ? (
          <button type="button" autoFocus onClick={() => setRevealed(true)} className="lynx-btn lynx-btn-primary">Reveal answer <span aria-hidden="true">Space</span></button>
        ) : (
          <div className="lynx-rating-grid" role="group" aria-label="How well did you remember it?">
            {RATINGS.map((rating, index) => (
              <button type="button" key={rating} onClick={() => rate(rating)} className={`lynx-btn lynx-rating-${rating.toLowerCase()}`}>
                <span aria-hidden="true">{index + 1}</span>{LABELS[rating]}
              </button>
            ))}
          </div>
        )}
        <p className="lynx-muted lynx-caption">Space: reveal · 1 Again · 2 Hard · 3 Good · 4 Easy</p>
      </Card>
    </div>
  );
}
