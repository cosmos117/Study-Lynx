export default function ProgressBar({ value = 0, label, tone = 'primary' }) {
  const progress = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div className="lynx-progress-wrap">
      {(label || progress > 0) && <div className="lynx-progress-label"><span>{label}</span><strong>{Math.round(progress)}%</strong></div>}
      <div className="lynx-progress-track"><span className={`lynx-progress-fill lynx-progress-${tone}`} style={{ width: `${progress}%` }} /></div>
    </div>
  );
}
