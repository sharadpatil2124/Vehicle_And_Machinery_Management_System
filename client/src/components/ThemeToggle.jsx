import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      aria-pressed={isDark}
      className={`rounded p-1.5 text-steel-500 transition-colors hover:bg-steel-100 hover:text-steel-900 ${className}`}
    >
      {isDark ? (
        <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10" cy="10" r="3.5" />
          <path d="M10 1.75v1.5M10 16.75v1.5M3.17 3.17l1.06 1.06M15.77 15.77l1.06 1.06M1.75 10h1.5M16.75 10h1.5M3.17 16.83l1.06-1.06M15.77 4.23l1.06-1.06" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16.5 12.2A7 7 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7Z" />
        </svg>
      )}
    </button>
  );
}
