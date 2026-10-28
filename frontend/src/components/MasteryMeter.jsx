import ProgressBar from './ProgressBar.jsx';

const TONES = { WEAK: 'danger', AVERAGE: 'warn', STRONG: 'success' };

/** "How well do I know it?" for one topic, or an honest note when there is no data yet. */
export default function MasteryMeter({ mastery, label = 'Mastery' }) {
  if (!mastery || mastery.score === null) {
    return <p className="lynx-muted lynx-caption">{label}: not enough data yet</p>;
  }
  return <ProgressBar value={mastery.score} label={label} tone={TONES[mastery.level] || 'primary'} />;
}
