/** Choose which of a topic's materials AI generation should be based on. */
export default function SourcePicker({ sources, excluded, onToggle }) {
  if (!sources.length) {
    return <p className="lynx-muted lynx-caption">No materials on this topic yet, so AI will generate from the topic name only.</p>;
  }
  const picked = sources.filter((source) => !excluded.has(source.key)).length;
  return (
    <div className="lynx-tutor-sources">
      <div className="lynx-row-between">
        <strong>Generate from</strong>
        <span className="lynx-muted lynx-caption">{picked} of {sources.length} selected</span>
      </div>
      {sources.map((source) => (
        <label key={source.key} className="lynx-source-row">
          <input type="checkbox" checked={!excluded.has(source.key)} onChange={() => onToggle(source.key)} />
          {source.label}
          <span className="lynx-muted lynx-caption">{source.kind}</span>
        </label>
      ))}
    </div>
  );
}
