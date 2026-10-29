import { useCallback, useEffect, useState } from 'react';
import Alert from '../Alert.jsx';
import Card from '../Card.jsx';
import EmptyState from '../EmptyState.jsx';
import { useFeedback } from '../Feedback.jsx';
import LoadingSpinner from '../LoadingSpinner.jsx';
import QuizView from './QuizView.jsx';
import useGenerate from '../../hooks/useGenerate.js';
import { quizAPI } from '../../services/api.js';
import { errorMessage } from '../../utils/aiErrors.js';

/** A 10-question multiple-choice quiz built from the topic's sources. */
export default function QuizTab({ topicId, hub, sourceBody, reload }) {
  const { confirm } = useFeedback();
  const [quiz, setQuiz] = useState(undefined);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState('');
  const { running, run } = useGenerate();
  const latest = hub.practice.latest;

  const load = useCallback(async () => {
    try {
      const { quiz: saved, attempt: last } = (await quizAPI.get(topicId)).data.data;
      setQuiz(saved);
      // A submitted quiz comes back exactly as it was left: the answers, the score and every explanation.
      if (last) {
        setResult(last);
        setAnswers(Object.fromEntries(last.answers.filter((item) => item.selectedIndex >= 0).map((item) => [item.questionIndex, item.selectedIndex])));
      }
    } catch (requestError) {
      setError(errorMessage(requestError, 'Unable to load the quiz'));
      setQuiz(null);
    }
  }, [topicId]);

  useEffect(() => { load(); }, [load]);

  const reset = () => { setAnswers({}); setResult(null); setAttempt((value) => value + 1); };

  // Deletes the quiz: its questions, your answers and the result. Past scores still count toward progress.
  const clear = async () => {
    if (!await confirm({ title: 'Clear this quiz?', message: 'The questions, your answers and the result are deleted. Past scores still count toward your progress.', confirmLabel: 'Clear', danger: true })) return;
    setError('');
    setClearing(true);
    try {
      await quizAPI.remove(topicId);
      reset();
      setQuiz(null);
      await reload();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Unable to clear the quiz'));
    } finally {
      setClearing(false);
    }
  };

  const generate = async () => {
    if (quiz && !await confirm({ title: 'Make a new quiz?', message: 'A new set of 10 questions will replace this one. Your past scores are kept.', confirmLabel: 'New quiz' })) return;
    setError('');
    try {
      await run(() => quizAPI.generate(topicId, { ...sourceBody, regenerate: Boolean(quiz) }));
      reset();
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  const submit = async () => {
    const total = (quiz?.content?.questions || quiz?.questions || []).length;
    const blank = total - Object.keys(answers).length;
    if (blank > 0 && !await confirm({ title: 'Submit with unanswered questions?', message: `${blank} question${blank === 1 ? ' is' : 's are'} blank and will count as incorrect.`, confirmLabel: 'Submit anyway' })) return;
    setSubmitting(true);
    try {
      const response = await quizAPI.submit(topicId, {
        answers: Object.entries(answers).map(([questionIndex, selectedIndex]) => ({ questionIndex: Number(questionIndex), selectedIndex: Number(selectedIndex) })),
      });
      setResult({ ...response.data.data, attemptedAt: new Date().toISOString() });
      await reload();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  if (quiz === undefined) return <LoadingSpinner />;

  return (
    <div className="lynx-stack-tight">
      <Card className="lynx-row-between lynx-topic-toolbar">
        <div>
          <h2 className="lynx-h2">Quiz · 10 questions</h2>
          <p className="lynx-muted lynx-caption">{latest ? `Last score ${latest.score}/${latest.total} · ${hub.practice.attempts} attempt${hub.practice.attempts === 1 ? '' : 's'}` : 'Test yourself, then read the explanation for every answer.'}</p>
        </div>
        <div className="lynx-hub-actions">
          {quiz && (
            <button type="button" disabled={clearing || running} onClick={clear} className="lynx-btn lynx-btn-ghost">
              {clearing ? 'Clearing…' : 'Clear'}
            </button>
          )}
          <button type="button" disabled={running} onClick={generate} className={`lynx-btn ${quiz ? 'lynx-btn-ghost' : 'lynx-btn-primary'}`}>
            {running ? 'Generating…' : quiz ? 'New quiz' : 'Generate quiz'}
          </button>
        </div>
      </Card>
      <Alert>{error}</Alert>
      <Card className="lynx-study-card">
        {quiz
          ? <QuizView key={attempt} quiz={quiz} answers={answers} setAnswers={setAnswers} submit={submit} submitting={submitting} result={result} onRetry={reset} />
          : <EmptyState title="No quiz yet" description={sourceBody.documentIds.length ? 'Generate 10 questions from your sources.' : 'Add a source first for better questions, or generate from the topic name.'} />}
      </Card>
    </div>
  );
}
