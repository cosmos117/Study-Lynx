import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import BrandMark from '../components/BrandMark.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import Sidebar from '../components/Sidebar.jsx';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const main = useRef(null);

  // Move keyboard and screen-reader focus to the new page when the route changes.
  useEffect(() => { main.current?.focus({ preventScroll: true }); }, [pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="lynx-page">
      <a href="#main" className="lynx-skip-link">Skip to content</a>
      <header className="lynx-header">
        <div className="lynx-header-inner">
          <Link to="/dashboard" className="lynx-logo-link">
            <BrandMark size={40} />
            Study Lynx
          </Link>
          <div className="lynx-header-actions">
            <span className="lynx-muted lynx-user-name">{user?.name}</span>
            <ThemeToggle />
            <button type="button" onClick={handleLogout} className="lynx-btn lynx-btn-ghost lynx-btn-sm">
              Log out
            </button>
          </div>
        </div>
      </header>
      <div className="lynx-shell">
        <Sidebar />
        <main id="main" ref={main} tabIndex={-1} className="lynx-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
