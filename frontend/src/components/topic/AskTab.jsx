import { useState } from 'react';
import Alert from '../Alert.jsx';
import Card from '../Card.jsx';
import EmptyState from '../EmptyState.jsx';
import { useFeedback } from '../Feedback.jsx';
import { notesAPI, tutorAPI } from '../../services/api.js';
import { errorMessage } from '../../utils/aiErrors.js';

const FOLLOW_UPS = [
  ['simpler', 'Explain simpler'],
  ['example', 'Give an example'],
];

const sourceLabel = (source) => [source.page ? `page ${source.page}` : null, `passage ${source.chunkIndex}`].filter(Boolean).join(', ');

function Answer({ result, onFollowUp, onSave, busy, saving }) {
  return (
    <>
      {!result.sourceBacked && (
        <Alert tone="info">
          {result.retrievedChunks === 0 ? 'Nothing in your sources matched this question.' : 'Your sources did not fully support an answer.'}
        </Alert>
      )}
      <p className="lynx-eyebrow">{result.sourceBacked ? 'From your sources' : 'Answer'}</p>
      <div className="lynx-tutor-answer">{result.answer}</div>

      {result.generalExplanation && (
        <>
          <p className="lynx-eyebrow lynx-section-gap">General explanation (not from your sources)</p>
          <div className="lynx-tutor-answer lynx-tutor-general">{result.generalExplanation}</div>
        </>
      )}

      {result.sources.length > 0 && (
        <>
          <h3 className="lynx-h3 lynx-section-gap">Sources used</h3>
          <ul className="lynx-list">
            {result.sources.map((source) => (
              <li key={`${source.documentId}-${source.chunkIndex}`}>
                <strong>{source.name}</strong> — {sourceLabel(source)}
                <details className="lynx-source-excerpt">
                  <summary className="lynx-caption">Show passage</summary>
                  <p className="lynx-muted lynx-caption">{source.excerpt}{source.excerpt.length >= 240 ? '…' : ''}</p>
                </details>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="lynx-tutor-actions">
        <button type="button" disabled={saving} onClick={onSave} className="lynx-btn lynx-btn-primary lynx-btn-sm">{saving ? 'Saving…' : 'Save to my notes'}</button>
        {result.retrievedChunks > 0 && FOLLOW_UPS.map(([mode, label]) => (
          <button key={mode} type="button" disabled={busy} onClick={() => onFollowUp(mode)} className="lynx-btn lynx-btn-ghost lynx-btn-sm">{label}</button>
        ))}
      </div>
    </>
  );
}

/** Ask questions answered from this topic's own sources, and keep useful answers as notes. */
export default function AskTab({ topicId, hub, onAddSources }) {
  const { toast } = useFeedback();
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const ready = hub.learn.documents.filter((document) => document.status === 'READY');

  const ask = async (text, mode = 'ask') => {
    setBusy(true);
    setError('');
    try {
      const { data } = await tutorAPI.ask({ question: text, mode, topicId: Number(topicId), documentIds: ready.map((document) => document.id) });
      setResult(data.data);
      setAsked(text);
    } catch (requestError) {
      setError(errorMessage(requestError, 'AI could not answer right now'));
    } finally {
      setBusy(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    if (question.trim()) ask(question.trim());
  };

  const makeNotes = () => {
    const text = `Write clear, well-structured study notes on "${hub.topic.name}" covering the key ideas, definitions and examples.`;
    setQuestion(text);
    ask(text);
  };

  // Appends (never replaces) so earlier notes are kept.
  const saveToNotes = async () => {
    setSaving(true);
    try {
      const existing = (await notesAPI.get(topicId)).data.data.note?.content;
      const entry = `Q: ${asked}\n${result.answer}${result.generalExplanation ? `\n\n${result.generalExplanation}` : ''}`;
      await notesAPI.save(topicId, { content: [existing, entry].filter(Boolean).join('\n\n') });
      toast('Saved to My notes (Sources tab)');
    } catch (requestError) {
      toast(errorMessage(requestError, 'Unable to save to your notes'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!ready.length) {
    const processing = hub.learn.documents.some((document) => document.status !== 'READY' && document.status !== 'FAILED');
    return (
      <Card>
        <EmptyState
          icon="✦"
          title={processing ? 'Your sources are still processing' : 'Add a source to start asking'}
          description={processing ? 'They will be ready in a moment.' : 'Ask AI answers from your own PDFs and notes, so it needs at least one source on this topic.'}
          action={!processing && <button type="button" onClick={onAddSources} className="lynx-btn lynx-btn-primary">Add a source</button>}
        />
      </Card>
    );
  }

  return (
    <div className="lynx-tutor-grid">
      <Card>
        <form onSubmit={submit} className="lynx-form">
          <label className="lynx-label">Your question
            <textarea required value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={2000} rows="4" placeholder="Ask a doubt, e.g. Why is BCNF stricter than 3NF?" className="lynx-input" />
          </label>
          <p className="lynx-muted lynx-caption">Answers come from your {ready.length} source{ready.length === 1 ? '' : 's'} on this topic.</p>
          <Alert>{error}</Alert>
          <button disabled={busy || !question.trim()} className="lynx-btn lynx-btn-primary lynx-btn-block">{busy ? 'Thinking...' : 'Ask'}</button>
          <button type="button" disabled={busy} onClick={makeNotes} className="lynx-btn lynx-btn-ghost lynx-btn-block">Make notes from my sources</button>
        </form>
      </Card>
      <Card>
        <div aria-live="polite" aria-busy={busy}>
          {busy && <p className="lynx-muted lynx-caption">Searching your sources and writing an answer…</p>}
          {result ? (
            <>
              <p className="lynx-muted lynx-caption">You asked: {asked}</p>
              <Answer result={result} busy={busy} saving={saving} onSave={saveToNotes} onFollowUp={(mode) => ask(asked, mode)} />
            </>
          ) : (
            <EmptyState icon="✦" title="Your answer will appear here" description="Ask a doubt, or let the AI make notes from your sources. You can save any answer to your notes." />
          )}
        </div>
      </Card>
    </div>
  );
}
