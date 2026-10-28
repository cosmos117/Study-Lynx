import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import PageHeader from '../components/PageHeader.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import StudySessionCard from '../components/StudySessionCard.jsx';
import Alert from '../components/Alert.jsx';
import { useFeedback } from '../components/Feedback.jsx';
import useStartSession from '../hooks/useStartSession.js';
import usePageTitle from '../hooks/usePageTitle.js';
import useTopicOptions from '../hooks/useTopicOptions.js';
import { examAPI, studySessionAPI } from '../services/api.js';

const formatDate = (date) => date.toISOString().slice(0, 10);
const displayDate = (value) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

export default function Plan() {
  usePageTitle('My Plan');
  const { toast, confirm } = useFeedback();
  const startSession = useStartSession('/plan');
  const { topics: allTopics } = useTopicOptions();
  const [date, setDate] = useState(formatDate(new Date()));
  const [sessions, setSessions] = useState([]);
  const [exams, setExams] = useState([]);
  const [form, setForm] = useState({ examId: '', topicId: '', plannedDuration: 25, technique: 'POMODORO', startTime: '09:00' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const response = await studySessionAPI.today(date);
      setSessions(response.data.data.sessions);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load your plan');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    examAPI.list({ page: 1, limit: 100 }).then(({ data }) => setExams(data.data.items)).catch(() => setExams([]));
  }, [date]);

  const topics = useMemo(() => allTopics.filter((topic) => String(topic.examId) === form.examId), [allTopics, form.examId]);

  const nextSession = useMemo(() => sessions.find((session) => session.status === 'PLANNED' || session.status === 'IN_PROGRESS'), [sessions]);
  const changeDate = (offset) => {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + offset);
    setDate(formatDate(next));
  };
  const sessionPayload = (values) => {
    const startTime = new Date(`${date}T${values.startTime}:00`);
    return { topicId: Number(values.topicId), date: startTime.toISOString(), startTime: startTime.toISOString(), plannedDuration: Number(values.plannedDuration), technique: values.technique };
  };
  const create = async (event) => {
    event.preventDefault(); setError('');
    try { await studySessionAPI.create(sessionPayload(form)); toast('Session added to your plan'); await load(); } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to create session'); }
  };
  const generate = async () => {
    if (!form.examId) return setError('Choose an exam before generating a plan');
    if (!await confirm({ title: 'Generate a plan?', message: 'This adds study sessions to your plan from this date until the exam, prioritising weaker topics. Sessions you already have are kept.', confirmLabel: 'Generate plan' })) return;
    setError('');
    try { await studySessionAPI.generate({ examId: Number(form.examId), from: date, technique: form.technique }); toast('Plan generated'); await load(); } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to generate plan'); }
  };
  const start = async (session) => {
    try { await startSession(session); } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to start this session'); }
  };
  const skip = async (session) => {
    try { await studySessionAPI.skip(session.id); toast('Session skipped'); await load(); } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to skip this session'); }
  };

  return <div>
    <PageHeader eyebrow="Planning" title="My Plan" description="Know what to study now, then take one focused step." actions={<div className="lynx-page-header-actions"><Link to="/recall" className="lynx-btn lynx-btn-ghost">Review recall</Link>{nextSession && <button type="button" onClick={() => start(nextSession)} className="lynx-btn lynx-btn-primary">Study next <span>→</span></button>}</div>} />
    <div className="lynx-plan-toolbar lynx-card">
      <button type="button" onClick={() => changeDate(-1)} className="lynx-btn lynx-btn-ghost lynx-btn-sm">←</button>
      <strong>{displayDate(date)}</strong>
      <button type="button" onClick={() => changeDate(1)} className="lynx-btn lynx-btn-ghost lynx-btn-sm">→</button>
      <button type="button" onClick={() => setDate(formatDate(new Date()))} className="lynx-text-link">Today</button>
    </div>
    <Alert className="lynx-section-gap" onRetry={load}>{error}</Alert>
    <div className="lynx-plan-grid">
      <section><SectionHeader title="Today's timeline" description={`${sessions.length} session${sessions.length === 1 ? '' : 's'} planned`} />{loading ? <LoadingSpinner /> : sessions.length ? <div className="lynx-stack">{sessions.map((session) => <StudySessionCard key={session.id} session={session} planned onStart={start} onSkip={skip} />)}</div> : <Card><EmptyState title="Your day is open" description="Add a session or generate a simple plan to answer what should I study now?" /></Card>}</section>
      <section className="lynx-stack-tight">
        <Card><SectionHeader title="Add a session" description="Choose a topic and technique." /><form onSubmit={create} className="lynx-form">
          <select required aria-label="Exam" className="lynx-input" value={form.examId} onChange={(event) => setForm({ ...form, examId: event.target.value, topicId: '' })}><option value="">Choose exam</option>{exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}</select>
          <select required aria-label="Topic" className="lynx-input" value={form.topicId} onChange={(event) => setForm({ ...form, topicId: event.target.value })}><option value="">Choose topic</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.shortLabel}</option>)}</select>
          <div className="lynx-form-two"><input aria-label="Start time" className="lynx-input" type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /><select aria-label="Duration" className="lynx-input" value={form.plannedDuration} onChange={(event) => setForm({ ...form, plannedDuration: event.target.value })}><option value="25">25 min</option><option value="50">50 min</option><option value="90">90 min</option></select></div>
          <select aria-label="Study technique" className="lynx-input" value={form.technique} onChange={(event) => setForm({ ...form, technique: event.target.value })}><option value="POMODORO">Pomodoro 25/5</option><option value="DEEP_FOCUS">Deep Focus 50/10</option><option value="CUSTOM">Custom</option></select>
          <button className="lynx-btn lynx-btn-primary lynx-btn-block">Add to plan</button>
        </form></Card>
        <Card><SectionHeader title="Generate a simple plan" description="Deterministic scheduling prioritizes weaker topics." /><p className="lynx-muted lynx-sub">Sessions will be created from the selected exam's daily available hours through its exam date.</p><button type="button" onClick={generate} className="lynx-btn lynx-btn-ghost lynx-btn-block">Generate plan</button></Card>
      </section>
    </div>
  </div>;
}
