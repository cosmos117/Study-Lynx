import { useEffect, useState } from 'react';
import Alert from '../Alert.jsx';
import Card from '../Card.jsx';
import EmptyState from '../EmptyState.jsx';
import { useFeedback } from '../Feedback.jsx';
import { LynxBadge } from '../LynxBadges.jsx';
import { documentAPI, notesAPI } from '../../services/api.js';
import { NIGHT_LYNX } from '../../theme/tokens.js';
import { errorMessage } from '../../utils/aiErrors.js';

const MAX_UPLOAD_MB = 10;
const POLL_MS = 2000;
const STATUS = {
  READY: ['Ready', NIGHT_LYNX.status.completed],
  PROCESSING: ['Processing', NIGHT_LYNX.status.planned],
  UPLOADING: ['Uploading', NIGHT_LYNX.status.planned],
  FAILED: ['Failed', NIGHT_LYNX.status.overdue],
};
const TYPE_LABEL = { PDF: 'PDF', NOTE: 'Notes', YOUTUBE: 'Video transcript' };
const isBusy = (document) => document.status === 'PROCESSING' || document.status === 'UPLOADING';

function UploadCard({ topicId, onDone, onError }) {
  const { toast } = useFeedback();
  const [file, setFile] = useState(null);
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
    body.append('topicId', topicId);
    setBusy(true);
    onError('');
    try {
      await documentAPI.upload(body);
      toast('Upload received. It will be ready for Ask AI in a moment.');
      setFile(null);
      event.target.reset();
      await onDone();
    } catch (error) {
      onError(errorMessage(error, 'Unable to upload this file'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="lynx-h2">Upload a PDF</h2>
      <form onSubmit={submit} className="lynx-form lynx-section-gap">
        <input required aria-label="PDF or text file" type="file" accept="application/pdf,text/plain,.pdf,.txt" onChange={choose} className="lynx-input" />
        <p className="lynx-muted lynx-caption">PDF or plain text, up to {MAX_UPLOAD_MB} MB. Scanned, image-only PDFs can&apos;t be read.</p>
        <button disabled={busy || !file} className="lynx-btn lynx-btn-primary lynx-btn-block">{busy ? 'Uploading...' : 'Upload'}</button>
      </form>
    </Card>
  );
}

function PasteCard({ topicId, onDone, onError }) {
  const { toast } = useFeedback();
  const [form, setForm] = useState({ name: '', text: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    onError('');
    try {
      await documentAPI.createText({ type: 'NOTE', name: form.name, text: form.text, topicId: Number(topicId) });
      setForm({ name: '', text: '' });
      toast('Saved. It will be ready for Ask AI in a moment.');
      await onDone();
    } catch (error) {
      onError(errorMessage(error, 'Unable to save this text'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="lynx-h2">Paste text</h2>
      <form onSubmit={submit} className="lynx-form lynx-section-gap">
        <input required aria-label="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={190} placeholder="Name, e.g. Lecture 3 notes" className="lynx-input" />
        <textarea required aria-label="Text to save" value={form.text} onChange={(event) => setForm({ ...form, text: event.target.value })} rows="5" placeholder="Paste class notes, an article or a transcript..." className="lynx-input" />
        <button disabled={busy} className="lynx-btn lynx-btn-ghost lynx-btn-block">{busy ? 'Saving...' : 'Save as source'}</button>
      </form>
    </Card>
  );
}

function SourceList({ documents, onRemove }) {
  if (!documents.length) {
    return <Card><EmptyState title="No sources yet" description="Upload a PDF or paste text. Ask AI, flashcards and quizzes are built from these." /></Card>;
  }
  return (
    <div className="lynx-stack">
      {documents.map((document) => {
        const [label, color] = STATUS[document.status] || [document.status, NIGHT_LYNX.muted];
        const meta = [
          TYPE_LABEL[document.type],
          document.pageCount ? `${document.pageCount} pages` : null,
          document.status === 'READY' ? `${document.passages} passages` : null,
        ].filter(Boolean).join(' · ');
        return (
          <Card key={document.id} className="lynx-document-row">
            <div className="lynx-row-between">
              <div>
                <h3 className="lynx-h3">{document.name}</h3>
                <p className="lynx-muted lynx-caption">{meta}</p>
              </div>
              <div className="lynx-resource-actions">
                <LynxBadge color={color}>{label}</LynxBadge>
                <button type="button" onClick={() => onRemove(document)} className="lynx-link-btn">Delete</button>
              </div>
            </div>
            {document.status === 'FAILED' && <Alert>{document.errorMessage || 'Processing failed.'}</Alert>}
          </Card>
        );
      })}
    </div>
  );
}

function NotesCard({ topicId }) {
  const { toast } = useFeedback();
  const [text, setText] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    notesAPI.get(topicId).then(({ data }) => setText(data.data.note?.content || '')).catch(() => setText(''));
  }, [topicId]);

  const save = async () => {
    setSaving(true);
    try {
      await notesAPI.save(topicId, { content: text });
      toast('Notes saved');
    } catch (error) {
      toast(errorMessage(error, 'Unable to save your notes'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <h2 className="lynx-h2">My notes</h2>
      <p className="lynx-muted lynx-caption">Your own notes for this topic. Answers you save from Ask AI land here too.</p>
      {text === null ? <p className="lynx-muted lynx-caption">Loading…</p> : (
        <>
          <textarea aria-label="My notes" value={text} onChange={(event) => setText(event.target.value)} rows="10" className="lynx-input lynx-section-gap" placeholder="Write or paste your notes..." />
          <button type="button" onClick={save} disabled={saving} className="lynx-btn lynx-btn-primary lynx-section-gap">{saving ? 'Saving…' : 'Save notes'}</button>
        </>
      )}
    </Card>
  );
}

/** Everything the AI can learn from for this topic: uploaded PDFs, pasted text, and the student's own notes. */
export default function SourcesTab({ topicId, hub, reload }) {
  const { confirm, toast } = useFeedback();
  const [error, setError] = useState('');
  const documents = hub.learn.documents;

  // Keep refreshing while a source is still being processed.
  const processing = documents.some(isBusy);
  useEffect(() => {
    if (!processing) return undefined;
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [processing, reload]);

  const remove = async (document) => {
    if (!await confirm({ title: `Delete "${document.name}"?`, message: 'Ask AI, flashcards and quizzes will no longer use it. This cannot be undone.', confirmLabel: 'Delete', danger: true })) return;
    try {
      await documentAPI.remove(document.id);
      toast('Source deleted');
      await reload();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Unable to delete this source'));
    }
  };

  return (
    <div className="lynx-stack-tight">
      <Alert>{error}</Alert>
      <div className="lynx-materials-grid">
        <div className="lynx-stack-tight">
          <UploadCard topicId={topicId} onDone={reload} onError={setError} />
          <PasteCard topicId={topicId} onDone={reload} onError={setError} />
        </div>
        <section className="lynx-stack-tight">
          <div className="lynx-row-between">
            <h2 className="lynx-h2">Your sources</h2>
            <span className="lynx-muted lynx-caption">{documents.length} source{documents.length === 1 ? '' : 's'}</span>
          </div>
          <SourceList documents={documents} onRemove={remove} />
          <NotesCard topicId={topicId} />
        </section>
      </div>
    </div>
  );
}
