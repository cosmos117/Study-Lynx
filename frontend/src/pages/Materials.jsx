import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { LynxBadge } from '../components/LynxBadges.jsx';
import useTopicOptions from '../hooks/useTopicOptions.js';
import Alert from '../components/Alert.jsx';
import { useFeedback } from '../components/Feedback.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import { documentAPI, resourceAPI } from '../services/api.js';
import { NIGHT_LYNX } from '../theme/tokens.js';
import { indexVideoTranscript } from '../utils/materials.js';

const MAX_UPLOAD_MB = 10;
const POLL_MS = 2000;
const STATUS = {
  READY: ['Ready', NIGHT_LYNX.status.completed],
  PROCESSING: ['Processing', NIGHT_LYNX.status.planned],
  UPLOADING: ['Uploading', NIGHT_LYNX.status.planned],
  FAILED: ['Failed', NIGHT_LYNX.status.overdue],
};
const TYPE_LABEL = { PDF: 'PDF', NOTE: 'Note', YOUTUBE: 'YouTube transcript' };
const isBusy = (document) => document.status === 'PROCESSING' || document.status === 'UPLOADING';
const errorText = (error, fallback) => error.response?.data?.message || fallback;

function TopicSelect({ topics, value, onChange, placeholder = 'No topic' }) {
  return (
    <select value={value ?? ''} onChange={(event) => onChange(event.target.value)} className="lynx-input" aria-label="Topic">
      <option value="">{placeholder}</option>
      {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.label}</option>)}
    </select>
  );
}

