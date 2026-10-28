import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import Card from '../components/Card.jsx';
import { useFeedback } from '../components/Feedback.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import { studySessionAPI } from '../services/api.js';

const TECHNIQUES = { POMODORO: 'Pomodoro 25/5', DEEP_FOCUS: 'Deep Focus 50/10', CUSTOM: 'Custom' };
const pad = (value) => String(value).padStart(2, '0');

export default function FocusSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const returnTo = useLocation().state?.returnTo || '/plan';
  const { toast } = useFeedback();
  const [session, setSession] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    studySessionAPI.start(id)
      .then(({ data }) => setSession(data.data.session))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to start this session'));
  }, [id]);

  useEffect(() => {
    if (!running || !session) return undefined;
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [running, session]);

  const plannedSeconds = session ? (session.plannedDuration || session.duration) * 60 : 0;
  const remaining = Math.max(0, plannedSeconds - elapsed);
  const clock = `${pad(Math.floor(remaining / 60))}:${pad(remaining % 60)}`;
  usePageTitle(session ? `${clock} · ${session.topic.name}` : 'Study session');

  const finish = async () => {
    setFinishing(true);
    setError('');
    const minutes = Math.max(1, Math.ceil(elapsed / 60));
    try {
      await studySessionAPI.complete(id, { actualDuration: minutes });
      toast(`Session saved: ${minutes} min on ${session.topic.name}. Next, lock it in with recall.`);
      navigate(returnTo);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save this session. Your time is still counting.');
      setFinishing(false);
    }
  };

  if (error && !session) {
    return <div className="lynx-focus-page"><Alert>{error}</Alert><Link to={returnTo} className="lynx-btn lynx-btn-ghost">Back</Link></div>;
  }
  if (!session) return <div className="lynx-focus-page"><LoadingSpinner /></div>;

  return (
    <div className="lynx-focus-page">
      <div className="lynx-focus-top">
        <Link to={returnTo} className="lynx-logo-link">← Leave session</Link>
        <span className="lynx-pill">{TECHNIQUES[session.technique] || 'Custom'}</span>
      </div>
      <Alert>{error}</Alert>
      <Card className="lynx-focus-card">
        <p className="lynx-eyebrow">Focus session</p>
        <h1 className="lynx-h1">{session.topic.name}</h1>
        <p className="lynx-muted lynx-sub">{session.topic.subject.name} · One focused task at a time.</p>
        <div className="lynx-timer" role="timer" aria-label={`${clock} remaining`}>{clock}</div>
        {remaining === 0
          ? <p role="status" className="lynx-alert-success lynx-alert">Time is up. Finish the session to save it.</p>
          : <p className="lynx-muted">Elapsed {Math.floor(elapsed / 60)} min</p>}
        <div className="lynx-hub-actions lynx-section-gap">
          <Link to={`/topics/${session.topic.id}`} target="_blank" rel="noreferrer" className="lynx-btn lynx-btn-ghost">Open topic materials</Link>
        </div>
        <div className="lynx-focus-actions">
          <button type="button" onClick={() => setRunning(!running)} className="lynx-btn lynx-btn-ghost">{running ? 'Pause' : 'Resume'}</button>
          <button type="button" disabled={finishing} onClick={finish} className="lynx-btn lynx-btn-primary">{finishing ? 'Saving…' : 'Finish session'}</button>
        </div>
      </Card>
    </div>
  );
}
