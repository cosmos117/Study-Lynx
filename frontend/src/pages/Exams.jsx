import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/Card.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import Alert from '../components/Alert.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useFeedback } from '../components/Feedback.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import { examAPI } from '../services/api.js';

const initialForm = { name: '', examDate: '', dailyStudyHours: '2' };

export default function Exams() {
  usePageTitle('Subjects');
  const { toast } = useFeedback();
  const [exams, setExams] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadExams = () => {
    setLoading(true);
    examAPI.list({ page: 1, limit: 100 })
      .then(({ data }) => setExams(data.data.items))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load exams'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadExams();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await examAPI.create({
        name: form.name,
        examDate: new Date(`${form.examDate}T00:00:00.000Z`).toISOString(),
        dailyStudyHours: Number(form.dailyStudyHours),
      });
      setForm(initialForm);
      toast('Exam created. Add subjects and topics next.');
      loadExams();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create exam');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="lynx-section-head">
        <p className="lynx-eyebrow">Planning & subjects</p>
        <h1 className="lynx-h1">Your subjects</h1>
        <p className="lynx-muted lynx-sub">Organize exams, subjects, and topics into focused learning paths.</p>
      </div>
      <div className="lynx-exams-grid">
        <Card>
          <div className="lynx-section-head"><h2 className="lynx-h2">Add an exam</h2><p className="lynx-muted lynx-sub">Start with the essentials.</p></div>
          <form onSubmit={submit} className="lynx-form">
            <input required aria-label="Exam name" placeholder="Exam name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="lynx-input" />
            <input required aria-label="Exam date" type="date" value={form.examDate} onChange={(event) => setForm({ ...form, examDate: event.target.value })} className="lynx-input" />
            <input required aria-label="Daily study hours" min="0.25" max="24" step="0.25" type="number" placeholder="Daily study hours" value={form.dailyStudyHours} onChange={(event) => setForm({ ...form, dailyStudyHours: event.target.value })} className="lynx-input" />
            <Alert>{error}</Alert>
            <button disabled={submitting} className="lynx-btn lynx-btn-primary lynx-btn-block">{submitting ? 'Saving...' : 'Create exam'}</button>
          </form>
        </Card>
        <Card>
          <div className="lynx-row-between"><h2 className="lynx-h2">Upcoming exams</h2><span className="lynx-muted lynx-caption">{exams.length} total</span></div>
          {loading ? <LoadingSpinner /> : exams.length === 0 ? <EmptyState title="No exams yet" description="Create your first exam on the left. Each exam holds subjects, and each subject holds the topics you will study." /> : <div className="lynx-stack">{exams.map((exam) => <Link key={exam.id} to={`/exams/${exam.id}`} className="lynx-card lynx-card-hover lynx-exam-link"><div className="lynx-row-between"><div><h3 className="lynx-card-title">{exam.name}</h3><p className="lynx-muted lynx-sub">{new Date(exam.examDate).toLocaleDateString()}</p></div><span className="lynx-pill lynx-primary-pill">{exam.dailyStudyHours} h/day</span></div><p className="lynx-muted lynx-caption lynx-card-meta">{exam._count.subjects} subjects · Open details</p></Link>)}</div>}
        </Card>
      </div>
    </div>
  );
}