function UploadCard({ topics, onDone, onError, onSuccess }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [topicId, setTopicId] = useState('');
  const [busy, setBusy] = useState(false);

  const choose = (event) => {
    const chosen = event.target.files?.[0] || null;
    if (chosen && chosen.size > MAX_UPLOAD_MB * 1024 * 1024) {
      onError(`That file is larger than ${MAX_UPLOAD_MB} MB.`);
      event.target.value = '';
      return;
    }
    setFile(chosen);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    if (name.trim()) body.append('name', name.trim());
    if (topicId) body.append('topicId', topicId);
    setBusy(true);
    onError('');
    try {
      await documentAPI.upload(body);
      onSuccess('Upload received. It is being processed and will be ready shortly.');
      setFile(null);
      setName('');
      event.target.reset();
      await onDone();
    } catch (error) {
      onError(errorText(error, 'Unable to upload this file'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <p className="lynx-eyebrow">Upload</p>
      <h2 className="lynx-h2">Add a PDF or text file</h2>
      <form onSubmit={submit} className="lynx-form lynx-section-gap">
        <input required aria-label="PDF or text file" type="file" accept="application/pdf,text/plain,.pdf,.txt" onChange={choose} className="lynx-input" />
        <input aria-label="Display name (optional)" value={name} onChange={(event) => setName(event.target.value)} maxLength={190} placeholder="Display name (optional)" className="lynx-input" />
        <TopicSelect topics={topics} value={topicId} onChange={setTopicId} placeholder="Attach to a topic (optional)" />
        <p className="lynx-muted lynx-caption">PDF or plain text, up to {MAX_UPLOAD_MB} MB. Scanned, image-only PDFs can&apos;t be read.</p>
        <button disabled={busy || !file} className="lynx-btn lynx-btn-primary lynx-btn-block">{busy ? 'Uploading...' : 'Upload'}</button>
      </form>
    </Card>
  );
}

function TextCard({ topics, onDone, onError, onSuccess }) {
  const [form, setForm] = useState({ type: 'NOTE', name: '', text: '', sourceUrl: '', topicId: '' });
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    onError('');
    try {
      await documentAPI.createText({
        type: form.type,
        name: form.name,
        text: form.text,
        ...(form.type === 'YOUTUBE' && form.sourceUrl ? { sourceUrl: form.sourceUrl } : {}),
        ...(form.topicId ? { topicId: Number(form.topicId) } : {}),
      });
      setForm({ ...form, name: '', text: '', sourceUrl: '' });
      onSuccess('Saved. It is being processed and will be searchable shortly.');
      await onDone();
    } catch (error) {
      onError(errorText(error, 'Unable to save this text'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <p className="lynx-eyebrow">Paste text</p>
      <h2 className="lynx-h2">Notes or a YouTube transcript</h2>
      <form onSubmit={submit} className="lynx-form lynx-section-gap">
        <select value={form.type} onChange={set('type')} className="lynx-input" aria-label="Kind of text">
          <option value="NOTE">My notes</option>
          <option value="YOUTUBE">YouTube transcript</option>
        </select>
        <input required aria-label="Name" value={form.name} onChange={set('name')} maxLength={190} placeholder="Name" className="lynx-input" />
        {form.type === 'YOUTUBE' && <input aria-label="Video URL (optional)" type="url" value={form.sourceUrl} onChange={set('sourceUrl')} placeholder="Video URL (optional)" className="lynx-input" />}
        <textarea required aria-label="Text to save" value={form.text} onChange={set('text')} rows="6" placeholder="Paste your text here..." className="lynx-input" />
        <TopicSelect topics={topics} value={form.topicId} onChange={(topicId) => setForm({ ...form, topicId })} placeholder="Attach to a topic (optional)" />
        <button disabled={busy} className="lynx-btn lynx-btn-ghost lynx-btn-block">{busy ? 'Saving...' : 'Save as source'}</button>
      </form>
    </Card>
  );
}

function SourceDetails({ document }) {
  const [chunks, setChunks] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    documentAPI.chunks(document.id)
      .then(({ data }) => setChunks(data.data.chunks))
      .catch((requestError) => setError(errorText(requestError, 'Unable to load source details')));
  }, [document.id]);

  if (error) return <Alert>{error}</Alert>;
  if (!chunks) return <LoadingSpinner />;
  return (
    <div className="lynx-source-details">
      <p className="lynx-muted lynx-caption">
        {document._count.chunks} indexed passage{document._count.chunks === 1 ? '' : 's'}
        {document.pageCount ? ` from ${document.pageCount} page${document.pageCount === 1 ? '' : 's'}` : ''}. AI Tutor cites these by passage number.
        {chunks.length < document._count.chunks ? ` Showing the first ${chunks.length}.` : ''}
      </p>
      {chunks.map((chunk) => (
        <div key={chunk.id} className="lynx-source-chunk">
          <strong className="lynx-caption">Passage {chunk.chunkIndex}{chunk.metadata?.page ? ` · page ${chunk.metadata.page}` : ''}</strong>
          <p>{chunk.content}</p>
        </div>
      ))}
    </div>
  );
}

function DocumentRow({ document, topics, onAttach, onRemove }) {
  const [open, setOpen] = useState(false);
  const [label, color] = STATUS[document.status] || [document.status, NIGHT_LYNX.muted];
  const meta = [
    TYPE_LABEL[document.type],
    document.pageCount ? `${document.pageCount} pages` : null,
    document.status === 'READY' ? `${document._count.chunks} passages` : null,
    document.sizeBytes ? `${Math.max(1, Math.round(document.sizeBytes / 1024))} KB` : null,
  ].filter(Boolean).join(' · ');

  return (
    <Card className="lynx-document-row">
      <div className="lynx-row-between">
        <div>
          <h3 className="lynx-h3">{document.name}</h3>
          <p className="lynx-muted lynx-caption">{meta}</p>
        </div>
        <LynxBadge color={color}>{label}</LynxBadge>
      </div>
      {document.status === 'FAILED' && <Alert>{document.errorMessage || 'Processing failed.'}</Alert>}
      <div className="lynx-inline-form">
        <div className="lynx-grow">
          <TopicSelect topics={topics} value={document.topicId} onChange={(topicId) => onAttach(document, topicId)} />
        </div>
        {document.status === 'READY' && (
          <button type="button" onClick={() => setOpen(!open)} className="lynx-btn lynx-btn-ghost lynx-btn-sm">{open ? 'Hide details' : 'View details'}</button>
        )}
        <button type="button" onClick={() => onRemove(document)} className="lynx-btn lynx-btn-danger-ghost lynx-btn-sm">Delete</button>
      </div>
      {open && <SourceDetails document={document} />}
    </Card>
  );
}

export default function Materials() {
  usePageTitle('Materials');
  const { toast, confirm } = useFeedback();
  const { topics } = useTopicOptions();
  const [documents, setDocuments] = useState(null);
  const [videos, setVideos] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [documentResponse, resourceResponse] = await Promise.all([documentAPI.list(), resourceAPI.list()]);
      setDocuments(documentResponse.data.data.documents);
      setVideos(resourceResponse.data.data.resources);
    } catch (requestError) {
      setError(errorText(requestError, 'Unable to load materials'));
      setDocuments((current) => current || []);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Keep polling while any document is still being processed.
  const processing = documents?.some(isBusy);
  useEffect(() => {
    if (!processing) return undefined;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [processing, load]);

  const attach = async (document, topicId) => {
    setError('');
    try {
      await documentAPI.attach(document.id, topicId);
      toast(topicId ? 'Attached to topic' : 'Removed from topic');
      await load();
    } catch (requestError) {
      setError(errorText(requestError, 'Unable to change the topic'));
    }
  };

  const remove = async (document) => {
    if (!await confirm({ title: `Delete "${document.name}"?`, message: 'AI Tutor and quiz or flashcard generation will no longer use it. This cannot be undone.', confirmLabel: 'Delete', danger: true })) return;
    setError('');
    try {
      await documentAPI.remove(document.id);
      toast('Material deleted');
      await load();
    } catch (requestError) {
      setError(errorText(requestError, 'Unable to delete this material'));
    }
  };

  const indexTranscript = async (video) => {
    setError('');
    try {
      await indexVideoTranscript(video);
      toast('Transcript saved. It will be searchable shortly.');
      await load();
    } catch (requestError) {
      setError(errorText(requestError, 'Unable to index this transcript'));
    }
  };

  if (!documents) return <LoadingSpinner />;
  const indexedUrls = new Set(documents.map((document) => document.sourceUrl).filter(Boolean));

  return (
    <div>
      <PageHeader
        eyebrow="Materials"
        title="Your learning materials"
        description="Upload PDFs and notes so AI Tutor can answer from your own sources."
        actions={<Link to="/ai-tutor" className="lynx-btn lynx-btn-primary">Ask AI Tutor <span>→</span></Link>}
      />
      <Alert className="lynx-section-gap" onRetry={load}>{error}</Alert>
      <div className="lynx-materials-grid">
        <div className="lynx-stack-tight">
          <UploadCard topics={topics} onDone={load} onError={setError} onSuccess={toast} />
          <TextCard topics={topics} onDone={load} onError={setError} onSuccess={toast} />
        </div>
        <section>
          <div className="lynx-row-between">
            <div>
              <p className="lynx-eyebrow">Library</p>
              <h2 className="lynx-h2">Searchable sources</h2>
            </div>
            <span className="lynx-muted lynx-caption">{documents.length} source{documents.length === 1 ? '' : 's'}</span>
          </div>
          <div className="lynx-stack lynx-section-gap">
            {documents.map((document) => (
              <DocumentRow key={document.id} document={document} topics={topics} onAttach={attach} onRemove={remove} />
            ))}
            {!documents.length && (
              <Card><EmptyState title="No materials yet" description="Upload a PDF or paste notes to build a knowledge base AI Tutor can search." /></Card>
            )}
          </div>

          {videos.length > 0 && (
            <>
              <h2 className="lynx-h2 lynx-section-gap">Videos</h2>
              <div className="lynx-stack lynx-section-gap">
                {videos.map((video) => (
                  <Card key={video.id} className="lynx-resource-row">
                    <div>
                      <h3 className="lynx-h3">{video.title}</h3>
                      <p className="lynx-muted lynx-caption">{video.topic.name} · {video.completedAt ? 'Completed' : `${video.watchedPercent}% watched`}</p>
                    </div>
                    <div className="lynx-resource-actions">
                      {video.transcript && !indexedUrls.has(video.url) && (
                        <button type="button" onClick={() => indexTranscript(video)} className="lynx-btn lynx-btn-ghost lynx-btn-sm">Make searchable</button>
                      )}
                      <Link to={`/learn/youtube/${video.id}`} className="lynx-btn lynx-btn-primary lynx-btn-sm">Open</Link>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
