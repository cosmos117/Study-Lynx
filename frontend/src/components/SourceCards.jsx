import { useState } from 'react';
import Alert from './Alert.jsx';
import Card from './Card.jsx';
import EmptyState from './EmptyState.jsx';
import { useFeedback } from './Feedback.jsx';
import { LynxBadge } from './LynxBadges.jsx';
import { documentAPI } from '../services/api.js';
import { NIGHT_LYNX } from '../theme/tokens.js';
import { errorMessage } from '../utils/aiErrors.js';

const MAX_UPLOAD_MB = 10;
const STATUS = {
  READY: ['Ready', NIGHT_LYNX.status.completed],
  PROCESSING: ['Processing', NIGHT_LYNX.status.planned],
  UPLOADING: ['Uploading', NIGHT_LYNX.status.planned],
  FAILED: ['Failed', NIGHT_LYNX.status.overdue],
};
const TYPE_LABEL = { PDF: 'PDF', NOTE: 'Notes', YOUTUBE: 'Video transcript' };

export const SOURCE_POLL_MS = 2000;
export const isBusy = (document) => document.status === 'PROCESSING' || document.status === 'UPLOADING';

// `scope` says who owns a new source: { topicId } or { subjectId }.
export function UploadCard({ scope, onDone, onError }) {
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
    Object.entries(scope).forEach(([key, value]) => body.append(key, value));
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

export function PasteCard({ scope, onDone, onError }) {
  const { toast } = useFeedback();
  const [form, setForm] = useState({ name: '', text: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    onError('');
    try {
      await documentAPI.createText({ type: 'NOTE', name: form.name, text: form.text, ...scope });
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

/** Without `onRemove` the list is read-only. */
export function SourceList({ documents, onRemove, emptyTitle = 'No sources yet', emptyText = 'Upload a PDF or paste text. Ask AI, flashcards and quizzes are built from these.' }) {
  if (!documents.length) {
    return <Card><EmptyState title={emptyTitle} description={emptyText} /></Card>;
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
                {onRemove && <button type="button" onClick={() => onRemove(document)} className="lynx-link-btn">Delete</button>}
              </div>
            </div>
            {document.status === 'FAILED' && <Alert>{document.errorMessage || 'Processing failed.'}</Alert>}
          </Card>
        );
      })}
    </div>
  );
}
