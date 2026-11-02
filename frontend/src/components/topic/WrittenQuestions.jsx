import { useState } from 'react';
import RichText from '../RichText.jsx';

/**
 * Exam-style written questions with model answers, hidden until the student asks to see them, so
 * they can answer in their head (or on paper) first.
 */
export default function WrittenQuestions({ title, marks, items }) {
  const [shown, setShown] = useState(() => new Set());
  if (!items?.length) return null;

  const allShown = shown.size === items.length;
  const toggle = (index) => setShown((current) => {
    const next = new Set(current);
    if (next.has(index)) next.delete(index); else next.add(index);
    return next;
  });
  const toggleAll = () => setShown(allShown ? new Set() : new Set(items.map((_, index) => index)));

  return (
    <section className="lynx-written lynx-section-gap" aria-label={title}>
      <div className="lynx-row-between">
        <h3 className="lynx-h3">{title} <span className="lynx-muted lynx-caption">· {items.length} questions · {marks} marks each</span></h3>
        <button type="button" onClick={toggleAll} className="lynx-btn lynx-btn-ghost lynx-btn-sm">{allShown ? 'Hide all answers' : 'Show all answers'}</button>
      </div>
      <ol className="lynx-written-list">
        {items.map((item, index) => (
          <li key={item.question} className="lynx-written-item">
            <div className="lynx-row-between lynx-written-head">
              <p className="lynx-written-question">{item.question}</p>
              <span className="lynx-pill">{marks} marks</span>
            </div>
            <button type="button" onClick={() => toggle(index)} aria-expanded={shown.has(index)} className="lynx-link-btn lynx-written-toggle">
              {shown.has(index) ? 'Hide answer' : 'Show answer'}
            </button>
            {shown.has(index) && (
              <div className="lynx-written-answer">
                <p className="lynx-eyebrow">Model answer</p>
                <RichText text={item.answer} />
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
