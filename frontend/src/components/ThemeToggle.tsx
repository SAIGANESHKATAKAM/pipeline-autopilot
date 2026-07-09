import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      title={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-800 bg-gray-900 px-3 text-xs font-medium text-gray-300 shadow-sm transition-colors hover:bg-gray-800 hover:text-white"
    >
      {isLight ? <Moon size={15} /> : <Sun size={15} />}
      <span className="hidden sm:inline">{isLight ? 'Dark' : 'Light'}</span>
    </button>
  )
}
