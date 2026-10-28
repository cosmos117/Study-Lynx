import { Link } from 'react-router-dom';
import BrandMark from '../components/BrandMark.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import usePageTitle from '../hooks/usePageTitle.js';

const features = [
  { icon: <MindMapIcon />, title: 'A hub for every topic', text: 'Videos, materials, flashcards, quizzes and progress live in one place, with a clear next step whenever you open it.' },
  { icon: <NotesIcon />, title: 'AI Tutor from your own sources', text: 'Ask a question and get an answer grounded in your PDFs, notes and transcripts, with the exact passages shown.' },
  { icon: <FlashcardIcon />, title: 'Active recall that sticks', text: 'Spaced-repetition flashcards bring each card back just before you would forget it.' },
  { icon: <QuizIcon />, title: 'Quizzes that teach', text: 'Practice questions built from your material, with an explanation for every answer you miss.' },
  { icon: <PlanIcon />, title: 'A plan you can follow', text: 'Daily sessions that favour weak topics and the closest exam, with a distraction-free focus timer.' },
  { icon: <DashboardIcon />, title: 'See how well you know it', text: 'Mastery for every topic from your quizzes, recall and study time, plus the weak spots to revise.' },
];

const loop = [
  ['Plan', 'Pick what to study today and why.'],
  ['Learn', 'Watch, read and ask your own materials.'],
  ['Recall', 'Review flashcards on a spaced schedule.'],
  ['Quiz', 'Test yourself and see what you missed.'],
  ['Analyze', 'Check mastery and weak areas.'],
  ['Revise', 'Go back to exactly what needs work.'],
];

export default function Landing() {
  usePageTitle('');
  const { user } = useAuth();

  return (
    <div className="lynx-page">
      <header className="lynx-header">
        <div className="lynx-header-inner">
          <Link to="/" className="lynx-logo-link">
            <BrandMark size={34} />
            Study Lynx
          </Link>
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
          <BrandMark size={84} />
          <p className="lynx-eyebrow lynx-section-gap">Your calm study companion</p>
          <h1 className="lynx-h1 lynx-landing-title">
            Focus better. <span className="lynx-gradient-text">Prepare smarter.</span>
          </h1>
          <p className="lynx-muted lynx-landing-lead">
            Study Lynx turns your exam syllabus into a plan, helps you learn from your own videos and notes, and keeps what you learn with flashcards and quizzes.
          </p>
          <div className="lynx-landing-actions">
            {user ? (
              <Link to="/dashboard" className="lynx-btn lynx-btn-primary">Open your dashboard <span aria-hidden="true">→</span></Link>
            ) : (
              <>
                <Link to="/register" className="lynx-btn lynx-btn-primary">Start studying free <span aria-hidden="true">→</span></Link>
                <Link to="/login" className="lynx-btn lynx-btn-ghost">Log in</Link>
              </>
            )}
          </div>
          <div className="lynx-landing-pills">
            {['Topic hub', 'AI Tutor', 'Flashcards', 'Quizzes', 'Exam planning'].map((item) => <span key={item} className="lynx-pill">{item}</span>)}
          </div>
        </section>

        <section className="lynx-landing-section" aria-labelledby="features-title">
          <div className="lynx-landing-heading">
            <p className="lynx-eyebrow">Features</p>
            <h2 id="features-title" className="lynx-h1">Everything you need to prepare</h2>
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

        <section className="lynx-landing-section" aria-labelledby="loop-title">
          <div className="lynx-landing-heading">
            <p className="lynx-eyebrow">How it works</p>
            <h2 id="loop-title" className="lynx-h1">One loop, from first read to exam day</h2>
          </div>
          <ol className="lynx-steps">
            {loop.map(([title, text]) => (
              <li key={title} className="lynx-step"><strong>{title}</strong><span>{text}</span></li>
            ))}
          </ol>
        </section>

        <section className="lynx-landing-section">
          <div className="lynx-card lynx-cta">
            <h2 className="lynx-h1">Ready to start preparing?</h2>
            <p className="lynx-muted">Create a free account and set up your first exam in under a minute.</p>
            {user ? (
              <Link to="/dashboard" className="lynx-btn lynx-btn-primary">Go to dashboard</Link>
            ) : (
              <Link to="/register" className="lynx-btn lynx-btn-primary">Create your account</Link>
            )}
          </div>
        </section>
      </main>

      <footer className="lynx-landing-footer">
        <div className="lynx-landing-footer-inner">
          <Link to="/" className="lynx-logo-link"><BrandMark size={26} />Study Lynx</Link>
          <p className="lynx-muted lynx-caption lynx-footer-note">Your materials and results are private to your account.</p>
        </div>
      </footer>
    </div>
  );
}

function NotesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function QuizIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function FlashcardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M8 6V4a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
    </svg>
  );
}

function MindMapIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M3 9h18" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3v18h18" />
      <path d="M7 15v3M12 10v8M17 6v12" />
    </svg>
  );
}
