import { useState } from 'react';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * A small month calendar. Highlights today and marks days that have an event.
 * `events` is a list of { date, label }; `date` is anything `new Date()` accepts.
 */
export default function MiniCalendar({ events = [] }) {
  const today = new Date();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const labelsByDay = new Map();
  for (const event of events) {
    const key = dateKey(new Date(event.date));
    labelsByDay.set(key, [...(labelsByDay.get(key) || []), event.label]);
  }

  const first = new Date(view.year, view.month, 1);
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  const todayKey = dateKey(today);
  const isCurrentMonth = view.year === today.getFullYear() && view.month === today.getMonth();

  const shift = (delta) => {
    const next = new Date(view.year, view.month + delta, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() });
  };

  return (
    <section className="lynx-calendar" aria-label="Calendar">
      <div className="lynx-calendar-head">
        <h2 className="lynx-calendar-title">{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
        <div className="lynx-calendar-nav">
          {!isCurrentMonth && (
            <button type="button" className="lynx-calendar-today" onClick={() => setView({ year: today.getFullYear(), month: today.getMonth() })}>Today</button>
          )}
          <button type="button" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <button type="button" onClick={() => shift(1)} aria-label="Next month">›</button>
        </div>
      </div>
      <div className="lynx-calendar-grid" role="grid">
        {WEEKDAYS.map((day, index) => <span key={`${day}${index}`} className="lynx-calendar-weekday" role="columnheader">{day}</span>)}
        {cells.map((day, index) => {
          if (day === null) return <span key={`blank${index}`} />;
          const key = dateKey(new Date(view.year, view.month, day));
          const labels = labelsByDay.get(key);
          const classes = ['lynx-calendar-day', key === todayKey ? 'is-today' : '', labels ? 'has-event' : ''].filter(Boolean).join(' ');
          return (
            <span key={key} role="gridcell" className={classes} title={labels?.join(', ')} aria-label={labels ? `${day}, ${labels.join(', ')}` : undefined} aria-current={key === todayKey ? 'date' : undefined}>
              {day}
            </span>
          );
        })}
      </div>
      <p className="lynx-calendar-legend"><i aria-hidden="true" /> Exam day</p>
    </section>
  );
}
