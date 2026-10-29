import { Navigate, Outlet } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner.jsx';
import PomodoroWidget from './PomodoroWidget.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  // The Pomodoro floats over every signed-in page, including the full-screen video and review pages.
  return (
    <>
      <Outlet />
      <PomodoroWidget />
    </>
  );
}
