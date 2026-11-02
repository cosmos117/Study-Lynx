/**
 * A flashcard that turns over in 3D. Both faces share a grid cell, so the card is as tall as its
 * longer side and doesn't jump when flipped. Give it a `key` per card: a new card then starts on its
 * question, instead of animating back and showing the next answer on the way.
 */
export default function FlipCard({ question, answer, flipped, onFlip }) {
  return (
    <button type="button" className={`lynx-flip-card ${flipped ? 'is-flipped' : ''}`} onClick={onFlip} aria-pressed={flipped}>
      <span className="sr-only">{flipped ? 'Showing the answer. Press to show the question.' : 'Showing the question. Press to reveal the answer.'}</span>
      <span className="lynx-flip-card-inner" aria-live="polite">
        <span className="lynx-flip-card-face" aria-hidden={flipped}>
          <span className="lynx-flip-card-label" aria-hidden="true">Question</span>
          <span className="lynx-flip-card-text">{question}</span>
        </span>
        <span className="lynx-flip-card-face lynx-flip-card-back" aria-hidden={!flipped}>
          <span className="lynx-flip-card-label" aria-hidden="true">Answer</span>
          <span className="lynx-flip-card-text">{answer}</span>
        </span>
      </span>
    </button>
  );
}
