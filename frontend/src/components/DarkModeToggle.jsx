import './DarkModeToggle.css';

export default function DarkModeToggle({ isDark, onToggle }) {
  return (
    <button
      className="dark-toggle"
      onClick={onToggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}
