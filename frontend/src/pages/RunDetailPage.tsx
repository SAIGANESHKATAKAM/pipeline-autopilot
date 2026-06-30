import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { pipelineApi } from '../services/api'
import ReactMarkdown from 'react-markdown'
import { Loader2, GitPullRequest, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react'

interface RunDetail {
  id: number
  repo_full_name: string
  run_id: number
  workflow_name: string
  branch: string
  commit_sha: string
  commit_message: string
  status: string
  error_summary: string | null
  root_cause: string | null
  ai_report: string | null
  affected_files: string[]
  fix_pr_url: string | null
  fix_applied: boolean
  created_at: string
}

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [run, setRun] = useState<RunDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = () =>
      pipelineApi
        .getRunDetail(Number(id))
        .then((res) => setRun(res.data))
        .finally(() => setLoading(false))

    fetch()

    // Poll while analyzing
    const interval = setInterval(() => {
      if (run && ['analyzing', 'pending'].includes(run.status)) fetch()
    }, 5000)
    return () => clearInterval(interval)
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading...
      </div>
    )
  }

  if (!run) {
    return <div className="text-center text-gray-500 py-10">Run not found.</div>
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 mb-1 text-sm">
        <Link to="/" className="text-gray-500 hover:text-gray-300">Dashboard</Link>
        <span className="text-gray-600">/</span>
        <span className="text-white">Run #{run.run_id}</span>
      </div>

      {/* Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-white mb-1">{run.workflow_name}</h1>
            <p className="text-sm text-gray-400 font-mono">
              {run.repo_full_name} · {run.branch} · {run.commit_sha.slice(0, 8)}
            </p>
            {run.commit_message && (
              <p className="text-sm text-gray-500 mt-1 italic">"{run.commit_message}"</p>
            )}
          </div>
          <a
            href={`https://github.com/${run.repo_full_name}/actions/runs/${run.run_id}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-sky-400"
          >
            <ExternalLink size={13} />
            View on GitHub
          </a>
        </div>
      </div>

      {/* Status + PR */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Status</p>
          <div className="flex items-center gap-2">
            {run.status === 'fixed' ? (
              <CheckCircle size={18} className="text-green-400" />
            ) : run.status === 'analyzing' ? (
              <Loader2 size={18} className="text-sky-400 animate-spin" />
            ) : (
              <AlertCircle size={18} className="text-yellow-400" />
            )}
            <span className="text-white font-semibold capitalize">{run.status}</span>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Fix PR</p>
          {run.fix_pr_url ? (
            <a
              href={run.fix_pr_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sky-400 hover:underline font-semibold"
            >
              <GitPullRequest size={16} />
              View Pull Request
            </a>
          ) : (
            <span className="text-gray-500 text-sm">No auto-fix available</span>
          )}
        </div>
      </div>

      {/* Error Summary */}
      {run.error_summary && (
        <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-4 mb-5">
          <p className="text-xs text-red-400 font-semibold mb-1 uppercase tracking-wide">Error Summary</p>
          <p className="text-red-200">{run.error_summary}</p>
        </div>
      )}

      {/* Root Cause */}
      {run.root_cause && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
          <p className="text-xs text-yellow-400 font-semibold mb-1 uppercase tracking-wide">Root Cause</p>
          <p className="text-gray-300 text-sm">{run.root_cause}</p>
        </div>
      )}

      {/* Affected Files */}
      {run.affected_files.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
          <p className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wide">Affected Files</p>
          <div className="flex flex-wrap gap-2">
            {run.affected_files.map((f) => (
              <span key={f} className="font-mono text-xs bg-gray-800 text-sky-300 px-2 py-1 rounded">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Full AI Report */}
      {run.ai_report && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-500 font-semibold mb-3 uppercase tracking-wide">Full AI Report</p>
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{run.ai_report}</ReactMarkdown>
          </div>
        </div>
      )}

      {['analyzing', 'pending'].includes(run.status) && (
        <div className="mt-5 text-center text-gray-500 text-sm">
          <Loader2 className="animate-spin inline mr-2" size={14} />
          Analysis in progress... page will update automatically.
        </div>
      )}
    </div>
  )
}
