import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';

// `prefixes` keeps an item highlighted on the pages that belong to it
// (e.g. exams, topics and the Topic Learning Hub all live under Subjects).
const navigation = [
  { to: '/dashboard', label: 'Dashboard', icon: '⌂', prefixes: ['/dashboard'] },
  { to: '/plan', label: 'My Plan', icon: '✓', prefixes: ['/plan', '/study-session'] },
  { to: '/subjects', label: 'Subjects', icon: '▦', prefixes: ['/subjects', '/exams', '/topics'] },
  { to: '/recall', label: 'Active Recall', icon: '↻', prefixes: ['/recall'] },
  { to: '/quizzes', label: 'Quizzes', icon: '?', prefixes: ['/quizzes'] },
  { to: '/ai-tutor', label: 'AI Tutor', icon: '✦', prefixes: ['/ai-tutor'] },
  { to: '/materials', label: 'Materials', icon: '▤', prefixes: ['/materials'] },
  { to: '/analytics', label: 'Analytics', icon: '↗', prefixes: ['/analytics'] },
  { to: '/settings', label: 'Settings', icon: '⚙', prefixes: ['/settings'] },
];

const isActive = (pathname, prefixes) => prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export default function Sidebar() {
  const { pathname } = useLocation();
  const nav = useRef(null);

  // On small screens the menu scrolls sideways; keep the current page in view.
  useEffect(() => {
    const active = nav.current?.querySelector('[aria-current="page"]');
    const container = nav.current;
    if (active && container && container.scrollWidth > container.clientWidth) {
      container.scrollTo({ left: active.offsetLeft - 16, behavior: 'auto' });
    }
  }, [pathname]);

  return (
    <aside className="lynx-sidebar">
      <p className="lynx-muted lynx-eyebrow">Study workspace</p>
      <nav ref={nav} className="lynx-nav lynx-section-gap" aria-label="Primary">
        {navigation.map((item) => {
          const active = isActive(pathname, item.prefixes);
          return (
            <Link key={item.to} to={item.to} aria-current={active ? 'page' : undefined} className={`lynx-navlink ${active ? 'lynx-navlink-active' : ''}`}>
              <span className="lynx-icon-box" aria-hidden="true">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
