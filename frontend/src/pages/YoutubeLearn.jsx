import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import Card from '../components/Card.jsx';
import { useFeedback } from '../components/Feedback.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import useWatchProgress from '../hooks/useWatchProgress.js';
import { notesAPI, resourceAPI } from '../services/api.js';
import { errorMessage } from '../utils/aiErrors.js';
import { formatTimestamp } from '../utils/youtube.js';

export default function YoutubeLearn() {
  const { resourceId } = useParams();
  const { toast } = useFeedback();
  const [resource, setResource] = useState(null);
  const [notes, setNotes] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savedProgress = useRef(false);
  const player = useRef(null);
  // Fixed when the page opens: changing the embed's start time later would reload the video.
  const startAt = useRef(null);
  usePageTitle(resource?.title || 'Video');

  useEffect(() => {
    resourceAPI.get(resourceId)
      .then(({ data }) => setResource(data.data.resource))
      .catch((requestError) => setError(errorMessage(requestError, 'Unable to open this resource')));
  }, [resourceId]);

  // Keep the furthest point reached; the server never lowers it, so saves can't race backwards.
  const { percent: watched, position, duration, seekTo } = useWatchProgress(resource, player, (saved) => setResource((current) => ({ ...current, ...saved })));

  const markStarted = async () => {
    if (savedProgress.current || !resource) return;
    savedProgress.current = true;
    try {
      const response = await resourceAPI.progress(resource.id, { watchedPercent: resource.watchedPercent || 1 });
      setResource(response.data.data.resource);
    } catch {
      savedProgress.current = false; // progress is a nicety; watching still works
    }
  };

  const complete = async () => {
    try {
      const response = await resourceAPI.progress(resource.id, { watchedPercent: 100, completed: true });
      setResource(response.data.data.resource);
      toast('Marked as watched. Create flashcards or a quiz to remember it.');
    } catch (requestError) {
      toast(errorMessage(requestError, 'Unable to save your progress'), 'error');
    }
  };

  // Adds to (never replaces) the topic note, so notes taken here live with the rest of the topic.
  const saveNotes = async () => {
    if (!notes.trim()) return;
    setSaving(true);
    try {
      const existing = (await notesAPI.get(resource.topic.id)).data.data.note?.content;
      const heading = `From video: ${resource.title}`;
      await notesAPI.save(resource.topic.id, { content: [existing, `${heading}\n${notes.trim()}`].filter(Boolean).join('\n\n') });
      setNotes('');
      toast('Added to your topic notes');
    } catch (requestError) {
      toast(errorMessage(requestError, 'Unable to save your notes'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (error) return <div className="lynx-youtube-focus"><Alert>{error}</Alert><Link to="/subjects" className="lynx-btn lynx-btn-ghost">Back to subjects</Link></div>;
  if (!resource) return <div className="lynx-youtube-focus"><LoadingSpinner /></div>;

  const topicPage = `/topics/${resource.topic.id}`;
  const shownPercent = Math.max(watched, resource.watchedPercent || 0);
  if (startAt.current === null) startAt.current = resource.positionSeconds || 0;
  const startParam = startAt.current > 0 ? `&start=${startAt.current}` : '';
  const transcript = resource.transcript || '';
  const filtered = query ? transcript.split(/\n+/).filter((line) => line.toLowerCase().includes(query.toLowerCase())).join('\n') : transcript;

  return (
    <div className="lynx-youtube-focus">
      <header className="lynx-youtube-top">
        <Link to={`${topicPage}?tab=watch`} className="lynx-logo-link">← {resource.topic.name}</Link>
        <span className="lynx-pill">Focused learning</span>
      </header>
      <div className="lynx-youtube-layout">
        <main>
          <div className="lynx-youtube-player">
            {!resource.youtubeVideoId ? (
              <Alert>This video link could not be read. Remove it and add the YouTube link again.</Alert>
            ) : (
            <iframe
              ref={player}
              title={resource.title}
              src={`https://www.youtube-nocookie.com/embed/${resource.youtubeVideoId}?rel=0&modestbranding=1&enablejsapi=1${startParam}&origin=${encodeURIComponent(window.location.origin)}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              onLoad={markStarted}
            />
            )}
          </div>
          <div className="lynx-youtube-heading">
            <div>
              <p className="lynx-eyebrow">YouTube learning resource</p>
              <h1 className="lynx-h1">{resource.title}</h1>
              <p className="lynx-muted lynx-sub">{resource.topic.subject.name} · {resource.topic.name} · {resource.metadata?.authorName || 'YouTube'}</p>
            </div>
            <button type="button" onClick={complete} disabled={Boolean(resource.completedAt)} className="lynx-btn lynx-btn-primary">{resource.completedAt ? 'Watched' : 'Mark as watched'}</button>
          </div>
          <div className="lynx-seek">
            <div className="lynx-row-between">
              <span className="lynx-muted lynx-caption">
                {resource.completedAt ? 'Watched' : `${shownPercent}% watched`}
                {duration > 0 ? ` · at ${formatTimestamp(position)} of ${formatTimestamp(duration)}` : startAt.current > 0 ? ` · resuming from ${formatTimestamp(startAt.current)}` : ''}
              </span>
              <strong className="lynx-caption">{shownPercent}%</strong>
            </div>
            <input
              type="range"
              className="lynx-seek-track"
              min={0}
              max={Math.max(1, Math.floor(duration))}
              step={1}
              value={Math.min(position, Math.floor(duration) || position)}
              disabled={!duration}
              onChange={(event) => seekTo(Number(event.target.value) / duration)}
              style={{ '--watched': `${shownPercent}%` }}
              aria-label="Jump to a point in the video"
              aria-valuetext={`${formatTimestamp(position)} of ${formatTimestamp(duration)}, ${shownPercent}% watched`}
            />
            <p className="lynx-muted lynx-caption">The shaded part is what you've watched. Click or drag the bar to jump to any point.</p>
          </div>
        </main>
        <aside className="lynx-youtube-sidebar">
          <Card>
            <p className="lynx-eyebrow">Take notes while you watch</p>
            <textarea aria-label="Notes about this video" value={notes} onChange={(event) => setNotes(event.target.value)} className="lynx-input lynx-youtube-notes" rows="7" placeholder="Write what you want to remember..." />
            <button type="button" onClick={saveNotes} disabled={saving || !notes.trim()} className="lynx-btn lynx-btn-ghost lynx-btn-block lynx-section-gap">{saving ? 'Saving…' : 'Add to topic notes'}</button>
            <div className="lynx-stack">
              <Link to={`${topicPage}?tab=flashcards`} className="lynx-btn lynx-btn-ghost lynx-btn-block">Create flashcards</Link>
              <Link to={`${topicPage}?tab=quiz`} className="lynx-btn lynx-btn-ghost lynx-btn-block">Create a quiz</Link>
              <Link to={`${topicPage}?tab=ask`} className="lynx-btn lynx-btn-primary lynx-btn-block">Ask AI about this topic</Link>
            </div>
          </Card>
          <Card>
            <div className="lynx-row-between">
              <h2 className="lynx-h2">Transcript</h2>
              <span className="lynx-muted lynx-caption">{transcript ? 'Available' : 'Not available'}</span>
            </div>
            {transcript ? (
              <>
                <input aria-label="Search transcript" value={query} onChange={(event) => setQuery(event.target.value)} className="lynx-input lynx-section-gap" placeholder="Search transcript" />
                <div className="lynx-transcript" tabIndex={0} aria-label="Transcript text">{filtered || 'No matching lines.'}</div>
              </>
            ) : (
              <p className="lynx-muted lynx-sub">No transcript is saved for this video. Paste one as text in the topic's Sources tab to use it for Ask AI, flashcards and quizzes.</p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
