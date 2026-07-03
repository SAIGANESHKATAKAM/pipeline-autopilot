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

    const interval = setInterval(() => {
      if (run && ['analyzing', 'pending'].includes(run.status)) fetch()
    }, 5000)
    return () => clearInterval(interval)
  }, [id])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        <Loader2 className="mr-2 animate-spin" size={20} />
        Loading...
      </div>
    )
  }

  if (!run) {
    return <div className="py-10 text-center text-gray-500">Run not found.</div>
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-1 flex min-w-0 items-center gap-2 text-sm">
        <Link to="/" className="shrink-0 text-gray-500 hover:text-gray-300">Dashboard</Link>
        <span className="shrink-0 text-gray-600">/</span>
        <span className="truncate text-white">Run #{run.run_id}</span>
      </div>

      <div className="mb-5 rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="mb-1 break-words text-xl font-bold text-white">{run.workflow_name}</h1>
            <p className="break-words font-mono text-sm text-gray-400">
              {run.repo_full_name} - {run.branch} - {run.commit_sha.slice(0, 8)}
            </p>
            {run.commit_message && (
              <p className="mt-1 break-words text-sm italic text-gray-500">"{run.commit_message}"</p>
            )}
          </div>
          <a
            href={`https://github.com/${run.repo_full_name}/actions/runs/${run.run_id}`}
            target="_blank"
            rel="noreferrer"
            className="flex shrink-0 items-center gap-1 text-xs text-gray-500 hover:text-sky-400"
          >
            <ExternalLink size={13} />
            View on GitHub
          </a>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="mb-1 text-xs text-gray-500">Status</p>
          <div className="flex items-center gap-2">
            {run.status === 'fixed' ? (
              <CheckCircle size={18} className="text-green-400" />
            ) : run.status === 'analyzing' ? (
              <Loader2 size={18} className="animate-spin text-sky-400" />
            ) : (
              <AlertCircle size={18} className="text-yellow-400" />
            )}
            <span className="font-semibold capitalize text-white">{run.status}</span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="mb-1 text-xs text-gray-500">Fix PR</p>
          {run.fix_pr_url ? (
            <a
              href={run.fix_pr_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 break-words font-semibold text-sky-400 hover:underline"
            >
              <GitPullRequest size={16} />
              View Pull Request
            </a>
          ) : (
            <span className="text-sm text-gray-500">No auto-fix available</span>
          )}
        </div>
      </div>

      {run.error_summary && (
        <div className="mb-5 rounded-xl border border-red-900/40 bg-red-950/30 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-400">Error Summary</p>
          <p className="break-words text-red-200">{run.error_summary}</p>
        </div>
      )}

      {run.root_cause && (
        <div className="mb-5 rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-yellow-400">Root Cause</p>
          <p className="break-words text-sm text-gray-300">{run.root_cause}</p>
        </div>
      )}

      {run.affected_files.length > 0 && (
        <div className="mb-5 rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Affected Files</p>
          <div className="flex flex-wrap gap-2">
            {run.affected_files.map((f) => (
              <span key={f} className="max-w-full break-all rounded bg-gray-800 px-2 py-1 font-mono text-xs text-sky-300">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {run.ai_report && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Full AI Report</p>
          <div className="prose prose-invert prose-sm max-w-none break-words">
            <ReactMarkdown>{run.ai_report}</ReactMarkdown>
          </div>
        </div>
      )}

      {['analyzing', 'pending'].includes(run.status) && (
        <div className="mt-5 text-center text-sm text-gray-500">
          <Loader2 className="mr-2 inline animate-spin" size={14} />
          Analysis in progress... page will update automatically.
        </div>
      )}
    </div>
  )
}
