import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Alert from '../components/Alert.jsx';
import BrandMark from '../components/BrandMark.jsx';
import GoogleButton from '../components/GoogleButton.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import { errorMessage } from '../utils/aiErrors.js';

export default function Login() {
  usePageTitle('Log in');
  const { user, login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(form);
      navigate('/dashboard');
    } catch (requestError) {
      setError(errorMessage(requestError, 'Unable to log in'));
    } finally {
      setSubmitting(false);
    }
  };

  const googleSignIn = async (credential) => {
    setError('');
    try {
      await loginWithGoogle(credential);
      navigate('/dashboard');
    } catch (requestError) {
      setError(errorMessage(requestError, 'Unable to sign in with Google'));
    }
  };

  return (
    <AuthFormShell title="Welcome back" subtitle="Continue planning your study progress.">
      <form onSubmit={submit} className="lynx-form">
        <GoogleButton text="signin_with" onCredential={googleSignIn} onError={setError} />
        <Field label="Email" type="email" autoComplete="email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
        <Field label="Password" type="password" autoComplete="current-password" value={form.password} onChange={(password) => setForm({ ...form, password })} />
        <Alert>{error}</Alert>
        <button disabled={submitting} className="lynx-btn lynx-btn-primary lynx-btn-block">
          {submitting ? 'Logging in...' : 'Log in'}
        </button>
        <p className="lynx-muted lynx-auth-foot">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </AuthFormShell>
  );
}

function Field({ label, type, value, onChange, autoComplete }) {
  return (
    <label className="lynx-label">
      {label}
      {type === 'password'
        ? <PasswordInput required autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} />
        : <input required type={type} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} className="lynx-input" />}
    </label>
  );
}

const POINTS = [
  'See exactly what to study next, and why.',
  'Ask questions answered from your own notes and PDFs.',
  'Remember more with spaced flashcards and quizzes.',
];

export function AuthFormShell({ title, subtitle, children }) {
  return (
    <main className="lynx-auth-page">
      <aside className="lynx-auth-aside">
        <Link to="/" className="lynx-logo-link"><BrandMark size={40} />Study Lynx</Link>
        <div>
          <p className="lynx-auth-pitch">Study with a plan, and know how well you know it.</p>
          <ul className="lynx-auth-points">{POINTS.map((point) => <li key={point}>{point}</li>)}</ul>
        </div>
        <p className="lynx-auth-legal">Your materials and results stay private to your account.</p>
      </aside>
      <div className="lynx-auth-wrap">
        <section className="lynx-card lynx-auth-card">
          <div className="lynx-auth-brand">
            <BrandMark size={36} />
            Study Lynx
          </div>
          <h1 className="lynx-h1">{title}</h1>
          <p className="lynx-auth-sub">{subtitle}</p>
          {children}
        </section>
      </div>
    </main>
  );
}

