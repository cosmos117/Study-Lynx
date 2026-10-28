import { useTheme } from '../theme/ThemeContext.jsx';

export default function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      className="lynx-btn lynx-btn-ghost lynx-btn-sm"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span aria-hidden="true">{isDark ? '☀' : '☾'}</span>
      <span>{isDark ? 'Light' : 'Night'}</span>
    </button>
  );
}

