import { Link } from 'react-router-dom';
import Card from '../components/Card.jsx';
import PageHeader from '../components/PageHeader.jsx';
import usePageTitle from '../hooks/usePageTitle.js';

const QUICK_START = [
  { title: 'Add a subject and its topics', text: 'Go to Subjects, add a subject with an optional exam date, then add the topics you need to learn.' },
  { title: 'Add your study material', text: 'Press Sources on a subject to share a textbook with all its topics, or use the Sources tab on a topic for material that only applies there.' },
  { title: 'Start a focus timer', text: 'Press Start focus on the topic page. The timer stays with you on every page.' },
  { title: 'Learn and clear your doubts', text: 'Read your material or watch a video in the Watch tab, and ask questions in Ask AI.' },
  { title: 'Test yourself', text: 'Make flashcards and a quiz in their tabs, and rate or answer them honestly.' },
  { title: 'Come back every day', text: 'Home shows the flashcards that are due. Review them to keep what you learned.' },
];

const SECTIONS = [
  {
    id: 'home',
    title: 'Home',
    intro: 'Your starting point each day.',
    points: [
      'See a study quote, your exam countdown, and a calendar with exam days marked.',
      'The 🔥 streak counts the days in a row you finished a focus block or reviewed a flashcard.',
      'See how many flashcards are due and how long you focused today.',
      'Continue studying lists your topics, with the ones that have cards due first.',
    ],
  },
  {
    id: 'subjects',
    title: 'Subjects and topics',
    intro: 'Everything is organised as subject, then topic.',
    points: [
      'Add a subject with a name and, if you have one, an exam date. The date appears on your calendar.',
      'Add topics inside a subject, then click a topic to open its page.',
      'Press Sources on a subject to add material that all its topics share, such as a whole textbook.',
      'Deleting a subject also deletes its topics, sources, flashcards, quizzes and notes.',
    ],
  },
  {
    id: 'sources',
    title: 'Sources',
    intro: 'The AI learns about a topic from your sources, so add them first. A source can belong to a subject or to one topic.',
    points: [
      'Add a source to a subject when it covers many topics. Press Sources on the subject in the Subjects page.',
      'Add a source in a topic\'s Sources tab when it only applies to that topic. Shared sources are listed there too, under the subject\'s name.',
      'Upload a PDF or text file of up to 10 MB, or paste text such as class notes.',
      'Ask AI searches every source on the topic. Flashcards, quizzes and mind maps use up to 10, starting with the topic\'s own.',
      'Wait for the status to show Ready. Scanned, image-only PDFs can\'t be read.',
      'My notes is your own space for the topic. Answers you save from Ask AI are added here.',
    ],
  },
  {
    id: 'ask',
    title: 'Ask AI',
    intro: 'A chat that answers from this topic\'s sources and those of its subject.',
    points: [
      'Ask a doubt, or use a suggestion to summarise the topic or make study notes.',
      'Numbers like [1] are citations. Click one to read the exact passage and page it came from.',
      'Follow-up questions work: try "explain that more simply" or "give me an example".',
      'Save to notes keeps a useful answer. New chat clears the conversation but keeps your notes.',
      'If your sources don\'t cover something, the AI says so. Anything from general knowledge is shown separately.',
    ],
  },
  {
    id: 'flashcards',
    title: 'Flashcards and Review',
    intro: 'Spaced repetition brings each card back just before you would forget it.',
    points: [
      'In the Flashcards tab, generate a set from your sources.',
      'Flip a card by clicking it or pressing Space, try to recall the answer, then rate how it went.',
      'Rate with Again, Hard, Good or Easy, or press 1, 2, 3 or 4. Harder cards come back sooner.',
      'The number next to Review in the sidebar shows the cards due. Open Review to work through them.',
    ],
  },
  {
    id: 'quiz',
    title: 'Quiz',
    intro: 'Exam practice built from your sources.',
    points: [
      'Pick a quiz type: All (10 MCQs, 5 two-mark and 5 five-mark questions), or just one of those sections.',
      'Answer the MCQs and press Submit MCQs to see your score and an explanation for each answer.',
      'For written questions, answer in your head or on paper, then press Show answer to compare with the model answer.',
      'Your submitted result stays saved. Try again retakes the MCQs, New quiz makes new questions, and Clear deletes this quiz.',
    ],
  },
  {
    id: 'watch',
    title: 'Watch',
    intro: 'Study YouTube lectures without the distractions.',
    points: [
      'Paste a YouTube link, then press Watch. Take notes beside the video and add them to your topic notes.',
      'Your progress is saved, and the video resumes where you stopped.',
      'Click or drag the bar under the video to jump to any point. Shading shows how much you have watched.',
    ],
  },
  {
    id: 'mindmap',
    title: 'Mind map',
    intro: 'See how the ideas in a topic connect.',
    points: [
      'Generate a map with the topic in the centre and a box of notes and key points on each branch.',
      'Use the − and + buttons, or Ctrl + scroll, to zoom. Fit shows the whole map.',
      'Download as notes saves the map as a text outline.',
    ],
  },
  {
    id: 'focus',
    title: 'Focus timer',
    intro: 'A Pomodoro timer that follows you across the app.',
    points: [
      'Press Start focus on a topic, or ▶ Focus in the corner of any page and choose a topic.',
      'You can pause, stop or minimise it. It keeps running if you change page or refresh.',
      'When the time is up you hear a chime and your break starts automatically. Then choose whether to start another block.',
      'Set your own focus and break lengths in Settings.',
    ],
  },
  {
    id: 'limits',
    title: 'AI limits',
    intro: 'AI use is limited each day so it stays available for everyone.',
    points: [
      'Generating flashcards, a quiz or a mind map uses your daily allowance, and so does each Ask AI answer.',
      'Opening saved content, reviewing flashcards, retaking a quiz and using the timer don\'t use it.',
      'See how much you have used today in Settings.',
      'If the AI is busy, wait a moment and try again. Everything you already made stays available.',
    ],
  },
];

/** A how-to manual for students, written around what they see on screen. */
export default function Guide() {
  usePageTitle('Guide');

  return (
    <div className="lynx-guide">
      <PageHeader eyebrow="Help" title="How to use Study Lynx" description="Start with the six steps below, then use the sections to learn each feature." />

      <Card>
        <h2 className="lynx-h2">Quick start</h2>
        <ol className="lynx-guide-steps">
          {QUICK_START.map((step) => (
            <li key={step.title}>
              <strong>{step.title}</strong>
              <span className="lynx-muted">{step.text}</span>
            </li>
          ))}
        </ol>
        <Link to="/subjects" className="lynx-btn lynx-btn-primary lynx-section-gap">Go to Subjects</Link>
      </Card>

      <nav className="lynx-guide-contents" aria-label="Guide sections">
        {SECTIONS.map((section) => <a key={section.id} href={`#${section.id}`} className="lynx-chip">{section.title}</a>)}
      </nav>

      <div className="lynx-guide-sections">
        {SECTIONS.map((section) => (
          <Card key={section.id}>
            <section id={section.id} aria-labelledby={`${section.id}-title`}>
              <h2 id={`${section.id}-title`} className="lynx-h2">{section.title}</h2>
              <p className="lynx-muted">{section.intro}</p>
              <ul className="lynx-guide-points">
                {section.points.map((point) => <li key={point}>{point}</li>)}
              </ul>
            </section>
          </Card>
        ))}
      </div>
    </div>
  );
}
