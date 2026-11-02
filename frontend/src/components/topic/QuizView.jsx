import WrittenQuestions from './WrittenQuestions.jsx';

// After submitting, show which option was right and which wrong option the student picked.
function optionClass(result, question, optionIndex, chosen) {
  if (!result) return 'lynx-option';
  if (optionIndex === question.correctIndex) return 'lynx-option is-correct';
  return chosen ? 'lynx-option is-wrong' : 'lynx-option';
}

/** A quiz: multiple-choice questions to answer and submit, then 2-mark and 5-mark questions with model answers. */
export default function QuizView({ quiz, answers, setAnswers, submit, submitting, result, onRetry }) {
  const content = quiz.content || quiz;
  const questions = content.questions || [];
  return (
    <div>
      <p className="lynx-eyebrow">AI-generated. Verify important facts.</p>
      {questions.length > 0 && <h3 className="lynx-h3 lynx-section-gap">Multiple choice <span className="lynx-muted lynx-caption">· {questions.length} questions</span></h3>}
      {result && (
        <p className="lynx-h2 lynx-quiz-score" role="status">
          Score: {result.score}/{result.totalQuestions}
          {result.attemptedAt && <span className="lynx-muted lynx-caption"> · submitted {new Date(result.attemptedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>}
        </p>
      )}
      {questions.map((question, index) => {
        const graded = result?.answers?.[index];
        return (
          <fieldset key={question.question} className="lynx-quiz-question" disabled={Boolean(result)}>
            <legend>{index + 1}. {question.question}</legend>
            {question.options.map((option, optionIndex) => {
              const chosen = answers[index] === optionIndex;
              return (
                <label key={option} className={optionClass(result, question, optionIndex, chosen)}>
                  <input type="radio" name={`question-${index}`} checked={chosen} onChange={() => setAnswers({ ...answers, [index]: optionIndex })} /> {option}
                </label>
              );
            })}
            {graded && (
              <p className={graded.correct ? 'lynx-quiz-correct' : 'lynx-quiz-wrong'} role="status">
                <strong>
                  {graded.correct ? 'Correct.' : `${graded.selectedIndex === -1 ? 'Not answered.' : 'Not quite.'} The answer is "${question.options[question.correctIndex]}".`}
                </strong>{' '}
                {graded.explanation}
              </p>
            )}
          </fieldset>
        );
      })}
      {questions.length > 0 && (!result ? (
        <button type="button" onClick={submit} disabled={submitting} className="lynx-btn lynx-btn-primary lynx-section-gap">{submitting ? 'Submitting...' : 'Submit MCQs'}</button>
      ) : (
        <div className="lynx-section-gap lynx-hub-actions">
          <button type="button" onClick={onRetry} className="lynx-btn lynx-btn-primary">Try again</button>
        </div>
      ))}
      <WrittenQuestions title="2-mark questions" marks={2} items={content.shortQuestions} />
      <WrittenQuestions title="5-mark questions" marks={5} items={content.longQuestions} />
    </div>
  );
}
