import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import MiniCalendar from '../components/MiniCalendar.jsx';
import PageHeader from '../components/PageHeader.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import StreakBadge from '../components/StreakBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import { insightsAPI, motivationAPI, subjectAPI } from '../services/api.js';
import { formatMinutes } from '../utils/format.js';
import { errorMessage } from '../utils/aiErrors.js';

const CONTINUE_LIMIT = 6;

export default function Dashboard() {
  usePageTitle('Home');
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [motivation, setMotivation] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [overviewResponse, subjectResponse] = await Promise.all([insightsAPI.overview(), subjectAPI.list()]);
      setOverview(overviewResponse.data.data);
      setSubjects(subjectResponse.data.data.subjects);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Unable to load your home page'));
    }
  }, []);

  useEffect(() => {
    load();
    motivationAPI.today().then((response) => setMotivation(response.data.data.motivation)).catch(() => {});
  }, [load]);

  if (error && !overview) return <Alert onRetry={load}>{error}</Alert>;
  if (!overview) return <LoadingSpinner />;

  const { topics, today, nextExam, streakDays } = overview;
  const totalDue = topics.reduce((sum, topic) => sum + topic.cardsDue, 0);
  const examEvents = subjects.filter((subject) => subject.examDate).map((subject) => ({ date: subject.examDate, label: `${subject.name} exam` }));

  return (
    <div>
      {motivation && <blockquote className="lynx-quote">&ldquo;{motivation}&rdquo;</blockquote>}
      <PageHeader
        eyebrow="Home"
        title={`Welcome back, ${user.name}`}
        description={nextExam
          ? `${nextExam.name} exam ${nextExam.daysLeft <= 0 ? 'is today' : `in ${nextExam.daysLeft} day${nextExam.daysLeft === 1 ? '' : 's'}`}.`
          : 'Pick a topic, start a focus block, and study one step at a time.'}
        aside={<><StreakBadge days={streakDays} /><MiniCalendar events={examEvents} /></>}
      />
      <Alert className="lynx-section-gap" onRetry={load}>{error}</Alert>

      {!topics.length ? (
        <Card>
          <EmptyState
            title="Let's set up your first topic"
            description="Add a subject and the topics you need to learn. Each topic gets its own sources, AI help, flashcards and quiz."
            action={<Link to="/subjects" className="lynx-btn lynx-btn-primary">Add a subject</Link>}
          />
        </Card>
      ) : (
        <>
          <div className="lynx-grid-3 lynx-grid-2">
            <Card className="lynx-home-card">
              <p className="lynx-eyebrow">Flashcards due</p>
              <p className="lynx-home-number">{totalDue}</p>
              <p className="lynx-muted lynx-caption">{totalDue ? 'Review them now while they are fresh.' : 'You are all caught up.'}</p>
              {totalDue > 0 && <Link to="/recall/review" className="lynx-btn lynx-btn-primary lynx-btn-sm">Review now</Link>}
            </Card>
            <Card className="lynx-home-card">
              <p className="lynx-eyebrow">Focused today</p>
              <p className="lynx-home-number">{formatMinutes(today.studyMinutes)}</p>
              <p className="lynx-muted lynx-caption">{today.sessionsDone} focus block{today.sessionsDone === 1 ? '' : 's'} completed. Start one from a topic or the ▶ Focus button.</p>
            </Card>
          </div>

          <section className="lynx-section-gap" aria-labelledby="continue">
            <SectionHeader title="Continue studying" description="Topics with cards due come first." />
            <div className="lynx-continue-grid" id="continue">
              {topics.slice(0, CONTINUE_LIMIT).map((topic) => (
                <Link key={topic.id} to={`/topics/${topic.id}`} className="lynx-card lynx-card-hover lynx-continue-card">
                  <span className="lynx-muted lynx-caption">{topic.subject.name}</span>
                  <strong>{topic.name}</strong>
                  <span className="lynx-muted lynx-caption">
                    {topic.cardsDue ? `${topic.cardsDue} card${topic.cardsDue === 1 ? '' : 's'} due` : topic.cardsTotal ? `${topic.cardsTotal} flashcards` : 'Not started'}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
