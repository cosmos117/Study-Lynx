import { Link } from 'react-router-dom';
import BrandMark from '../components/BrandMark.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import './landing.css';

const features = [
  { icon: <NotesIcon />, title: 'Ask AI from your own sources', text: 'Clear doubts or make notes from your PDFs and notes, with the exact passages shown. Save any answer to your notes.' },
  { icon: <QuizIcon />, title: '10-question quizzes', text: 'A quiz built from your material, with an explanation for every answer you miss.' },
  { icon: <FlashcardIcon />, title: 'Flashcards that stick', text: 'Spaced repetition and active recall bring each card back just before you would forget it.' },
  { icon: <MindMapIcon />, title: 'Distraction-free videos', text: 'Watch lectures without recommendations, comments or autoplay, with a notes panel beside them.' },
  { icon: <PlanIcon />, title: 'A focus timer that follows you', text: 'A Pomodoro that floats over every page, chimes when it is time for a break, and builds your streak.' },
  { icon: <DashboardIcon />, title: 'One page per topic', text: 'Sources, Ask AI, flashcards, quiz and videos for a topic all live together, one tab each.' },
];

const loop = [
  ['Add', 'Create a subject and its topics.'],
  ['Upload', 'Add your PDFs, notes and videos.'],
  ['Focus', 'Start the Pomodoro and study.'],
  ['Ask', 'Clear doubts and make notes with AI.'],
  ['Recall', 'Review flashcards on a spaced schedule.'],
  ['Quiz', 'Take 10 questions and see what you missed.'],
];

const tutorPoints = [
  'Answers come from the files you upload, not from guesswork.',
  'Every answer lists the document and page it used.',
  'If your material does not cover it, the tutor says so.',
];

