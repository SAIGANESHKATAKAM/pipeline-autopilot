import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { pipelineApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import {
  AlertCircle, CheckCircle, Clock, Loader2,
  GitPullRequest, Rocket, ExternalLink, PackagePlus,
} from 'lucide-react'

interface PipelineRun {
  id: number
  repo_full_name: string
  run_id: number
  workflow_name: string
  branch: string
  commit_sha: string
  commit_message: string
  status: string
  error_summary: string | null
  fix_pr_url: string | null
  fix_applied: boolean
  created_at: string
}

interface Stats {
  total: number
  fixed: number
  analyzed: number
  pending: number
  repos: number
}

const statusIcon: Record<string, JSX.Element> = {
  fixed: <CheckCircle size={15} className="text-green-400" />,
  analyzed: <AlertCircle size={15} className="text-yellow-400" />,
  analyzing: <Loader2 size={15} className="animate-spin text-sky-400" />,
  pending: <Clock size={15} className="text-gray-400" />,
  error: <AlertCircle size={15} className="text-red-400" />,
}

const statusLabel: Record<string, string> = {
  fixed: 'Fixed',
  analyzed: 'Analyzed',
  analyzing: 'Analyzing...',
  pending: 'Pending',
  error: 'Error',
  no_logs: 'No Logs',
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [runs, setRuns] = useState<PipelineRun[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, fixed: 0, analyzed: 0, pending: 0, repos: 0 })
  const [loading, setLoading] = useState(true)

  const fetchData = () => {
    Promise.all([pipelineApi.getRuns(), pipelineApi.getStats()])
      .then(([runsRes, statsRes]) => {
        setRuns(runsRes.data)
        setStats(statsRes.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 8000)
    return () => clearInterval(interval)
  }, [])

  const appInstallUrl = `https://github.com/apps/pipeline-autopilot/installations/new`

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        {user && !user.app_installed && (
          <a
            href={appInstallUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm text-white transition-colors hover:bg-sky-500"
          >
            <PackagePlus size={15} />
            Install GitHub App
          </a>
        )}
      </div>

      {user && !user.app_installed && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-sky-700/40 bg-sky-950/50 p-4 sm:gap-4">
          <Rocket className="mt-0.5 shrink-0 text-sky-400" size={20} />
          <div className="min-w-0">
            <p className="mb-1 font-semibold text-sky-200">Install the GitHub App to enable auto-fixing</p>
            <p className="mb-3 text-sm text-sky-400">
              Once installed, Pipeline Autopilot will automatically analyze every failed pipeline
              in your repos and open fix PRs - without you doing anything.
            </p>
            <a
              href={appInstallUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm text-white transition-colors hover:bg-sky-500"
            >
              <PackagePlus size={14} />
              Install on GitHub
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
        {[
          { label: 'Total Runs', value: stats.total, color: 'text-white' },
          { label: 'Auto-Fixed', value: stats.fixed, color: 'text-green-400' },
          { label: 'Analyzed', value: stats.analyzed, color: 'text-yellow-400' },
          { label: 'In Progress', value: stats.pending, color: 'text-sky-400' },
          { label: 'Repos Tracked', value: stats.repos, color: 'text-purple-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-800 bg-gray-900 p-3 sm:p-4">
            <p className="mb-1 text-xs text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold sm:text-3xl ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
        <div className="flex items-center justify-between gap-3 border-b border-gray-800 px-4 py-4 sm:px-5">
          <h2 className="font-semibold text-white">Pipeline Runs</h2>
          <Link to="/repos" className="text-xs text-sky-400 hover:underline">
            Browse Repos {'->'}
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <Loader2 className="mx-auto mb-2 animate-spin" size={24} />
            Loading...
          </div>
        ) : runs.length === 0 ? (
          <div className="p-8 text-center sm:p-10">
            <p className="mb-2 text-gray-500">No pipeline runs yet.</p>
            <p className="text-sm text-gray-600">
              {user?.app_installed
                ? 'Trigger a failing pipeline in any of your repos to see it here.'
                : 'Install the GitHub App first, then trigger a failing pipeline.'}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-800 md:hidden">
              {runs.map((run) => (
                <Link
                  key={run.id}
                  to={`/runs/${run.id}`}
                  className="block p-4 transition-colors hover:bg-gray-800/40"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-sky-400">{run.repo_full_name}</p>
                      <p className="mt-1 truncate text-sm font-medium text-white">{run.workflow_name}</p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-gray-800 px-2 py-1">
                      {statusIcon[run.status] ?? statusIcon.pending}
                      <span className="text-xs text-gray-300">
                        {statusLabel[run.status] ?? run.status}
                      </span>
                    </span>
                  </div>
                  <p className="mb-2 line-clamp-2 text-xs text-gray-400">
                    {run.error_summary || 'No error summary'}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                    <span className="font-mono text-gray-500">{run.branch}</span>
                    <span>{new Date(run.created_at).toLocaleString()}</span>
                    {run.fix_pr_url && (
                      <span className="inline-flex items-center gap-1 text-sky-400">
                        <GitPullRequest size={13} /> PR ready
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-3 text-left">Repository</th>
                    <th className="px-5 py-3 text-left">Workflow</th>
                    <th className="px-5 py-3 text-left">Branch</th>
                    <th className="px-5 py-3 text-left">Error</th>
                    <th className="px-5 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-left">Fix PR</th>
                    <th className="px-5 py-3 text-left">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="border-b border-gray-800/60 transition-colors hover:bg-gray-800/40">
                      <td className="px-5 py-3">
                        <Link to={`/runs/${run.id}`} className="font-mono text-xs text-sky-400 hover:underline">
                          {run.repo_full_name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-300">{run.workflow_name}</td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">{run.branch}</td>
                      <td className="max-w-xs truncate px-5 py-3 text-xs text-gray-400">
                        {run.error_summary || '-'}
                      </td>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-1.5">
                          {statusIcon[run.status] ?? statusIcon.pending}
                          <span className="text-xs text-gray-300">
                            {statusLabel[run.status] ?? run.status}
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {run.fix_pr_url ? (
                          <a
                            href={run.fix_pr_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-sky-400 hover:underline"
                          >
                            <GitPullRequest size={13} /> View PR
                          </a>
                        ) : (
                          <span className="text-xs text-gray-700">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-600">
                        {new Date(run.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
