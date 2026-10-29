import { useCallback, useEffect, useRef, useState } from 'react';
import { useFeedback } from '../Feedback.jsx';
import { flashcardAPI } from '../../services/api.js';
import { errorMessage } from '../../utils/aiErrors.js';

const RATINGS = ['AGAIN', 'HARD', 'GOOD', 'EASY'];
const RATING_LABELS = { AGAIN: 'Again', HARD: 'Hard', GOOD: 'Good', EASY: 'Easy' };

/** Flip through a topic's flashcards and rate each one; the rating schedules its next review (SM-2). */
export default function FlashcardDeck({ cards }) {
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
      toast(errorMessage(requestError, 'Unable to save that rating'), 'error');
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
