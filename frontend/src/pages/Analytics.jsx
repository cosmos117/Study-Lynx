import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import MasteryMeter from '../components/MasteryMeter.jsx';
import PageHeader from '../components/PageHeader.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import { insightsAPI } from '../services/api.js';
import { formatDate, formatMinutes, orDash } from '../utils/format.js';

const RANGES = [7, 14, 30];
const dayLabel = (key) => new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });

/** Simple bar chart. The same numbers are in the table below it, so nothing depends on seeing the bars. */
function BarChart({ series, field, alt, label }) {
  const max = Math.max(1, ...series.map((day) => day[field]));
  const every = Math.ceil(series.length / 7);
  return (
    <figure className="lynx-figure">
      <div className="lynx-chart" role="img" aria-label={label}>
        {series.map((day) => (
          <div key={day.date} className="lynx-chart-col" title={`${dayLabel(day.date)}: ${day[field]}`}>
            <div className={`lynx-chart-bar ${alt ? 'lynx-chart-bar-alt' : ''}`} style={{ height: `${(day[field] / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="lynx-chart-labels" aria-hidden="true">
        {series.map((day, index) => <span key={day.date}>{index % every === 0 ? dayLabel(day.date) : ''}</span>)}
      </div>
    </figure>
  );
}

export default function Analytics() {
  usePageTitle('Analytics');
  const [days, setDays] = useState(14);
  const [analytics, setAnalytics] = useState(null);
  const [topics, setTopics] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    Promise.all([insightsAPI.analytics(days), insightsAPI.overview()])
      .then(([analyticsResponse, overviewResponse]) => {
        setAnalytics(analyticsResponse.data.data);
        setTopics(overviewResponse.data.data.topics);
      })
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load analytics'));
  }, [days]);
  useEffect(load, [load]);

  if (error && !analytics) return <Alert onRetry={load}>{error}</Alert>;
  if (!analytics || !topics) return <LoadingSpinner />;

  const { totals, series, quizTrend } = analytics;
  const hasActivity = totals.activeDays > 0 || quizTrend.length > 0;

  return (
    <div>
      <PageHeader
        eyebrow="Progress"
        title="Analytics"
        description="See the momentum behind your learning."
        actions={(
          <label className="lynx-label lynx-inline-label">
            Period
            <select value={days} onChange={(event) => setDays(Number(event.target.value))} className="lynx-input">
              {RANGES.map((range) => <option key={range} value={range}>Last {range} days</option>)}
            </select>
          </label>
        )}
      />
      <div className="lynx-grid-3 lynx-grid-4">
        <StatCard label="Study time" value={formatMinutes(totals.studyMinutes)} detail={`Last ${days} days`} icon="◷" />
        <StatCard label="Active days" value={`${totals.activeDays} / ${days}`} detail="Days with study or recall" tone="amber" icon="↻" />
        <StatCard label="Cards reviewed" value={totals.cardsReviewed} detail="Flashcard reviews" icon="▤" />
        <StatCard label="Recall rate" value={orDash(totals.recallRate)} detail="Rated Good or Easy" tone="success" icon="✓" />
      </div>

      {!hasActivity && (
        <Card className="lynx-section-gap">
          <EmptyState title="No activity in this period yet" description="Finish a study session, review flashcards or take a quiz and your charts will fill in." action={<Link to="/dashboard" className="lynx-btn lynx-btn-primary lynx-btn-sm">See what to study</Link>} />
        </Card>
      )}

      {hasActivity && (
        <div className="lynx-dashboard-grid lynx-section-gap">
          <section>
            <SectionHeader title="Study time per day" description="Minutes from completed sessions." />
            <Card><BarChart series={series} field="studyMinutes" label={`Study minutes per day over the last ${days} days, ${formatMinutes(totals.studyMinutes)} in total`} /></Card>
          </section>
          <section>
            <SectionHeader title="Cards reviewed per day" description="Flashcard reviews in Active Recall." />
            <Card><BarChart series={series} field="cardsReviewed" alt label={`Cards reviewed per day over the last ${days} days, ${totals.cardsReviewed} in total`} /></Card>
          </section>
        </div>
      )}

      <section className="lynx-section-gap">
        <SectionHeader title="Recent quizzes" description="Your last ten attempts, oldest first." />
        <Card>
          {quizTrend.length ? (
            <ol className="lynx-list">
              {quizTrend.map((quiz) => (
                <li key={`${quiz.attemptedAt}-${quiz.topic.id}`}>
                  <MasteryMeter mastery={{ score: quiz.percent, level: quiz.percent < 50 ? 'WEAK' : 'AVERAGE' }} label={`${quiz.topic.name} · ${formatDate(quiz.attemptedAt)}`} />
                </li>
              ))}
            </ol>
          ) : <p className="lynx-muted lynx-sub">No quizzes taken yet.</p>}
        </Card>
      </section>

      <section className="lynx-section-gap">
        <SectionHeader title="Mastery by topic" description="How well you know each topic, from quizzes, recall and study time." />
        <Card>
          {topics.length ? (
            <div className="lynx-table-wrap">
              <table className="lynx-table">
                <caption className="sr-only">Mastery, recall, quiz and study time for each topic</caption>
                <thead>
                  <tr><th scope="col">Topic</th><th scope="col">Mastery</th><th scope="col">Recall</th><th scope="col">Quiz</th><th scope="col">Study time</th><th scope="col">Due</th></tr>
                </thead>
                <tbody>
                  {[...topics].sort((a, b) => (a.mastery.score ?? -1) - (b.mastery.score ?? -1)).map((topic) => (
                    <tr key={topic.id}>
                      <th scope="row"><Link to={`/topics/${topic.id}?tab=Progress`} className="lynx-plain-link">{topic.name}</Link><span className="lynx-muted lynx-caption"> {topic.subject.name}</span></th>
                      <td><MasteryMeter mastery={topic.mastery} label="" /></td>
                      <td>{orDash(topic.recallRate)}</td>
                      <td>{orDash(topic.quiz.averagePercent)}</td>
                      <td>{formatMinutes(topic.studyMinutes)}</td>
                      <td>{topic.cardsDue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title="No topics yet" description="Add an exam and topics to see mastery here." action={<Link to="/subjects" className="lynx-btn lynx-btn-primary lynx-btn-sm">Go to Subjects</Link>} />}
        </Card>
      </section>
    </div>
  );
}
