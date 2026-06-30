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
      <div className="flex items-center gap-2 mb-1">
        <Link to="/repos" className="text-gray-500 hover:text-gray-300 text-sm">
          Repositories
        </Link>
        <span className="text-gray-600">/</span>
        <span className="text-white font-semibold">{repoFullName}</span>
      </div>
      <h1 className="text-2xl font-bold text-white mb-6">Failed Pipeline Runs</h1>

      {loading ? (
        <div className="text-center text-gray-500 py-10">
          <Loader2 className="animate-spin mx-auto mb-2" size={24} />
          Loading runs...
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center text-gray-500 py-10">
          <AlertCircle className="mx-auto mb-2 text-green-400" size={32} />
          <p>No failed runs found. All pipelines are green!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <div key={run.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle size={15} className="text-red-400" />
                    <span className="font-semibold text-white">{run.name}</span>
                    <a href={run.html_url} target="_blank" rel="noreferrer">
                      <ExternalLink size={13} className="text-gray-500 hover:text-sky-400" />
                    </a>
                  </div>
                  <p className="text-sm text-gray-400 mb-1 line-clamp-1">{run.head_commit}</p>
                  <p className="text-xs text-gray-600 font-mono">
                    {run.head_branch} · {run.head_sha.slice(0, 8)} ·{' '}
                    {new Date(run.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="ml-4">
                  {analyzed.has(run.id) ? (
                    <Link
                      to="/"
                      className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1.5 rounded-lg hover:bg-green-500/20 transition-colors"
                    >
                      View in Dashboard →
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleAnalyze(run)}
                      disabled={analyzing === run.id}
                      className="flex items-center gap-2 text-xs bg-sky-600 hover:bg-sky-500 disabled:bg-gray-700 text-white px-3 py-1.5 rounded-lg transition-colors"
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
