import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import PageHeader from '../components/PageHeader.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import { insightsAPI } from '../services/api.js';

const LOW_SCORE = 60;

function QuizRow({ topic, action }) {
  const { quiz } = topic;
  return (
    <Card className="lynx-resource-row">
      <div>
        <h3 className="lynx-h3">{topic.name}</h3>
        <p className="lynx-muted lynx-caption">
          {topic.subject.name} · {quiz.attempts
            ? `Latest ${quiz.latestPercent}% · ${quiz.attempts} attempt${quiz.attempts === 1 ? '' : 's'}`
            : quiz.ready ? 'Not taken yet' : 'No quiz yet'}
        </p>
      </div>
      <div className="lynx-resource-actions">{action}</div>
    </Card>
  );
}

export default function Quizzes() {
  usePageTitle('Quizzes');
  const [topics, setTopics] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    insightsAPI.overview()
      .then(({ data }) => setTopics(data.data.topics))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load your quizzes'));
  }, []);
  useEffect(load, [load]);

  if (error && !topics) return <Alert onRetry={load}>{error}</Alert>;
  if (!topics) return <LoadingSpinner />;

  const takeLink = (topic, label) => <Link to={`/topics/${topic.id}/study?tab=Quiz`} className="lynx-btn lynx-btn-primary lynx-btn-sm">{label}</Link>;
  const hubLink = (topic) => <Link to={`/topics/${topic.id}?tab=Practice`} className="lynx-btn lynx-btn-ghost lynx-btn-sm">Create quiz</Link>;
  const revisit = topics.filter((topic) => topic.quiz.attempts && topic.quiz.latestPercent < LOW_SCORE);
  const ready = topics.filter((topic) => topic.quiz.ready && !revisit.includes(topic));
  const missing = topics.filter((topic) => !topic.quiz.ready);

  return (
    <div>
      <PageHeader eyebrow="Practice" title="Quizzes" description="Check what you know and find the gaps. Each quiz belongs to a topic, so your results feed that topic's mastery." />
      {!topics.length ? (
        <Card><EmptyState title="No topics yet" description="Quizzes are created per topic. Add an exam and its topics first." action={<Link to="/subjects" className="lynx-btn lynx-btn-primary">Go to Subjects</Link>} /></Card>
      ) : (
        <div className="lynx-stack-tight">
          {revisit.length > 0 && (
            <section>
              <SectionHeader title="Worth another try" description={`Your latest score was under ${LOW_SCORE}%. Review the topic, then retake.`} />
              <div className="lynx-stack">
                {revisit.map((topic) => (
                  <QuizRow key={topic.id} topic={topic} action={<><Link to={`/topics/${topic.id}?tab=Progress`} className="lynx-btn lynx-btn-ghost lynx-btn-sm">See weak spots</Link>{takeLink(topic, 'Retake')}</>} />
                ))}
              </div>
            </section>
          )}
          {ready.length > 0 && (
            <section>
              <SectionHeader title="Ready to take" description="Quizzes you have already created." />
              <div className="lynx-stack">
                {ready.map((topic) => <QuizRow key={topic.id} topic={topic} action={takeLink(topic, topic.quiz.attempts ? 'Retake' : 'Take quiz')} />)}
              </div>
            </section>
          )}
          {missing.length > 0 && (
            <section>
              <SectionHeader title="No quiz yet" description="Create one from your own materials in the topic hub." />
              <div className="lynx-stack">
                {missing.map((topic) => <QuizRow key={topic.id} topic={topic} action={hubLink(topic)} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
