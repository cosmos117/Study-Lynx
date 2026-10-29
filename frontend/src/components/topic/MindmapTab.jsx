import { useCallback, useEffect, useState } from 'react';
import Alert from '../Alert.jsx';
import Card from '../Card.jsx';
import EmptyState from '../EmptyState.jsx';
import LoadingSpinner from '../LoadingSpinner.jsx';
import MindmapView from './MindmapView.jsx';
import useGenerate from '../../hooks/useGenerate.js';
import { mindmapAPI } from '../../services/api.js';
import { errorMessage } from '../../utils/aiErrors.js';

/** A visual map of the topic, built from its sources. */
export default function MindmapTab({ topicId, sourceBody }) {
  const [mindmap, setMindmap] = useState(undefined);
  const [error, setError] = useState('');
  const { running, run } = useGenerate();

  const load = useCallback(async () => {
    try {
      setMindmap((await mindmapAPI.get(topicId)).data.data.mindmap);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Unable to load the mind map'));
      setMindmap(null);
    }
  }, [topicId]);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setError('');
    try {
      await run(() => mindmapAPI.generate(topicId, { ...sourceBody, regenerate: Boolean(mindmap) }));
      await load();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  if (mindmap === undefined) return <LoadingSpinner />;

  return (
    <div className="lynx-stack-tight">
      <Card className="lynx-row-between lynx-topic-toolbar">
        <div>
          <h2 className="lynx-h2">Mind map</h2>
          <p className="lynx-muted lynx-caption">See how the ideas in this topic connect.</p>
        </div>
        <button type="button" disabled={running} onClick={generate} className={`lynx-btn ${mindmap ? 'lynx-btn-ghost' : 'lynx-btn-primary'}`}>
          {running ? 'Generating…' : mindmap ? 'Rebuild' : 'Generate mind map'}
        </button>
      </Card>
      <Alert>{error}</Alert>
      <Card className="lynx-study-card">
        {mindmap ? <MindmapView content={mindmap} /> : <EmptyState title="No mind map yet" description="Generate one to see the topic at a glance." />}
      </Card>
    </div>
  );
}
