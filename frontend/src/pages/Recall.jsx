import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import PageHeader from '../components/PageHeader.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import Alert from '../components/Alert.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import { recallAPI } from '../services/api.js';
import { errorMessage } from '../utils/aiErrors.js';

export default function Recall() {
  usePageTitle('Active Recall');
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const load = () => { setError(''); recallAPI.summary().then(({ data }) => setSummary(data.data)).catch((requestError) => setError(errorMessage(requestError, 'Unable to load recall dashboard'))); };
  useEffect(load, []);
  if (error) return <Alert onRetry={load}>{error}</Alert>;
  if (!summary) return <LoadingSpinner />;
  const totalDue = summary.dueToday.length + summary.overdue.length;
  return <div>
    <PageHeader eyebrow="Active recall" title="Remember more, one card at a time." description="Review what is due, then keep moving while the answer is fresh." actions={totalDue > 0 && <Link to="/recall/review" className="lynx-btn lynx-btn-primary">Start review <span>→</span></Link>} />
    <div className="lynx-grid-3">
      <StatCard label="Due today" value={summary.dueToday.length} detail="Cards scheduled for today" icon="◷" />
      <StatCard label="Overdue" value={summary.overdue.length} detail="Cards waiting for you" tone="amber" icon="!" />
      <StatCard label="Reviewed today" value={summary.reviewedToday} detail={`${summary.streak} day recall streak`} tone="success" icon="✓" />
    </div>
    <div className="lynx-dashboard-grid lynx-section-gap">
      <section><SectionHeader title="Topics requiring recall" description="Start with the topics that have cards waiting." />{summary.topics.length ? <div className="lynx-stack">{summary.topics.map((topic) => <Card key={topic.id} className="lynx-recall-topic"><div><h3 className="lynx-h3">{topic.name}</h3><p className="lynx-muted lynx-caption">{topic.subject.name} · {topic.cardsDue} card{topic.cardsDue === 1 ? '' : 's'} due</p></div><Link to={`/recall/review?topicId=${topic.id}`} className="lynx-text-link">Review →</Link></Card>)}</div> : <Card><EmptyState title="You are all caught up" description="Generate flashcards from a topic to build your recall queue." action={<Link to="/subjects" className="lynx-btn lynx-btn-ghost lynx-btn-sm">Find a topic</Link>} /></Card>}</section>
      <Card><SectionHeader title="Recall snapshot" description="Based on your review history." /><div className="lynx-recall-stat"><strong>{summary.stats.remembered}%</strong><span className="lynx-muted">remembered on rated reviews</span></div><div className="lynx-recall-stat"><strong>{summary.stats.difficultCards}</strong><span className="lynx-muted">difficult ratings</span></div>{totalDue > 0 ? <Link to="/recall/review" className="lynx-btn lynx-btn-primary lynx-btn-block">Start {totalDue} card{totalDue === 1 ? '' : 's'}</Link> : <p className="lynx-muted lynx-sub">Your next review will appear here.</p>}</Card>
    </div>
  </div>;
}
