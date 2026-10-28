const STEPS = [
  ['PLAN', 'Plan'],
  ['LEARN', 'Learn'],
  ['RECALL', 'Recall'],
  ['QUIZ', 'Quiz'],
  ['ANALYZE', 'Analyze'],
  ['REVISE', 'Revise'],
];

/** Shows where the student is in the plan → learn → recall → quiz → analyze → revise loop. */
export default function LoopTracker({ stage }) {
  return (
    <ol className="lynx-loop" aria-label="Learning loop">
      {STEPS.map(([key, label]) => (
        <li key={key} className={`lynx-loop-step ${key === stage ? 'lynx-loop-active' : ''}`} aria-current={key === stage ? 'step' : undefined}>{label}</li>
      ))}
    </ol>
  );
}
