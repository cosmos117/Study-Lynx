import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../Alert.jsx';
import Card from '../Card.jsx';
import { useFeedback } from '../Feedback.jsx';
import { PasteCard, SOURCE_POLL_MS, SourceList, UploadCard, isBusy } from '../SourceCards.jsx';
import { documentAPI, notesAPI } from '../../services/api.js';
import { errorMessage } from '../../utils/aiErrors.js';

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

/** Everything the AI can learn from for this topic: its own sources, those shared by its subject, and the student's notes. */
export default function SourcesTab({ topicId, hub, reload }) {
  const { confirm, toast } = useFeedback();
  const [error, setError] = useState('');
  const documents = hub.learn.documents.filter((document) => !document.fromSubject);
  const shared = hub.learn.documents.filter((document) => document.fromSubject);
  const scope = { topicId: Number(topicId) };

  // Keep refreshing while a source is still being processed.
  const processing = hub.learn.documents.some(isBusy);
  useEffect(() => {
    if (!processing) return undefined;
    const timer = setInterval(reload, SOURCE_POLL_MS);
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
          <UploadCard scope={scope} onDone={reload} onError={setError} />
          <PasteCard scope={scope} onDone={reload} onError={setError} />
        </div>
        <section className="lynx-stack-tight">
          <div className="lynx-row-between">
            <h2 className="lynx-h2">This topic&apos;s sources</h2>
            <span className="lynx-muted lynx-caption">{documents.length} source{documents.length === 1 ? '' : 's'}</span>
          </div>
          <SourceList
            documents={documents}
            onRemove={remove}
            emptyTitle={shared.length ? 'None just for this topic' : undefined}
            emptyText={shared.length ? `This topic already uses the sources from ${hub.topic.subject.name}. Add one here if it only applies to this topic.` : `Upload a PDF or paste text here, or add it to ${hub.topic.subject.name} on the Subjects page to share it with every topic.`}
          />
          {shared.length > 0 && (
            <>
              <div className="lynx-row-between">
                <h2 className="lynx-h2">From {hub.topic.subject.name}</h2>
                <Link to="/subjects" className="lynx-link lynx-caption">Manage in Subjects</Link>
              </div>
              <SourceList documents={shared} />
            </>
          )}
          <NotesCard topicId={topicId} />
        </section>
      </div>
    </div>
  );
}
