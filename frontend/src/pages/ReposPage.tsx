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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-white">Repositories</h1>
        {user && !user.app_installed && (
          <a
            href={installUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm text-white transition-colors hover:bg-sky-500"
          >
            <PackagePlus size={14} />
            Install App on GitHub
            <ExternalLink size={12} />
          </a>
        )}
      </div>

      {user?.app_installed && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-green-800/30 bg-green-950/40 px-4 py-3 sm:items-center">
          <CheckCircle size={16} className="mt-0.5 shrink-0 text-green-400 sm:mt-0" />
          <p className="text-sm text-green-300">
            GitHub App is installed. Pipeline Autopilot is actively monitoring your repos.
          </p>
        </div>
      )}

      <div className="relative mb-5">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Search repositories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-900 py-2.5 pl-9 pr-4 text-sm text-white placeholder-gray-500 focus:border-sky-500 focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="py-10 text-center text-gray-500">
          <Loader2 className="mx-auto mb-2 animate-spin" size={24} />
          Loading repositories...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((repo) => (
            <Link
              key={repo.id}
              to={`/repos/${repo.full_name}`}
              className="group rounded-xl border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-sky-500/50"
            >
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  {repo.private ? (
                    <Lock size={13} className="shrink-0 text-yellow-500" />
                  ) : (
                    <Globe size={13} className="shrink-0 text-gray-500" />
                  )}
                  <span className="truncate font-mono text-sm text-sky-400 group-hover:underline">
                    {repo.full_name}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:ml-2 sm:shrink-0 sm:justify-end">
                  {repo.language && (
                    <span className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-500">
                      {repo.language}
                    </span>
                  )}
                  {repo.app_installed && (
                    <span className="flex items-center gap-1 rounded border border-green-800/30 bg-green-900/30 px-2 py-0.5 text-xs text-green-400">
                      <CheckCircle size={10} /> Active
                    </span>
                  )}
                </div>
              </div>
              {repo.description && (
                <p className="mb-2 line-clamp-2 text-xs text-gray-400">{repo.description}</p>
              )}
              <p className="text-xs text-gray-600">
                Branch: <span className="text-gray-500">{repo.default_branch}</span>
                {' - '}
                Updated: <span className="text-gray-500">{new Date(repo.updated_at).toLocaleDateString()}</span>
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
