import { GitBranch, Github } from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'

export default function LoginPage() {
  const handleLogin = () => {
    const base = import.meta.env.VITE_API_URL ?? '/api'
    window.location.href = `${base}/auth/github/login`
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center shadow-2xl sm:p-10">
        <div className="flex justify-center mb-4">
          <div className="bg-sky-500/10 p-4 rounded-2xl">
            <GitBranch className="text-sky-400" size={40} />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Pipeline Autopilot</h1>
        <p className="text-gray-400 mb-8 text-sm">
          AI-powered CI/CD failure analyzer. Automatically detects what broke, explains why, and opens a fix PR.
        </p>

        <button
          onClick={handleLogin}
          className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-6 py-3 font-semibold text-gray-900 transition-colors hover:bg-gray-100"
        >
          <Github size={20} />
          Sign in with GitHub
        </button>

        <p className="text-xs text-gray-600 mt-6">
          We request <strong className="text-gray-500">repo + workflow</strong> scope to read pipeline logs and create fix PRs.
        </p>
      </div>
    </div>
  )
}
