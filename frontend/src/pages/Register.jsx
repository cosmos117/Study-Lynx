import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Alert from '../components/Alert.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import { AuthFormShell } from './Login.jsx';

const LABELS = { name: 'Name', email: 'Email', password: 'Password', confirmPassword: 'Confirm password' };
const AUTOCOMPLETE = { name: 'name', email: 'email', password: 'new-password', confirmPassword: 'new-password' };

export default function Register() {
  usePageTitle('Create account');
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      await register({ name: form.name, email: form.email, password: form.password });
      navigate('/dashboard');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFormShell title="Create your account" subtitle="Start organizing your study goals.">
      <form onSubmit={submit} className="lynx-form">
        {['name', 'email', 'password', 'confirmPassword'].map((field) => (
          <label key={field} className="lynx-label">
            {LABELS[field]}
            <input required autoComplete={AUTOCOMPLETE[field]} minLength={field.includes('password') ? 8 : undefined} type={field.includes('password') ? 'password' : field === 'email' ? 'email' : 'text'} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} className="lynx-input" />
          </label>
        ))}
        <p className="lynx-muted lynx-caption">Use at least 8 characters for your password.</p>
        <Alert>{error}</Alert>
        <button disabled={submitting} className="lynx-btn lynx-btn-primary lynx-btn-block">
          {submitting ? 'Creating account...' : 'Create account'}
        </button>
        <p className="lynx-auth-foot">
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </form>
    </AuthFormShell>
  );
}
