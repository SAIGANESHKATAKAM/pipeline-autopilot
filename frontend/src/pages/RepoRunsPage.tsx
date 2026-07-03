import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { reposApi, pipelineApi } from '../services/api'
import { AlertCircle, Loader2, Play, ExternalLink } from 'lucide-react'

interface WorkflowRun {
  id: number
  name: string
  status: string
  conclusion: string
  head_branch: string
  head_sha: string
  head_commit: string
  created_at: string
  html_url: string
}

export default function RepoRunsPage() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>()
  const repoFullName = `${owner}/${repo}`
  const [runs, setRuns] = useState<WorkflowRun[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState<number | null>(null)
  const [analyzed, setAnalyzed] = useState<Set<number>>(new Set())

  useEffect(() => {
    reposApi
      .getRuns(owner!, repo!, 'failure')
      .then((res) => setRuns(res.data))
      .finally(() => setLoading(false))
  }, [owner, repo])

  const handleAnalyze = async (run: WorkflowRun) => {
    setAnalyzing(run.id)
    try {
      await pipelineApi.analyze({
        repo_full_name: repoFullName,
        run_id: run.id,
        workflow_name: run.name,
        branch: run.head_branch,
        commit_sha: run.head_sha,
        commit_message: run.head_commit,
      })
      setAnalyzed((prev) => new Set([...prev, run.id]))
    } catch (e) {
      alert('Failed to start analysis')
    } finally {
      setAnalyzing(null)
    }
  }

  return (
    <div>
      <div className="mb-1 flex min-w-0 items-center gap-2 text-sm">
        <Link to="/repos" className="shrink-0 text-gray-500 hover:text-gray-300">
          Repositories
        </Link>
        <span className="shrink-0 text-gray-600">/</span>
        <span className="truncate font-semibold text-white">{repoFullName}</span>
      </div>
      <h1 className="mb-6 text-2xl font-bold text-white">Failed Pipeline Runs</h1>

      {loading ? (
        <div className="py-10 text-center text-gray-500">
          <Loader2 className="mx-auto mb-2 animate-spin" size={24} />
          Loading runs...
        </div>
      ) : runs.length === 0 ? (
        <div className="py-10 text-center text-gray-500">
          <AlertCircle className="mx-auto mb-2 text-green-400" size={32} />
          <p>No failed runs found. All pipelines are green!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <div key={run.id} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0 text-red-400" />
                    <span className="truncate font-semibold text-white">{run.name}</span>
                    <a href={run.html_url} target="_blank" rel="noreferrer">
                      <ExternalLink size={13} className="text-gray-500 hover:text-sky-400" />
                    </a>
                  </div>
                  <p className="mb-1 line-clamp-2 text-sm text-gray-400 sm:line-clamp-1">{run.head_commit}</p>
                  <p className="break-words font-mono text-xs text-gray-600">
                    {run.head_branch} - {run.head_sha.slice(0, 8)} -{' '}
                    {new Date(run.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="sm:ml-4">
                  {analyzed.has(run.id) ? (
                    <Link
                      to="/"
                      className="inline-flex w-full justify-center rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-1.5 text-xs text-green-400 transition-colors hover:bg-green-500/20 sm:w-auto"
                    >
                      View in Dashboard ->
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleAnalyze(run)}
                      disabled={analyzing === run.id}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-sky-500 disabled:bg-gray-700 sm:w-auto"
                    >
                      {analyzing === run.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Play size={13} />
                      )}
                      {analyzing === run.id ? 'Starting...' : 'Analyze & Fix'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
