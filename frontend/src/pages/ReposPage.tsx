import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { reposApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { Search, Lock, Globe, Loader2, CheckCircle, PackagePlus, ExternalLink } from 'lucide-react'

interface Repo {
  id: number
  full_name: string
  name: string
  private: boolean
  default_branch: string
  html_url: string
  description: string | null
  language: string | null
  updated_at: string
  app_installed: boolean
}

export default function ReposPage() {
  const { user } = useAuth()
  const [repos, setRepos] = useState<Repo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    reposApi.list().then((res) => setRepos(res.data)).finally(() => setLoading(false))
  }, [])

  const filtered = repos.filter(
    (r) =>
      r.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.description || '').toLowerCase().includes(search.toLowerCase())
  )

  const installUrl = `https://github.com/apps/pipeline-autopilot/installations/new`

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Repositories</h1>
        {user && !user.app_installed && (
          <a
            href={installUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <PackagePlus size={14} />
            Install App on GitHub
            <ExternalLink size={12} />
          </a>
        )}
      </div>

      {user?.app_installed && (
        <div className="bg-green-950/40 border border-green-800/30 rounded-xl px-4 py-3 mb-5 flex items-center gap-2">
          <CheckCircle size={16} className="text-green-400" />
          <p className="text-green-300 text-sm">
            GitHub App is installed. Pipeline Autopilot is actively monitoring your repos.
          </p>
        </div>
      )}

      <div className="relative mb-5">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Search repositories…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500"
        />
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-10">
          <Loader2 className="animate-spin mx-auto mb-2" size={24} />
          Loading repositories…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((repo) => (
            <Link
              key={repo.id}
              to={`/repos/${repo.full_name}`}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-sky-500/50 transition-colors group"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {repo.private
                    ? <Lock size={13} className="text-yellow-500 shrink-0" />
                    : <Globe size={13} className="text-gray-500 shrink-0" />}
                  <span className="font-mono text-sm text-sky-400 group-hover:underline truncate">
                    {repo.full_name}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  {repo.language && (
                    <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                      {repo.language}
                    </span>
                  )}
                  {repo.app_installed && (
                    <span className="flex items-center gap-1 text-xs text-green-400 bg-green-900/30 border border-green-800/30 px-2 py-0.5 rounded">
                      <CheckCircle size={10} /> Active
                    </span>
                  )}
                </div>
              </div>
              {repo.description && (
                <p className="text-gray-400 text-xs mb-2 line-clamp-2">{repo.description}</p>
              )}
              <p className="text-xs text-gray-600">
                Branch: <span className="text-gray-500">{repo.default_branch}</span>
                {' · '}
                Updated: <span className="text-gray-500">{new Date(repo.updated_at).toLocaleDateString()}</span>
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
