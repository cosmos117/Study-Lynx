import { Link } from 'react-router-dom';
import Alert from '../Alert.jsx';
import Card from '../Card.jsx';
import EmptyState from '../EmptyState.jsx';
import LearningResourceSection from '../LearningResourceSection.jsx';
import ProgressBar from '../ProgressBar.jsx';

const DOCUMENT_STATUS = { READY: null, PROCESSING: 'Processing…', UPLOADING: 'Processing…', FAILED: 'Failed' };

function GenerateButtons({ onGenerate, busy, source }) {
  return (
    <>
      <button type="button" disabled={busy} onClick={() => onGenerate('flashcards', source)} className="lynx-btn lynx-btn-ghost lynx-btn-sm">Create flashcards</button>
      <button type="button" disabled={busy} onClick={() => onGenerate('quiz', source)} className="lynx-btn lynx-btn-ghost lynx-btn-sm">Create quiz</button>
    </>
  );
}

function VideoCard({ hub, busy, onGenerate, onIndex, onReload, indexedUrls }) {
  const { learn, topic } = hub;
  const resume = learn.videos.find((video) => !video.completed) || learn.videos[0];
  return (
    <Card className="lynx-hub-card">
      <div className="lynx-row-between">
        <div>
          <p className="lynx-eyebrow">YouTube</p>
          <h2 className="lynx-h2">{learn.videos.length ? `${learn.videos.length} video${learn.videos.length === 1 ? '' : 's'}` : 'No videos yet'}</h2>
        </div>
        {resume && <Link to={`/learn/youtube/${resume.id}`} className="lynx-btn lynx-btn-primary lynx-btn-sm">{resume.watchedPercent > 0 && !resume.completed ? 'Continue' : 'Watch'}</Link>}
      </div>
      {learn.videos.map((video) => (
        <div key={video.id} className="lynx-hub-item">
          <div>
            <h3 className="lynx-h3">{video.title}</h3>
            <ProgressBar value={video.completed ? 100 : video.watchedPercent} label={video.completed ? 'Completed' : 'Watched'} />
          </div>
          {video.hasTranscript ? (
            <div className="lynx-hub-actions">
              <GenerateButtons busy={busy} onGenerate={onGenerate} source={{ resourceIds: [video.id] }} />
              {!indexedUrls.has(video.url) && <button type="button" disabled={busy} onClick={() => onIndex(video)} className="lynx-btn lynx-btn-ghost lynx-btn-sm">Make searchable</button>}
            </div>
          ) : (
            <p className="lynx-muted lynx-caption">No transcript saved. <Link to="/materials" className="lynx-text-link">Paste one in Materials</Link> to use this video for flashcards, quizzes and AI Tutor.</p>
          )}
        </div>
      ))}
      <details>
        <summary className="lynx-text-link">{learn.videos.length ? 'Add or remove videos' : 'Add a video'}</summary>
        <LearningResourceSection topicId={topic.id} onChange={onReload} />
      </details>
    </Card>
  );
}

function MaterialsCard({ hub, busy, onGenerate }) {
  const { documents } = hub.learn;
  return (
    <Card className="lynx-hub-card">
      <div className="lynx-row-between">
        <div>
          <p className="lynx-eyebrow">Materials</p>
          <h2 className="lynx-h2">{documents.length ? `${documents.length} source${documents.length === 1 ? '' : 's'}` : 'No materials yet'}</h2>
        </div>
        <Link to="/materials" className="lynx-btn lynx-btn-primary lynx-btn-sm">{documents.length ? 'Open' : 'Upload'}</Link>
      </div>
      {!documents.length && <EmptyState title="Nothing attached to this topic" description="Upload a PDF or paste notes, then attach them to this topic in Materials." />}
      {documents.map((document) => (
        <div key={document.id} className="lynx-hub-item">
          <div>
            <h3 className="lynx-h3">{document.name}</h3>
            <p className="lynx-muted lynx-caption">
              {[document.type, document.pageCount ? `${document.pageCount} pages` : null, document.status === 'READY' ? `${document.passages} passages` : DOCUMENT_STATUS[document.status]].filter(Boolean).join(' · ')}
            </p>
            {document.status === 'FAILED' && <Alert>{document.errorMessage}</Alert>}
          </div>
          {document.status === 'READY' && (
            <div className="lynx-hub-actions">
              <GenerateButtons busy={busy} onGenerate={onGenerate} source={{ documentIds: [document.id] }} />
              <Link to={`/ai-tutor?topicId=${hub.topic.id}`} className="lynx-btn lynx-btn-ghost lynx-btn-sm">Ask about it</Link>
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}

function TutorCard({ hub }) {
  return (
    <Card className="lynx-hub-card">
      <div className="lynx-row-between">
        <div>
          <p className="lynx-eyebrow">AI Tutor</p>
          <h2 className="lynx-h2">Ask from your sources</h2>
        </div>
        <Link to={`/ai-tutor?topicId=${hub.topic.id}`} className="lynx-btn lynx-btn-primary lynx-btn-sm">Ask question</Link>
      </div>
      <p className="lynx-muted lynx-sub">
        {hub.learn.tutorSources
          ? `Answers use the ${hub.learn.tutorSources} searchable source${hub.learn.tutorSources === 1 ? '' : 's'} on this topic and show which passages they came from.`
          : 'AI Tutor answers from searchable materials. Upload a PDF, paste notes, or make a video transcript searchable first.'}
      </p>
    </Card>
  );
}

function NotesCard({ hub, busy, onGenerate }) {
  return (
    <Card className="lynx-hub-card">
      <div className="lynx-row-between">
        <div>
          <p className="lynx-eyebrow">Notes</p>
          <h2 className="lynx-h2">{hub.learn.hasNotes ? 'Your saved notes' : 'No notes yet'}</h2>
        </div>
        <Link to={`/topics/${hub.topic.id}/study?tab=Notes`} className="lynx-btn lynx-btn-ghost lynx-btn-sm">Open</Link>
      </div>
      <div className="lynx-hub-actions">
        <button type="button" disabled={busy} onClick={() => onGenerate('notes')} className="lynx-btn lynx-btn-ghost lynx-btn-sm">Generate notes from selected sources</button>
      </div>
    </Card>
  );
}

export default function LearnPanel({ hub, busy, onGenerate, onIndex, onReload }) {
  const indexedUrls = new Set(hub.learn.documents.map((document) => document.sourceUrl).filter(Boolean));
  return (
    <div className="lynx-hub-grid">
      <VideoCard hub={hub} busy={busy} onGenerate={onGenerate} onIndex={onIndex} onReload={onReload} indexedUrls={indexedUrls} />
      <MaterialsCard hub={hub} busy={busy} onGenerate={onGenerate} />
      <TutorCard hub={hub} />
      <NotesCard hub={hub} busy={busy} onGenerate={onGenerate} />
    </div>
  );
}
