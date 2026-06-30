import { GitBranch, Github } from 'lucide-react'

export default function LoginPage() {
  const handleLogin = () => {
    const base = import.meta.env.VITE_API_URL ?? '/api'
    window.location.href = `${base}/auth/github/login`
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 w-full max-w-md text-center shadow-2xl">
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
          className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-semibold py-3 px-6 rounded-lg hover:bg-gray-100 transition-colors"
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
