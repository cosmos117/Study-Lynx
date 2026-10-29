import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../Alert.jsx';
import Card from '../Card.jsx';
import EmptyState from '../EmptyState.jsx';
import LoadingSpinner from '../LoadingSpinner.jsx';
import FlashcardDeck from './FlashcardDeck.jsx';
import useGenerate from '../../hooks/useGenerate.js';
import { flashcardAPI } from '../../services/api.js';
import { errorMessage } from '../../utils/aiErrors.js';

/** Make flashcards from the topic's sources, practise them, and review the ones that are due. */
export default function FlashcardsTab({ topicId, hub, sourceBody, reload }) {
  const [cards, setCards] = useState(null);
  const [error, setError] = useState('');
  const { running, run } = useGenerate();
  const { cardsDue, cardsTotal } = hub.recall;

  const load = useCallback(async () => {
    try {
      setCards((await flashcardAPI.list(topicId)).data.data.flashcards);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Unable to load flashcards'));
      setCards([]);
    }
  }, [topicId]);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setError('');
    try {
      await run(() => flashcardAPI.generate(topicId, { ...sourceBody, regenerate: cards.length > 0 }));
      await Promise.all([load(), reload()]);
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  if (!cards) return <LoadingSpinner />;

  return (
    <div className="lynx-stack-tight">
      <Card className="lynx-row-between lynx-topic-toolbar">
        <div>
          <h2 className="lynx-h2">{cardsTotal ? `${cardsTotal} flashcard${cardsTotal === 1 ? '' : 's'}` : 'Flashcards'}</h2>
          <p className="lynx-muted lynx-caption">
            {cardsDue ? `${cardsDue} due for review. Spaced repetition brings each card back just before you'd forget it.` : 'Rate each card after flipping it, and it comes back on a spaced schedule.'}
          </p>
        </div>
        <div className="lynx-hub-actions">
          {cardsDue > 0 && <Link to={`/recall/review?topicId=${topicId}`} className="lynx-btn lynx-btn-primary">Review {cardsDue} due</Link>}
          <button type="button" disabled={running} onClick={generate} className={`lynx-btn ${cards.length ? 'lynx-btn-ghost' : 'lynx-btn-primary'}`}>
            {running ? 'Generating…' : cards.length ? 'Add more from sources' : 'Generate flashcards'}
          </button>
        </div>
      </Card>
      <Alert>{error}</Alert>
      <Card className="lynx-study-card">
        {cards.length
          ? <FlashcardDeck cards={cards} />
          : <EmptyState title="No flashcards yet" description={sourceBody.documentIds.length ? 'Generate a set from your sources.' : 'Add a source first for better cards, or generate from the topic name.'} />}
      </Card>
    </div>
  );
}