export default function Landing() {
  usePageTitle('');
  const { user } = useAuth();

  return (
    <div className="lynx-page lynx-landing">
      <header className="lynx-header">
        <div className="lynx-header-inner">
          <Link to="/" className="lynx-logo-link">
            <BrandMark size={34} />
            Study Lynx
          </Link>
          <nav className="lynx-landing-nav" aria-label="Page sections">
            <a href="#features">Features</a>
            <a href="#tutor">AI Tutor</a>
            <a href="#how">How it works</a>
          </nav>
          <div className="lynx-header-actions">
            {user ? (
              <Link to="/dashboard" className="lynx-btn lynx-btn-primary lynx-btn-sm">Go to dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="lynx-btn lynx-btn-ghost lynx-btn-sm">Log in</Link>
                <Link to="/register" className="lynx-btn lynx-btn-primary lynx-btn-sm">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="lynx-landing-hero">
          <div className="lynx-landing-hero-inner">
            <h1 className="lynx-h1 lynx-landing-title">
              Focus better. Prepare smarter.
            </h1>
            <p className="lynx-muted lynx-landing-lead">
              Study Lynx keeps you focused: learn from your own notes and videos, ask AI your doubts, and lock it in with flashcards and quizzes.
            </p>
            <div className="lynx-landing-actions">
              {user ? (
                <Link to="/dashboard" className="lynx-btn lynx-btn-primary lynx-btn-lg">Open your dashboard <span aria-hidden="true">→</span></Link>
              ) : (
                <>
                  <Link to="/register" className="lynx-btn lynx-btn-primary lynx-btn-lg">Start studying free <span aria-hidden="true">→</span></Link>
                  <Link to="/login" className="lynx-btn lynx-btn-ghost lynx-btn-lg">Log in</Link>
                </>
              )}
            </div>
          </div>

          <DashboardPreview />
        </section>

        <section id="features" className="lynx-landing-section" aria-labelledby="features-title">
          <div className="lynx-landing-heading">
            <p className="lynx-eyebrow">Features</p>
            <h2 id="features-title" className="lynx-h1">Everything you need to prepare</h2>
            <p className="lynx-muted">One workspace for planning, learning, remembering and checking yourself.</p>
          </div>
          <div className="lynx-feature-grid">
            {features.map((feature) => (
              <article key={feature.title} className="lynx-card lynx-card-hover lynx-feature">
                <div className="lynx-feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p className="lynx-muted">{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="tutor" className="lynx-landing-section" aria-labelledby="tutor-title">
          <div className="lynx-spotlight">
            <div className="lynx-spotlight-copy">
              <p className="lynx-eyebrow">AI Tutor</p>
              <h2 id="tutor-title" className="lynx-h1">Answers from your own notes, with the proof</h2>
              <p className="lynx-muted">Upload a PDF, paste your notes or save a lecture transcript. Then ask anything and see exactly where the answer came from.</p>
              <ul className="lynx-checklist">
                {tutorPoints.map((point) => <li key={point}>{point}</li>)}
              </ul>
            </div>
            <TutorPreview />
          </div>
        </section>

        <section id="how" className="lynx-landing-section" aria-labelledby="loop-title">
          <div className="lynx-landing-heading">
            <p className="lynx-eyebrow">How it works</p>
            <h2 id="loop-title" className="lynx-h1">One loop, from first read to exam day</h2>
            <p className="lynx-muted">Six simple steps for every topic, so you spend your time studying instead of deciding.</p>
          </div>
          <ol className="lynx-steps">
            {loop.map(([title, text]) => (
              <li key={title} className="lynx-step"><strong>{title}</strong><span>{text}</span></li>
            ))}
          </ol>
        </section>

        <section className="lynx-landing-section lynx-landing-final">
          <div className="lynx-cta">
            <h2 className="lynx-h1">Ready to start preparing?</h2>
            <p>Create a free account and set up your first subject in under a minute.</p>
            {user ? (
              <Link to="/dashboard" className="lynx-btn lynx-btn-primary lynx-btn-lg">Go to dashboard</Link>
            ) : (
              <Link to="/register" className="lynx-btn lynx-btn-primary lynx-btn-lg">Create your account</Link>
            )}
          </div>
        </section>
      </main>

      <footer className="lynx-landing-footer">
        <div className="lynx-landing-footer-inner">
          <Link to="/" className="lynx-logo-link"><BrandMark size={28} />Study Lynx</Link>
          <nav className="lynx-footer-links" aria-label="Footer">
            {user ? (
              <Link to="/dashboard">Dashboard</Link>
            ) : (
              <>
                <Link to="/login">Log in</Link>
                <Link to="/register">Create account</Link>
              </>
            )}
          </nav>
          <p className="lynx-muted lynx-caption lynx-footer-note">Your materials and results are private to your account.</p>
        </div>
      </footer>
    </div>
  );
}

/** A decorative sample of the dashboard. It is not real data, so it is hidden from assistive tech. */
function DashboardPreview() {
  return (
    <div className="lynx-preview-wrap" aria-hidden="true">
      <div className="lynx-preview">
        <div className="lynx-preview-bar">
          <span /><span /><span />
          <em>Study Lynx · Example</em>
        </div>
        <div className="lynx-preview-body">
          <p className="lynx-eyebrow">Study this next</p>
          <div className="lynx-preview-title">
            <div>
              <strong>Normalization</strong>
              <small>Databases · DBMS Finals</small>
            </div>
            <span className="lynx-preview-rank">1</span>
          </div>
          <div className="lynx-preview-pills">
            <span className="lynx-pill">6 cards due</span>
            <span className="lynx-pill">Mastery 41%</span>
            <span className="lynx-pill">Exam in 12 days</span>
          </div>
          <div className="lynx-preview-meter">
            <div><span>How well you know it</span><b>41%</b></div>
            <i><u /></i>
          </div>
          <div className="lynx-preview-actions">
            <span className="lynx-preview-btn lynx-preview-btn-primary">Study now</span>
            <span className="lynx-preview-btn">Open topic hub</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A decorative sample of a tutor answer with its sources. */
function TutorPreview() {
  return (
    <div className="lynx-tutor-mock" aria-hidden="true">
      <p className="lynx-tutor-mock-label">Example question</p>
      <div className="lynx-tutor-q">Why is BCNF stricter than 3NF?</div>
      <p className="lynx-tutor-mock-label">From your materials</p>
      <div className="lynx-tutor-a">BCNF requires every determinant to be a candidate key. 3NF still allows a few exceptions, so BCNF removes more redundancy.</div>
      <p className="lynx-tutor-mock-label">Sources used</p>
      <div className="lynx-tutor-sources-mock">
        <span className="lynx-pill">DBMS Notes.pdf · page 3</span>
        <span className="lynx-pill">Database Book.pdf · page 41</span>
      </div>
    </div>
  );
}

function NotesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function QuizIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function FlashcardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M8 6V4a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
    </svg>
  );
}

function MindMapIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="5" cy="5" r="1.8" />
      <circle cx="19" cy="5" r="1.8" />
      <circle cx="5" cy="19" r="1.8" />
      <circle cx="19" cy="19" r="1.8" />
      <path d="M10.4 10.4 6.2 6.2M13.6 10.4l4.2-4.2M10.4 13.6l-4.2 4.2M13.6 13.6l4.2 4.2" />
    </svg>
  );
}

function PlanIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M3 9h18" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3v18h18" />
      <path d="M7 15v3M12 10v8M17 6v12" />
    </svg>
  );
}
