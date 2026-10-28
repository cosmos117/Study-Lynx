import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import MasteryMeter from '../components/MasteryMeter.jsx';
import PageHeader from '../components/PageHeader.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import StudySessionCard from '../components/StudySessionCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useStartSession from '../hooks/useStartSession.js';
import usePageTitle from '../hooks/usePageTitle.js';
import { hubAPI, insightsAPI, motivationAPI, studySessionAPI } from '../services/api.js';
import { formatMinutes, todayKey } from '../utils/format.js';

function ReasonList({ reasons }) {
  return (
    <ul className="lynx-reasons" aria-label="Why this topic">
      {reasons.map((reason) => <li key={reason} className="lynx-pill">{reason}</li>)}
    </ul>
  );
}

export default function Dashboard() {
  usePageTitle('Dashboard');
  const { user } = useAuth();
  const navigate = useNavigate();
  const startSession = useStartSession('/dashboard');
  const [overview, setOverview] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [motivation, setMotivation] = useState('');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [overviewResponse, sessionResponse] = await Promise.all([insightsAPI.overview(), studySessionAPI.today(todayKey())]);
      setOverview(overviewResponse.data.data);
      setSessions(sessionResponse.data.data.sessions);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load your dashboard');
    }
  }, []);

  useEffect(() => {
    load();
    motivationAPI.today().then((response) => setMotivation(response.data.data.motivation)).catch(() => {});
  }, [load]);

  const studyNow = async (topic) => {
    setStarting(true);
    try {
      const { data } = await hubAPI.studyNow(topic.id);
      navigate(`/study-session/${data.data.session.id}`, { state: { returnTo: `/topics/${topic.id}?tab=Recall` } });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to start a study session');
      setStarting(false);
    }
  };

  if (error && !overview) return <Alert onRetry={load}>{error}</Alert>;
  if (!overview) return <LoadingSpinner />;

  const { topics, today, nextExam, streakDays } = overview;
  const [focus, ...others] = topics;
  const totalDue = topics.reduce((sum, topic) => sum + topic.cardsDue, 0);
  const scored = topics.filter((topic) => topic.mastery.score !== null);
  const averageMastery = scored.length ? Math.round(scored.reduce((sum, topic) => sum + topic.mastery.score, 0) / scored.length) : null;
  const todayDone = today.goalMinutes ? Math.min(100, Math.round((today.studyMinutes / today.goalMinutes) * 100)) : null;
  const openSessions = sessions.filter((session) => session.status === 'PLANNED' || session.status === 'IN_PROGRESS');

  return (
    <div>
      <PageHeader
        eyebrow="Your workspace"
        title={`Welcome back, ${user.name}`}
        description={nextExam
          ? `${nextExam.name} is ${nextExam.daysLeft <= 0 ? 'today' : `in ${nextExam.daysLeft} day${nextExam.daysLeft === 1 ? '' : 's'}`}. ${motivation}`
          : motivation || 'Add an exam to get a study plan that fits your deadline.'}
        actions={totalDue > 0 && <Link to="/recall" className="lynx-btn lynx-btn-ghost">Review {totalDue} due card{totalDue === 1 ? '' : 's'}</Link>}
      />
      <Alert className="lynx-section-gap" onRetry={load}>{error}</Alert>

      {!focus ? (
        <Card>
          <EmptyState
            title="Let's set up your first topic"
            description="Add an exam, then the subjects and topics you need to learn. Study Lynx will tell you what to study first, and why."
            action={<Link to="/subjects" className="lynx-btn lynx-btn-primary">Add an exam</Link>}
          />
        </Card>
      ) : (
        <>
          <section aria-labelledby="study-next">
            <SectionHeader title="Study this next" description="Chosen from your due cards, exam dates and how well you know each topic." />
            <Card className="lynx-priority">
              <div className="lynx-row-between">
                <div>
                  <h3 id="study-next" className="lynx-h2">{focus.name}</h3>
                  <p className="lynx-muted lynx-caption">{focus.subject.name} · {focus.exam.name}</p>
                </div>
                <span className="lynx-priority-rank" aria-hidden="true">1</span>
              </div>
              <ReasonList reasons={focus.priority.reasons} />
              <MasteryMeter mastery={focus.mastery} label="How well you know it" />
              <div className="lynx-hub-actions">
                <button type="button" disabled={starting} onClick={() => studyNow(focus)} className="lynx-btn lynx-btn-primary">{starting ? 'Starting…' : 'Study now'}</button>
                <Link to={`/topics/${focus.id}`} className="lynx-btn lynx-btn-ghost">Open topic hub</Link>
                {focus.cardsDue > 0 && <Link to={`/recall/review?topicId=${focus.id}`} className="lynx-btn lynx-btn-ghost">Review {focus.cardsDue} due</Link>}
              </div>
            </Card>
            {others.length > 0 && (
              <div className="lynx-stack">
                {others.slice(0, 3).map((topic, index) => (
                  <Card key={topic.id} className="lynx-priority">
                    <div className="lynx-row-between">
                      <div>
                        <h3 className="lynx-h3"><Link to={`/topics/${topic.id}`} className="lynx-text-link lynx-plain-link">{topic.name}</Link></h3>
                        <p className="lynx-muted lynx-caption">{topic.subject.name} · {topic.priority.reasons.join(' · ')}</p>
                      </div>
                      <span className="lynx-priority-rank" aria-hidden="true">{index + 2}</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <div className="lynx-grid-3 lynx-section-gap">
            <StatCard label="Study streak" value={`${streakDays} day${streakDays === 1 ? '' : 's'}`} detail={streakDays ? 'Days in a row with study or recall' : 'Study or review a card to start one'} tone="amber" icon="↻" />
            <StatCard label="Cards due" value={totalDue} detail={totalDue ? 'Review them while they are fresh' : 'You are all caught up'} icon="◷" />
            <StatCard label="Average mastery" value={averageMastery === null ? '—' : `${averageMastery}%`} detail={averageMastery === null ? 'Review cards or take a quiz to see it' : `Across ${scored.length} topic${scored.length === 1 ? '' : 's'}`} tone="success" icon="✓" />
          </div>
        </>
      )}

      <div className="lynx-dashboard-grid lynx-section-gap">
        <section aria-labelledby="today-goal">
          <SectionHeader title="Today" description="Time studied against your daily goal." />
          <Card className="lynx-priority">
            <h3 id="today-goal" className="lynx-h3">{formatMinutes(today.studyMinutes)} studied</h3>
            {todayDone !== null
              ? <ProgressBar value={todayDone} label={`Goal: ${formatMinutes(today.goalMinutes)} a day for ${nextExam.name}`} />
              : <p className="lynx-muted lynx-caption">Add an exam to set a daily goal.</p>}
            <p className="lynx-muted lynx-caption">{today.sessionsDone} session{today.sessionsDone === 1 ? '' : 's'} completed today</p>
          </Card>
        </section>
        <section aria-labelledby="planned">
          <SectionHeader title="Planned for today" description="Sessions from My Plan." />
          <div className="lynx-stack" id="planned">
            {openSessions.slice(0, 3).map((session) => (
              <StudySessionCard key={session.id} session={session} planned onStart={startSession} />
            ))}
            {!openSessions.length && (
              <Card>
                <EmptyState title="Nothing planned for today" description="Plan a session to turn your intentions into a routine." action={<Link to="/plan" className="lynx-btn lynx-btn-ghost lynx-btn-sm">Open My Plan</Link>} />
              </Card>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
