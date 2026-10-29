import { useState } from 'react';
import { usePomodoro } from '../context/PomodoroContext.jsx';
import useTopicOptions from '../hooks/useTopicOptions.js';

const PHASE_LABEL = { focus: 'Focus', break: 'Break' };

/** Idle: a small Focus button that opens a topic picker. */
function IdleWidget({ onStart }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="lynx-pomo-fab" aria-label="Start a focus timer">▶ Focus</button>;
  }
  return <TopicPicker onStart={onStart} onClose={() => setOpen(false)} />;
}

/** Mounted only while open, so it loads a fresh topic list each time. */
function TopicPicker({ onStart, onClose }) {
  const [topicId, setTopicId] = useState('');
  const { topics, loading } = useTopicOptions();

  const start = (event) => {
    event.preventDefault();
    const topic = topics.find((item) => String(item.id) === topicId);
    if (topic) onStart({ id: topic.id, name: topic.name });
    onClose();
  };

  return (
    <form onSubmit={start} className="lynx-pomo lynx-pomo-picker">
      <div className="lynx-row-between">
        <strong>Start focus</strong>
        <button type="button" onClick={onClose} className="lynx-pomo-icon" aria-label="Close">✕</button>
      </div>
      {topics.length ? (
        <>
          <select required value={topicId} onChange={(event) => setTopicId(event.target.value)} className="lynx-input" aria-label="Topic to focus on">
            <option value="">Choose a topic</option>
            {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.label}</option>)}
          </select>
          <button className="lynx-btn lynx-btn-primary lynx-btn-sm lynx-btn-block">Start</button>
        </>
      ) : <p className="lynx-muted lynx-caption">{loading ? 'Loading topics…' : 'Add a topic in Subjects first.'}</p>}
    </form>
  );
}

/** A floating Pomodoro timer shown on every signed-in page. */
export default function PomodoroWidget() {
  const pomodoro = usePomodoro();
  const [minimized, setMinimized] = useState(false);

  if (pomodoro.phase === 'idle') return <IdleWidget onStart={pomodoro.start} />;

  const label = PHASE_LABEL[pomodoro.phase];
  const progress = pomodoro.durationMs ? 100 - (pomodoro.remaining / pomodoro.durationMs) * 100 : 0;

  if (minimized) {
    return (
      <button type="button" onClick={() => setMinimized(false)} className={`lynx-pomo-fab is-${pomodoro.phase}`} aria-label={`${label} timer, ${pomodoro.clock} left. Expand`}>
        {pomodoro.clock}
      </button>
    );
  }

  return (
    <section className={`lynx-pomo is-${pomodoro.phase}`} aria-label="Pomodoro timer">
      <div className="lynx-row-between">
        <span className="lynx-pomo-phase">{label}{pomodoro.paused ? ' · paused' : ''}</span>
        <button type="button" onClick={() => setMinimized(true)} className="lynx-pomo-icon" aria-label="Minimize timer">–</button>
      </div>
      <div className="lynx-pomo-clock" role="timer" aria-live="off">{pomodoro.clock}</div>
      <div className="lynx-pomo-bar" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
      <p className="lynx-pomo-topic">{pomodoro.phase === 'focus' ? pomodoro.topicName : 'Step away from the screen'}</p>
      <div className="lynx-pomo-actions">
        <button type="button" onClick={pomodoro.paused ? pomodoro.resume : pomodoro.pause} className="lynx-btn lynx-btn-ghost lynx-btn-sm">{pomodoro.paused ? 'Resume' : 'Pause'}</button>
        <button type="button" onClick={pomodoro.stop} className="lynx-btn lynx-btn-ghost lynx-btn-sm">{pomodoro.phase === 'break' ? 'End break' : 'Stop'}</button>
      </div>
    </section>
  );
}
