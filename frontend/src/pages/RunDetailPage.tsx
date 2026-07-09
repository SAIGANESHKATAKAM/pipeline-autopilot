import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { pipelineApi } from '../services/api'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import {
  Loader2,
  GitPullRequest,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  ArrowRight,
  Bot,
  Code2,
  FileCode2,
  GitBranch,
  Wrench,
} from 'lucide-react'

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
  fix_branch: string | null
  fix_applied: boolean
  created_at: string
}

const markdownComponents: Components = {
  h2: ({ children }) => (
    <h2 className="mt-6 border-b border-gray-800 pb-2 text-lg font-semibold text-white first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-sky-300">
      {children}
    </h3>
  ),
  p: ({ children }) => <p className="mt-2 leading-6 text-gray-300">{children}</p>,
  blockquote: ({ children }) => (
    <blockquote className="mt-3 border-l-4 border-yellow-400 bg-yellow-950/30 px-4 py-3 text-yellow-100">
      {children}
    </blockquote>
  ),
  ul: ({ children }) => <ul className="mt-3 space-y-2 text-gray-300">{children}</ul>,
  ol: ({ children }) => <ol className="mt-3 list-decimal space-y-2 pl-5 text-gray-300">{children}</ol>,
  li: ({ children }) => <li className="ml-4 list-disc pl-1">{children}</li>,
  table: ({ children }) => (
    <div className="mt-3 overflow-x-auto rounded-lg border border-gray-800">
      <table className="min-w-full divide-y divide-gray-800 text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-950/80">{children}</thead>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border-t border-gray-800 px-3 py-2 align-top text-gray-300">{children}</td>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-gray-950 px-1.5 py-0.5 font-mono text-xs text-sky-200">{children}</code>
  ),
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

  const shortSha = run.commit_sha.slice(0, 8)
  const affectedFileSummary = run.affected_files.length
    ? run.affected_files.join(', ')
    : 'The exact source file was not detected.'
  const flowSteps = [
    {
      label: 'Expected Code Path',
      detail: `The build tried to compile or test the changed code on ${run.branch}. Focus area: ${affectedFileSummary}`,
      icon: Code2,
      tone: 'border-sky-900/50 bg-sky-950/30 text-sky-100',
      iconTone: 'text-sky-300',
    },
    {
      label: 'Failure Point',
      detail: run.error_summary || 'The compiler, test runner, or build tool stopped at the failing code path.',
      icon: AlertCircle,
      tone: 'border-red-900/50 bg-red-950/30 text-red-200',
      iconTone: 'text-red-300',
    },
    {
      label: run.fix_applied ? 'Corrected Code Path' : 'Suggested Correction',
      detail: run.fix_applied
        ? 'The fix branch updates the broken code so the build can continue through that path.'
        : run.root_cause || 'The report explains what code needs to change before the build can pass.',
      icon: run.fix_applied ? Wrench : Bot,
      tone: run.fix_applied
        ? 'border-green-900/50 bg-green-950/30 text-green-100'
        : 'border-yellow-900/50 bg-yellow-950/30 text-yellow-100',
      iconTone: run.fix_applied ? 'text-green-300' : 'text-yellow-300',
    },
  ]

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

      <div className="mb-5 rounded-xl border border-gray-800 bg-gray-900 p-4">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Code Flow</p>
            <h2 className="text-base font-semibold text-white">What broke in the code and how it was fixed</h2>
          </div>
          <p className="font-mono text-xs text-gray-500">
            {run.branch} / {shortSha}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
          {flowSteps.map((step, index) => {
            const Icon = step.icon
            return (
              <div key={step.label} className="contents">
                <div className={`min-h-36 rounded-lg border p-4 ${step.tone}`}>
                  <div className="mb-3 flex items-center gap-2">
                    <Icon size={18} className={step.iconTone} />
                    <p className="font-semibold text-white">{step.label}</p>
                  </div>
                  <p className="line-clamp-4 text-sm leading-6">{step.detail}</p>
                </div>
                {index < flowSteps.length - 1 && (
                  <div className="flex items-center justify-center py-1 text-gray-600">
                    <ArrowRight className="hidden lg:block" size={20} />
                    <div className="h-5 w-px bg-gray-700 lg:hidden" />
                  </div>
                )}
              </div>
            )
          })}
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

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <FileCode2 size={17} className="text-sky-300" />
            Failure Location
          </div>
          {run.affected_files.length ? (
            <div className="space-y-2">
              {run.affected_files.map((file) => (
                <div key={file} className="break-all rounded-lg bg-gray-950 px-3 py-2 font-mono text-xs text-sky-200">
                  {file}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No exact file detected yet.</p>
          )}
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <Wrench size={17} className="text-green-300" />
            Fix Status
          </div>
          {run.fix_applied ? (
            <p className="text-sm text-gray-300">
              A fix was generated and opened as a pull request for review.
            </p>
          ) : (
            <p className="text-sm text-gray-500">The run was analyzed, but no automatic fix was opened.</p>
          )}
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <GitBranch size={17} className="text-violet-300" />
            Fix Branch
          </div>
          {run.fix_branch ? (
            <p className="break-all font-mono text-xs text-violet-200">{run.fix_branch}</p>
          ) : (
            <p className="text-sm text-gray-500">No fix branch created.</p>
          )}
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-gray-800 bg-gray-900 p-4">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
          <Code2 size={17} className="text-emerald-300" />
          Fix Map
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
          <div className="rounded-lg border border-red-900/40 bg-red-950/20 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-300">Failing Code Area</p>
            {run.affected_files.length ? (
              <div className="space-y-2">
                {run.affected_files.map((file) => (
                  <p key={file} className="break-all font-mono text-xs text-red-100">{file}</p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Unknown file</p>
            )}
          </div>

          <div className="flex justify-center text-gray-600">
            <ArrowRight className="hidden md:block" size={19} />
            <div className="h-5 w-px bg-gray-700 md:hidden" />
          </div>

          <div className="rounded-lg border border-violet-900/40 bg-violet-950/20 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-300">Code Change Branch</p>
            <p className="break-all font-mono text-xs text-violet-100">
              {run.fix_branch || 'No branch created'}
            </p>
          </div>

          <div className="flex justify-center text-gray-600">
            <ArrowRight className="hidden md:block" size={19} />
            <div className="h-5 w-px bg-gray-700 md:hidden" />
          </div>

          <div className="rounded-lg border border-green-900/40 bg-green-950/20 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-300">Fixed Code Review</p>
            {run.fix_pr_url ? (
              <a
                href={run.fix_pr_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-green-100 hover:text-green-300"
              >
                <GitPullRequest size={15} />
                Open fix PR
              </a>
            ) : (
              <p className="text-sm text-gray-500">No PR opened</p>
            )}
          </div>
        </div>
      </div>

      {run.ai_report && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Full AI Report</p>
          <div className="max-w-none break-words">
            <ReactMarkdown components={markdownComponents}>{run.ai_report}</ReactMarkdown>
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
