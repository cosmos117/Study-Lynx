import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useFeedback } from '../components/Feedback.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import PageHeader from '../components/PageHeader.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import { subjectAPI, topicAPI } from '../services/api.js';
import { errorMessage } from '../utils/aiErrors.js';

const DAY_MS = 24 * 60 * 60 * 1000;
// <input type="date"> works in YYYY-MM-DD; the API stores a full date.
const toInputDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

function examLabel(examDate) {
  if (!examDate) return 'No exam date';
  const days = Math.ceil((new Date(examDate) - new Date().setHours(0, 0, 0, 0)) / DAY_MS);
  const date = new Date(examDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (days < 0) return `Exam was on ${date}`;
  return days === 0 ? 'Exam today' : `Exam in ${days} day${days === 1 ? '' : 's'} · ${date}`;
}

function SubjectForm({ initial = { name: '', examDate: '' }, submitLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    const ok = await onSubmit({ name: form.name, examDate: form.examDate || null });
    setBusy(false);
    if (ok && !onCancel) setForm({ name: '', examDate: '' });
  };

  return (
    <form onSubmit={submit} className="lynx-form">
      <label className="lynx-label">
        Subject name
        <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Database Systems" maxLength={150} className="lynx-input" />
      </label>
      <label className="lynx-label">
        Exam date <span className="lynx-muted lynx-caption">(optional)</span>
        <input type="date" value={form.examDate} onChange={(event) => setForm({ ...form, examDate: event.target.value })} className="lynx-input" />
      </label>
      <div className="lynx-hub-actions">
        <button disabled={busy} className="lynx-btn lynx-btn-primary">{busy ? 'Saving…' : submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} className="lynx-btn lynx-btn-ghost">Cancel</button>}
      </div>
    </form>
  );
}

function SubjectCard({ subject, attempt, onChanged }) {
  const { confirm } = useFeedback();
  const [editing, setEditing] = useState(false);
  const [topicName, setTopicName] = useState('');

  const save = async (values) => {
    const ok = await attempt(() => subjectAPI.update(subject.id, values), 'Subject saved');
    if (ok) { setEditing(false); await onChanged(); }
    return ok;
  };

  const remove = async () => {
    if (!await confirm({ title: `Delete "${subject.name}"?`, message: 'Its topics, flashcards, quizzes and notes are deleted too. This cannot be undone.', confirmLabel: 'Delete', danger: true })) return;
    if (await attempt(() => subjectAPI.remove(subject.id), 'Subject deleted')) await onChanged();
  };

  const addTopic = async (event) => {
    event.preventDefault();
    if (await attempt(() => topicAPI.create(subject.id, { name: topicName }), 'Topic added')) {
      setTopicName('');
      await onChanged();
    }
  };

  const removeTopic = async (topic) => {
    if (!await confirm({ title: `Delete "${topic.name}"?`, message: 'Its flashcards, quiz, notes and sources are deleted too.', confirmLabel: 'Delete', danger: true })) return;
    if (await attempt(() => topicAPI.remove(topic.id), 'Topic deleted')) await onChanged();
  };

  return (
    <Card>
      {editing ? (
        <SubjectForm initial={{ name: subject.name, examDate: toInputDate(subject.examDate) }} submitLabel="Save" onSubmit={save} onCancel={() => setEditing(false)} />
      ) : (
        <div className="lynx-row-between">
          <div>
            <h2 className="lynx-h2">{subject.name}</h2>
            <p className="lynx-muted lynx-caption">{examLabel(subject.examDate)}</p>
          </div>
          <div className="lynx-resource-actions">
            <button type="button" onClick={() => setEditing(true)} className="lynx-link-btn">Edit</button>
            <button type="button" onClick={remove} className="lynx-link-btn">Delete</button>
          </div>
        </div>
      )}

      <ul className="lynx-topic-list">
        {subject.topics.map((topic) => (
          <li key={topic.id}>
            <Link to={`/topics/${topic.id}`} className="lynx-topic-link">{topic.name} <span aria-hidden="true">→</span></Link>
            <button type="button" onClick={() => removeTopic(topic)} className="lynx-link-btn" aria-label={`Delete ${topic.name}`}>Delete</button>
          </li>
        ))}
      </ul>

      <form onSubmit={addTopic} className="lynx-inline-form lynx-section-gap">
        <input required aria-label={`New topic in ${subject.name}`} value={topicName} onChange={(event) => setTopicName(event.target.value)} placeholder="Add a topic, e.g. Normalization" maxLength={150} className="lynx-input lynx-grow" />
        <button className="lynx-btn lynx-btn-ghost">Add topic</button>
      </form>
    </Card>
  );
}

export default function Subjects() {
  usePageTitle('Subjects');
  const { toast } = useFeedback();
  const [subjects, setSubjects] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setSubjects((await subjectAPI.list()).data.data.subjects);
      setError('');
    } catch (requestError) {
      setError(errorMessage(requestError, 'Unable to load your subjects'));
      setSubjects((current) => current || []);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /** Runs a request, reports the outcome, and returns whether it worked. */
  const attempt = async (request, success) => {
    setError('');
    try {
      await request();
      toast(success);
      return true;
    } catch (requestError) {
      setError(errorMessage(requestError, 'Something went wrong. Please try again.'));
      return false;
    }
  };

  const create = async (values) => {
    const ok = await attempt(() => subjectAPI.create(values), 'Subject added');
    if (ok) await load();
    return ok;
  };

  if (!subjects) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader eyebrow="Study" title="Subjects" description="Add a subject, then the topics you need to learn. Open a topic to study it." />
      <Alert className="lynx-section-gap" onRetry={load}>{error}</Alert>
      <div className="lynx-exams-grid">
        <Card>
          <h2 className="lynx-h2">Add a subject</h2>
          <div className="lynx-section-gap"><SubjectForm submitLabel="Add subject" onSubmit={create} /></div>
        </Card>
        <div className="lynx-stack">
          {subjects.length
            ? subjects.map((subject) => <SubjectCard key={subject.id} subject={subject} attempt={attempt} onChanged={load} />)
            : <Card><EmptyState title="No subjects yet" description="Add your first subject on the left, then add the topics you want to study." /></Card>}
        </div>
      </div>
    </div>
  );
}
