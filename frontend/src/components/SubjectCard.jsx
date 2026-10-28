import { Link } from 'react-router-dom';
import Card from './Card.jsx';
import { DifficultyBadge } from './LynxBadges.jsx';
import { difficultyColor } from '../theme/tokens.js';

export default function SubjectCard({
  subject, topicForm, onTopicFormChange, onAddTopic,
  onTopicFieldChange, onUpdateTopic, onRemoveTopic, onRemoveSubject,
}) {
  return (
    <Card>
      <div className="lynx-row-between">
        <h3 className="lynx-h2">{subject.name}</h3>
        <button type="button" onClick={() => onRemoveSubject(subject.id)} className="lynx-link-btn" aria-label={`Delete subject ${subject.name}`}>
          Delete
        </button>
      </div>
      <form onSubmit={(event) => onAddTopic(event, subject.id)} className="lynx-inline-form lynx-topic-form">
        <input
          required
          aria-label={`New topic in ${subject.name}`}
          placeholder="New topic"
          value={topicForm.name}
          onChange={(event) => onTopicFormChange(subject.id, { ...topicForm, name: event.target.value })}
          className="lynx-input lynx-grow"
        />
        <select
          aria-label="Difficulty of the new topic"
          value={topicForm.difficulty}
          onChange={(event) => onTopicFormChange(subject.id, { ...topicForm, difficulty: event.target.value })}
          className="lynx-input lynx-auto"
        >
          <option>WEAK</option>
          <option>AVERAGE</option>
          <option>STRONG</option>
        </select>
        <button className="lynx-btn lynx-btn-primary lynx-btn-sm">Add topic</button>
      </form>
      <div className="lynx-stack">
        {subject.topics.length === 0 ? (
          <p className="lynx-muted">No topics yet.</p>
        ) : (
          subject.topics.map((topic) => (
            <div key={topic.id} className="lynx-card lynx-topic-row">
              <span className="lynx-dot" style={{ background: difficultyColor(topic.difficulty) }} aria-hidden="true" />
              <input
                aria-label={`Name of ${topic.name}`}
                value={topic.name}
                onChange={(event) => onTopicFieldChange(subject.id, topic.id, { name: event.target.value })}
                className="lynx-input lynx-grow lynx-input-sm"
              />
              <select
                aria-label={`Difficulty of ${topic.name}`}
                value={topic.difficulty}
                onChange={(event) => onTopicFieldChange(subject.id, topic.id, { difficulty: event.target.value })}
                className="lynx-input lynx-auto lynx-input-sm"
              >
                <option>WEAK</option>
                <option>AVERAGE</option>
                <option>STRONG</option>
              </select>
              <DifficultyBadge level={topic.difficulty} />
              <Link to={`/topics/${topic.id}`} className="lynx-btn lynx-btn-primary lynx-btn-sm" aria-label={`Open ${topic.name}`}>Open</Link>
              <button type="button" onClick={() => onUpdateTopic(topic)} className="lynx-btn lynx-btn-ghost lynx-btn-sm" aria-label={`Save ${topic.name}`}>Save</button>
              <button type="button" onClick={() => onRemoveTopic(topic.id)} className="lynx-link-btn" aria-label={`Delete topic ${topic.name}`}>Delete</button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
