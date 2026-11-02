import { useCallback, useEffect, useRef, useState } from 'react';
import Alert from '../Alert.jsx';
import Card from '../Card.jsx';
import EmptyState from '../EmptyState.jsx';
import { useFeedback } from '../Feedback.jsx';
import LoadingSpinner from '../LoadingSpinner.jsx';
import RichText from '../RichText.jsx';
import { notesAPI, tutorAPI } from '../../services/api.js';
import { errorMessage } from '../../utils/aiErrors.js';
import { toPlainText } from '../../utils/richText.js';

const FOLLOW_UPS = [
  ['simpler', 'Explain that more simply'],
  ['example', 'Give me an example'],
  ['quiz', 'Quiz me on this'],
];

const sourceLabel = (source) => [source.name, source.page ? `p. ${source.page}` : null].filter(Boolean).join(' · ');

function AssistantMessage({ message, question, isLast, busy, onFollowUp }) {
  const { toast } = useFeedback();
  const [openSource, setOpenSource] = useState(null);
  const [saving, setSaving] = useState(false);
  const sources = message.sources || [];
  const toggleSource = (number) => setOpenSource((current) => (current === number ? null : number));

  // Appends (never replaces) so earlier notes are kept.
  const saveToNotes = async () => {
    setSaving(true);
    try {
      const existing = (await notesAPI.get(message.topicId)).data.data.note?.content;
      const general = message.generalExplanation ? `\n\n${toPlainText(message.generalExplanation)}` : '';
      const entry = `Q: ${question}\n${toPlainText(message.content)}${general}`;
      await notesAPI.save(message.topicId, { content: [existing, entry].filter(Boolean).join('\n\n') });
      toast('Saved to My notes (Sources tab)');
    } catch (requestError) {
      toast(errorMessage(requestError, 'Unable to save to your notes'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="lynx-msg is-assistant">
      {!message.sourceBacked && (
        <p className="lynx-msg-note">{message.retrievedChunks === 0 ? 'Nothing in your sources matched this.' : 'Your sources only partly cover this.'}</p>
      )}
      <RichText text={message.content} onCite={sources.length ? toggleSource : undefined} />

      {message.generalExplanation && (
        <details className="lynx-msg-general">
          <summary>General knowledge (not from your sources)</summary>
          <RichText text={message.generalExplanation} />
        </details>
      )}

      {sources.length > 0 && (
        <div className="lynx-msg-sources">
          {sources.map((source) => (
            <button
              type="button"
              key={source.number}
              onClick={() => toggleSource(source.number)}
              className={`lynx-source-chip ${openSource === source.number ? 'is-open' : ''}`}
              aria-expanded={openSource === source.number}
            >
              <b>{source.number}</b> {sourceLabel(source)}
            </button>
          ))}
        </div>
      )}
      {openSource !== null && sources.find((source) => source.number === openSource) && (
        <blockquote className="lynx-source-passage">
          <span className="lynx-caption">Source {openSource} · {sourceLabel(sources.find((source) => source.number === openSource))}</span>
          {sources.find((source) => source.number === openSource).excerpt}…
        </blockquote>
      )}

      <div className="lynx-msg-actions">
        <button type="button" disabled={saving} onClick={saveToNotes} className="lynx-link-btn">{saving ? 'Saving…' : 'Save to notes'}</button>
        {isLast && message.retrievedChunks > 0 && FOLLOW_UPS.map(([mode, label]) => (
          <button type="button" key={mode} disabled={busy} onClick={() => onFollowUp(label, mode)} className="lynx-chip">{label}</button>
        ))}
      </div>
    </div>
  );
}

/** A conversation with the AI about this topic, answered from the topic's own sources. */
export default function AskTab({ topicId, hub, onAddSources }) {
  const { confirm } = useFeedback();
  const [messages, setMessages] = useState(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const thread = useRef(null);
  const topicName = hub.topic.name;
  const ready = hub.learn.documents.filter((document) => document.status === 'READY');

  useEffect(() => {
    tutorAPI.history(topicId)
      .then(({ data }) => setMessages(data.data.messages))
      .catch(() => setMessages([]));
  }, [topicId]);

  // Keep the newest message in view.
  useEffect(() => {
    if (thread.current) thread.current.scrollTop = thread.current.scrollHeight;
  }, [messages, busy]);

  const send = useCallback(async (text, mode = 'ask') => {
    const question = text.trim();
    if (!question || busy) return;
    setBusy(true);
    setError('');
    setInput('');
    const pendingId = `pending-${Date.now()}`;
    setMessages((current) => [...(current || []), { id: pendingId, role: 'user', content: question }]);
    try {
      const { data } = await tutorAPI.ask({ question, mode, topicId: Number(topicId) });
      const { answer, questionId, answerId, ...details } = data.data;
      setMessages((current) => [
        ...current.filter((message) => message.id !== pendingId),
        { id: questionId ?? pendingId, role: 'user', content: question },
        { id: answerId ?? `answer-${Date.now()}`, role: 'assistant', content: answer, ...details },
      ]);
    } catch (requestError) {
      setMessages((current) => current.filter((message) => message.id !== pendingId));
      setInput(question);
      setError(errorMessage(requestError, 'AI could not answer right now'));
    } finally {
      setBusy(false);
    }
  }, [busy, topicId]);

  const newChat = async () => {
    if (!await confirm({ title: 'Start a new chat?', message: 'This conversation is cleared. Notes you saved are kept.', confirmLabel: 'New chat' })) return;
    try {
      await tutorAPI.clearHistory(topicId);
      setMessages([]);
      setError('');
    } catch (requestError) {
      setError(errorMessage(requestError, 'Unable to clear the chat'));
    }
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(input);
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
  if (!messages) return <LoadingSpinner />;

  const suggestions = [
    [`Summarise the key ideas of ${topicName}`, 'ask'],
    [`Make study notes on ${topicName} from my sources`, 'ask'],
    ['What are the most important points to remember for the exam?', 'ask'],
    ['Quiz me with 3 questions', 'quiz'],
  ];

  return (
    <Card className="lynx-chat">
      <div className="lynx-row-between lynx-chat-head">
        <p className="lynx-muted lynx-caption">Answers come from your {ready.length} source{ready.length === 1 ? '' : 's'} on this topic, with the passages shown.</p>
        <button type="button" onClick={newChat} disabled={!messages.length || busy} className="lynx-btn lynx-btn-ghost lynx-btn-sm">New chat</button>
      </div>

      <div ref={thread} className="lynx-chat-thread" aria-live="polite" aria-busy={busy}>
        {!messages.length && (
          <div className="lynx-chat-intro">
            <p className="lynx-h3">Ask anything about {topicName}</p>
            <p className="lynx-muted lynx-caption">Clear a doubt, make notes, or test yourself. Follow-up questions remember the conversation.</p>
            <div className="lynx-chat-suggestions">
              {suggestions.map(([text, mode]) => (
                <button type="button" key={text} onClick={() => send(text, mode)} disabled={busy} className="lynx-chip">{text}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message, index) => (message.role === 'user'
          ? <div key={message.id} className="lynx-msg is-user">{message.content}</div>
          : (
            <AssistantMessage
              key={message.id}
              message={{ ...message, topicId }}
              question={messages[index - 1]?.content || ''}
              isLast={index === messages.length - 1}
              busy={busy}
              onFollowUp={send}
            />
          )))}
        {busy && <div className="lynx-msg is-assistant lynx-msg-typing" aria-label="AI is writing an answer"><span /><span /><span /></div>}
      </div>

      <Alert>{error}</Alert>
      <form className="lynx-chat-composer" onSubmit={(event) => { event.preventDefault(); send(input); }}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          maxLength={2000}
          placeholder={messages.length ? 'Ask a follow-up…' : 'Ask a doubt, e.g. Why is BCNF stricter than 3NF?'}
          aria-label="Your question"
          className="lynx-input"
        />
        <button disabled={busy || !input.trim()} className="lynx-btn lynx-btn-primary">{busy ? 'Thinking…' : 'Send'}</button>
      </form>
      <p className="lynx-muted lynx-caption lynx-chat-hint">Enter to send · Shift + Enter for a new line</p>
    </Card>
  );
}
