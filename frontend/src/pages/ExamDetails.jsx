import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Card from '../components/Card.jsx';
import SubjectCard from '../components/SubjectCard.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import Alert from '../components/Alert.jsx';
import { useFeedback } from '../components/Feedback.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import { examAPI, subjectAPI, topicAPI } from '../services/api.js';

function dateInputValue(date) {
  return new Date(date).toISOString().slice(0, 10);
}

export default function ExamDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState(null);
  const [subjectName, setSubjectName] = useState('');
  const [topicForms, setTopicForms] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { toast, confirm } = useFeedback();
  usePageTitle(exam?.name || 'Exam');

  // Run a change, tell the student how it went, and never leave a failure silent.
  const attempt = async (action, success) => {
    try {
      await action();
      if (success) toast(success);
      return true;
    } catch (requestError) {
      toast(requestError.response?.data?.message || 'Something went wrong. Please try again.', 'error');
      return false;
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [examResponse, subjectsResponse] = await Promise.all([
        examAPI.get(id),
        subjectAPI.list(id, { page: 1, limit: 100 }),
      ]);
      const nextExam = examResponse.data.data.exam;
      setExam(nextExam);
      setForm({
        name: nextExam.name,
        examDate: dateInputValue(nextExam.examDate),
        dailyStudyHours: String(nextExam.dailyStudyHours),
      });
      const nextSubjects = subjectsResponse.data.data.items;
      const topicResponses = await Promise.all(
        nextSubjects.map((subject) => topicAPI.list(subject.id, { page: 1, limit: 100 })),
      );
      setSubjects(nextSubjects.map((subject, index) => ({
        ...subject,
        topics: topicResponses[index].data.data.items,
      })));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load exam details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const saveExam = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await examAPI.update(id, {
        name: form.name,
        examDate: new Date(`${form.examDate}T00:00:00.000Z`).toISOString(),
        dailyStudyHours: Number(form.dailyStudyHours),
      });
      setExam(response.data.data.exam);
      toast('Exam saved');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update exam');
    } finally {
      setSaving(false);
    }
  };

  const deleteExam = async () => {
    if (!await confirm({ title: 'Delete this exam?', message: 'Its subjects, topics, flashcards, quizzes and study sessions will be deleted too. This cannot be undone.', confirmLabel: 'Delete exam', danger: true })) return;
    if (await attempt(() => examAPI.remove(id))) navigate('/subjects');
  };

  const addSubject = async (event) => {
    event.preventDefault();
    if (!subjectName.trim()) return;
    if (await attempt(() => subjectAPI.create(id, { name: subjectName }), 'Subject added')) {
      setSubjectName('');
      await load();
    }
  };

  const removeSubject = async (subjectId) => {
    if (!await confirm({ title: 'Delete this subject?', message: 'Its topics and everything you created for them will be deleted too.', confirmLabel: 'Delete subject', danger: true })) return;
    if (await attempt(() => subjectAPI.remove(subjectId), 'Subject deleted')) await load();
  };

  const addTopic = async (event, subjectId) => {
    event.preventDefault();
    const topicForm = topicForms[subjectId] || { name: '', difficulty: 'AVERAGE' };
    if (!topicForm.name.trim()) return;
    if (await attempt(() => topicAPI.create(subjectId, topicForm), 'Topic added')) {
      setTopicForms({ ...topicForms, [subjectId]: { name: '', difficulty: 'AVERAGE' } });
      await load();
    }
  };

  const updateTopic = async (topic) => {
    if (await attempt(() => topicAPI.update(topic.id, { name: topic.name, difficulty: topic.difficulty }), 'Topic saved')) await load();
  };

  const removeTopic = async (topicId) => {
    if (!await confirm({ title: 'Delete this topic?', message: 'Its flashcards, quiz results and study sessions will be deleted too.', confirmLabel: 'Delete topic', danger: true })) return;
    if (await attempt(() => topicAPI.remove(topicId), 'Topic deleted')) await load();
  };

  if (loading) return <LoadingSpinner />;
  if (!exam) return <Alert onRetry={load}>{error || 'Exam not found'}</Alert>;

  return (
    <div>
      <Link to="/subjects" className="lynx-link">← All subjects</Link>
      <div className="lynx-hero lynx-detail-hero">
        <div><p className="lynx-eyebrow">Exam details</p><h1 className="lynx-h1">{exam.name}</h1><p className="lynx-muted lynx-sub">Manage your subjects and topics.</p></div>
        <button type="button" onClick={deleteExam} className="lynx-btn lynx-btn-danger-ghost">Delete exam</button>
      </div>
      <Alert className="lynx-section-gap">{error}</Alert>
      <div className="lynx-details-grid">
        <Card>
          <h2 className="lynx-h2">Update exam</h2>
          <form onSubmit={saveExam} className="lynx-form lynx-section-gap">
            <input required aria-label="Exam name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="lynx-input" />
            <input required aria-label="Exam date" type="date" value={form.examDate} onChange={(event) => setForm({ ...form, examDate: event.target.value })} className="lynx-input" />
            <input required aria-label="Daily study hours" min="0.25" max="24" step="0.25" type="number" value={form.dailyStudyHours} onChange={(event) => setForm({ ...form, dailyStudyHours: event.target.value })} className="lynx-input" />
            <button disabled={saving} className="lynx-btn lynx-btn-primary lynx-btn-block">{saving ? 'Saving...' : 'Save changes'}</button>
          </form>
        </Card>
        <div className="lynx-stack-tight">
          <Card>
            <h2 className="lynx-h2">Subjects</h2>
            <form onSubmit={addSubject} className="lynx-inline-form"><input required aria-label="New subject name" placeholder="New subject name" value={subjectName} onChange={(event) => setSubjectName(event.target.value)} className="lynx-input lynx-grow" /><button className="lynx-btn lynx-btn-primary">Add</button></form>
          </Card>
          {subjects.length === 0 ? <Card><p className="lynx-muted lynx-sub">No subjects yet. Add your first subject above. Add a topic to unlock its learning hub with materials, flashcards, quizzes, and mind maps.</p></Card> : subjects.map((subject) => {
            const topicForm = topicForms[subject.id] || { name: '', difficulty: 'AVERAGE' };
            return (
              <SubjectCard
                key={subject.id}
                subject={subject}
                topicForm={topicForm}
                onTopicFormChange={(subjectId, next) => setTopicForms({ ...topicForms, [subjectId]: next })}
                onAddTopic={addTopic}
                onTopicFieldChange={(subjectId, topicId, patch) => setSubjects(subjects.map((item) => item.id === subjectId ? { ...item, topics: item.topics.map((t) => t.id === topicId ? { ...t, ...patch } : t) } : item))}
                onUpdateTopic={updateTopic}
                onRemoveTopic={removeTopic}
                onRemoveSubject={removeSubject}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}