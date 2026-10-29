import { useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../Alert.jsx';
import Card from '../Card.jsx';
import EmptyState from '../EmptyState.jsx';
import { useFeedback } from '../Feedback.jsx';
import { resourceAPI } from '../../services/api.js';
import { errorMessage } from '../../utils/aiErrors.js';
import { indexVideoTranscript } from '../../utils/materials.js';
import { formatTimestamp } from '../../utils/youtube.js';

/** The topic's YouTube videos, each opened in the distraction-free player. */
export default function WatchTab({ topicId, hub, reload }) {
  const { confirm, toast } = useFeedback();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const videos = hub.learn.videos;
  const indexedUrls = new Set(hub.learn.documents.map((document) => document.sourceUrl).filter(Boolean));

  const add = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await resourceAPI.addYoutube({ topicId: Number(topicId), url });
      setUrl('');
      toast('Video added');
      await reload();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Unable to add this video'));
    } finally {
      setBusy(false);
    }
  };

  // A transcript becomes a source, so Ask AI, flashcards and quizzes can use what the video says.
  const addTranscript = async (video) => {
    setBusy(true);
    setError('');
    try {
      const { data } = await resourceAPI.get(video.id);
      await indexVideoTranscript(data.data.resource, Number(topicId));
      toast('Transcript added to your sources');
      await reload();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Unable to use this transcript'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (video) => {
    if (!await confirm({ title: `Remove "${video.title}"?`, message: 'The video is removed from this topic.', confirmLabel: 'Remove', danger: true })) return;
    try {
      await resourceAPI.remove(video.id);
      await reload();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Unable to remove this video'));
    }
  };

  return (
    <div className="lynx-stack-tight">
      <Card>
        <form onSubmit={add} className="lynx-inline-form">
          <input required aria-label="YouTube video URL" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Paste a YouTube link" className="lynx-input lynx-grow" />
          <button disabled={busy} className="lynx-btn lynx-btn-primary">{busy ? 'Adding…' : 'Add video'}</button>
        </form>
        <p className="lynx-muted lynx-caption lynx-section-gap">Videos play without recommendations, comments or autoplay, next to a notes panel.</p>
      </Card>
      <Alert>{error}</Alert>
      {videos.length ? (
        <div className="lynx-stack">
          {videos.map((video) => (
            <Card key={video.id} className="lynx-resource-row">
              <div className="lynx-grow lynx-watch-info">
                <h3 className="lynx-h3">{video.title}</h3>
                <div className="lynx-watch-progress">
                  <div className="lynx-progress-track" role="progressbar" aria-valuenow={video.watchedPercent} aria-valuemin={0} aria-valuemax={100} aria-label={`${video.title}: ${video.watchedPercent}% watched`}>
                    <span className={`lynx-progress-fill ${video.completed ? 'lynx-progress-success' : 'lynx-progress-primary'}`} style={{ width: `${video.watchedPercent}%` }} />
                  </div>
                  <span className="lynx-muted lynx-caption">{video.completed ? `Watched · ${video.watchedPercent}%` : video.watchedPercent ? `${video.watchedPercent}% watched${video.positionSeconds ? ` · resume at ${formatTimestamp(video.positionSeconds)}` : ''}` : 'Not started'}</span>
                </div>
              </div>
              <div className="lynx-resource-actions">
                {video.hasTranscript && !indexedUrls.has(video.url) && (
                  <button type="button" disabled={busy} onClick={() => addTranscript(video)} className="lynx-btn lynx-btn-ghost lynx-btn-sm">Use in Ask AI</button>
                )}
                <Link to={`/learn/youtube/${video.id}`} className="lynx-btn lynx-btn-primary lynx-btn-sm">{video.positionSeconds && !video.completed ? 'Resume' : 'Watch'}</Link>
                <button type="button" onClick={() => remove(video)} className="lynx-link-btn">Remove</button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card><EmptyState icon="▶" title="No videos yet" description="Add a lecture or tutorial and watch it here without distractions." /></Card>
      )}
    </div>
  );
}
