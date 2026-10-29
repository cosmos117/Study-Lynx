import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { flashcardAPI } from '../services/api.js';

// Three places to go: Home for today, Subjects for studying a topic, Review for due flashcards.
// `prefixes` keeps an item highlighted on all of its pages, e.g. a topic page lives under Subjects.
const navigation = [
  { to: '/dashboard', label: 'Home', icon: '⌂', prefixes: ['/dashboard'] },
  { to: '/subjects', label: 'Subjects', icon: '▦', prefixes: ['/subjects', '/topics'] },
  { to: '/recall', label: 'Review', icon: '↻', prefixes: ['/recall'], badge: 'due' },
];
const settings = { to: '/settings', label: 'Settings', icon: '⚙', prefixes: ['/settings'] };

const isActive = (pathname, prefixes) => prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

const COLLAPSED_KEY = 'lynx_sidebar_collapsed';

function readCollapsed() {
  try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
}

export default function Sidebar() {
  const { pathname } = useLocation();
  const nav = useRef(null);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [dueCount, setDueCount] = useState(0);

  // Refresh the due-card badge on every page change, so it drops as cards are reviewed.
  useEffect(() => {
    flashcardAPI.dueCount().then(({ data }) => setDueCount(data.data.count)).catch(() => {});
  }, [pathname]);

  const toggle = () => {
    setCollapsed((value) => {
      try { localStorage.setItem(COLLAPSED_KEY, value ? '0' : '1'); } catch { /* storage unavailable: keep in memory only */ }
      return !value;
    });
  };

  // On small screens the menu scrolls sideways; keep the current page in view.
  useEffect(() => {
    const active = nav.current?.querySelector('[aria-current="page"]');
    const container = nav.current;
    if (active && container && container.scrollWidth > container.clientWidth) {
      container.scrollTo({ left: active.offsetLeft - 16, behavior: 'auto' });
    }
  }, [pathname]);

  const renderLink = (item) => {
    const active = isActive(pathname, item.prefixes);
    return (
      <Link key={item.to} to={item.to} aria-current={active ? 'page' : undefined} title={collapsed ? item.label : undefined} className={`lynx-navlink ${active ? 'lynx-navlink-active' : ''}`}>
        <span className="lynx-icon-box" aria-hidden="true">{item.icon}</span>
        <span className="lynx-navlabel">{item.label}</span>
        {item.badge === 'due' && dueCount > 0 && <span className="lynx-nav-badge" aria-label={`${dueCount} due`}>{dueCount}</span>}
      </Link>
    );
  };

  return (
    <aside className={`lynx-sidebar ${collapsed ? 'lynx-sidebar-collapsed' : ''}`}>
      <div className="lynx-sidebar-top">
        <p className="lynx-muted lynx-eyebrow">Menu</p>
        <button type="button" className="lynx-sidebar-toggle" onClick={toggle} aria-expanded={!collapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16" />
            {collapsed ? <path d="M14 9l3 3-3 3" /> : <path d="M17 9l-3 3 3 3" />}
          </svg>
        </button>
      </div>
      <nav ref={nav} className="lynx-nav lynx-section-gap" aria-label="Primary">
        {navigation.map((item) => renderLink(item))}
      </nav>
      <div className="lynx-sidebar-footer">{renderLink(settings)}</div>
    </aside>
  );
}
