import { Navigate, Outlet } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
