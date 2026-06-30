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
  fixed:     <CheckCircle size={15} className="text-green-400" />,
  analyzed:  <AlertCircle size={15} className="text-yellow-400" />,
  analyzing: <Loader2 size={15} className="text-sky-400 animate-spin" />,
  pending:   <Clock size={15} className="text-gray-400" />,
  error:     <AlertCircle size={15} className="text-red-400" />,
}

const statusLabel: Record<string, string> = {
  fixed: 'Fixed', analyzed: 'Analyzed', analyzing: 'Analyzing…',
  pending: 'Pending', error: 'Error', no_logs: 'No Logs',
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        {user && !user.app_installed && (
          <a
            href={appInstallUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <PackagePlus size={15} />
            Install GitHub App
          </a>
        )}
      </div>

      {/* Install App banner */}
      {user && !user.app_installed && (
        <div className="bg-sky-950/50 border border-sky-700/40 rounded-xl p-4 mb-6 flex items-start gap-4">
          <Rocket className="text-sky-400 mt-0.5 shrink-0" size={20} />
          <div>
            <p className="text-sky-200 font-semibold mb-1">Install the GitHub App to enable auto-fixing</p>
            <p className="text-sky-400 text-sm mb-3">
              Once installed, Pipeline Autopilot will automatically analyze every failed pipeline
              in your repos and open fix PRs — without you doing anything.
            </p>
            <a
              href={appInstallUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              <PackagePlus size={14} />
              Install on GitHub
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Total Runs', value: stats.total, color: 'text-white' },
          { label: 'Auto-Fixed', value: stats.fixed, color: 'text-green-400' },
          { label: 'Analyzed', value: stats.analyzed, color: 'text-yellow-400' },
          { label: 'In Progress', value: stats.pending, color: 'text-sky-400' },
          { label: 'Repos Tracked', value: stats.repos, color: 'text-purple-400' },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs mb-1">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Runs table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold text-white">Pipeline Runs</h2>
          <Link to="/repos" className="text-xs text-sky-400 hover:underline">
            Browse Repos →
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <Loader2 className="animate-spin mx-auto mb-2" size={24} />
            Loading…
          </div>
        ) : runs.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-gray-500 mb-2">No pipeline runs yet.</p>
            <p className="text-gray-600 text-sm">
              {user?.app_installed
                ? 'Trigger a failing pipeline in any of your repos to see it here.'
                : 'Install the GitHub App first, then trigger a failing pipeline.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800 uppercase tracking-wide">
                  <th className="text-left px-5 py-3">Repository</th>
                  <th className="text-left px-5 py-3">Workflow</th>
                  <th className="text-left px-5 py-3">Branch</th>
                  <th className="text-left px-5 py-3">Error</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Fix PR</th>
                  <th className="text-left px-5 py-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b border-gray-800/60 hover:bg-gray-800/40 transition-colors">
                    <td className="px-5 py-3">
                      <Link to={`/runs/${run.id}`} className="font-mono text-xs text-sky-400 hover:underline">
                        {run.repo_full_name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-300 text-xs">{run.workflow_name}</td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{run.branch}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs max-w-xs truncate">
                      {run.error_summary || '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5">
                        {statusIcon[run.status] ?? statusIcon.pending}
                        <span className="text-gray-300 text-xs">
                          {statusLabel[run.status] ?? run.status}
                        </span>
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {run.fix_pr_url ? (
                        <a href={run.fix_pr_url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-sky-400 hover:underline text-xs">
                          <GitPullRequest size={13} /> View PR
                        </a>
                      ) : <span className="text-gray-700 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3 text-gray-600 text-xs">
                      {new Date(run.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
