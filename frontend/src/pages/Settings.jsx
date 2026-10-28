import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card.jsx';
import PageHeader from '../components/PageHeader.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useFeedback } from '../components/Feedback.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import { aiAPI } from '../services/api.js';

export default function Settings() {
  usePageTitle('Settings');
  const { user, logout } = useAuth();
  const { confirm } = useFeedback();
  const navigate = useNavigate();
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    aiAPI.usage().then(({ data }) => setUsage(data.data)).catch(() => setUsage(false));
  }, []);

  const signOut = async () => {
    if (!await confirm({ title: 'Log out?', message: 'You will need to sign in again to continue studying.', confirmLabel: 'Log out' })) return;
    logout();
    navigate('/login');
  };

  return (
    <div>
      <PageHeader eyebrow="Account" title="Settings" description="Your account, appearance and AI usage." />
      <div className="lynx-stack-tight">
        <Card>
          <h2 className="lynx-h2">Profile</h2>
          <dl className="lynx-definition lynx-section-gap">
            <dt>Name</dt><dd>{user.name}</dd>
            <dt>Email</dt><dd>{user.email}</dd>
          </dl>
        </Card>
        <Card>
          <h2 className="lynx-h2">Appearance</h2>
          <p className="lynx-muted lynx-sub">Night Lynx follows your device setting until you choose one.</p>
          <div className="lynx-section-gap"><ThemeToggle /></div>
        </Card>
        <Card>
          <h2 className="lynx-h2">AI usage today</h2>
          {usage ? (
            <div className="lynx-section-gap">
              <ProgressBar value={Math.min(100, (usage.userUsedToday / usage.userLimit) * 100)} label={`${usage.userUsedToday} of ${usage.userLimit} AI generations used`} />
              <p className="lynx-muted lynx-caption">Notes, flashcards, quizzes, mind maps and AI Tutor answers each count as one. The limit resets daily. Saved content never expires.</p>
            </div>
          ) : <p className="lynx-muted lynx-sub">{usage === false ? 'Usage is unavailable right now.' : 'Loading…'}</p>}
        </Card>
        <Card>
          <h2 className="lynx-h2">Privacy</h2>
          <p className="lynx-muted lynx-sub">Your materials, notes and results belong to your account only. AI Tutor searches nothing but your own uploads, and passages shown with an answer always come from them.</p>
        </Card>
        <Card>
          <h2 className="lynx-h2">Keyboard shortcuts</h2>
          <dl className="lynx-definition lynx-section-gap">
            <dt>Active Recall</dt><dd>Space reveals the answer · 1 Again · 2 Hard · 3 Good · 4 Easy</dd>
          </dl>
        </Card>
        <div><button type="button" onClick={signOut} className="lynx-btn lynx-btn-danger-ghost">Log out</button></div>
      </div>
    </div>
  );
}
