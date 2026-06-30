import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { GitBranch, LayoutDashboard, BookOpen, LogOut, CheckCircle, PackagePlus } from 'lucide-react'

export default function Layout() {
  const { user, logout } = useAuth()
  const installUrl = `https://github.com/apps/pipeline-autopilot/installations/new`

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-60 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="p-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <GitBranch className="text-sky-400" size={22} />
            <span className="font-bold text-white text-lg">Autopilot</span>
          </div>
          <p className="text-gray-500 text-xs mt-1">AI Pipeline Fixer</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          <NavLink to="/" end className={navClass}>
            <LayoutDashboard size={15} /> Dashboard
          </NavLink>
          <NavLink to="/repos" className={navClass}>
            <BookOpen size={15} /> Repositories
          </NavLink>
        </nav>

        {/* App install status */}
        {user && (
          <div className="px-4 pb-3">
            {user.app_installed ? (
              <div className="flex items-center gap-2 bg-green-900/20 border border-green-800/30 rounded-lg px-3 py-2">
                <CheckCircle size={13} className="text-green-400 shrink-0" />
                <span className="text-xs text-green-300">App installed</span>
              </div>
            ) : (
              <a
                href={installUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 bg-sky-900/30 border border-sky-700/40 rounded-lg px-3 py-2 hover:bg-sky-900/50 transition-colors"
              >
                <PackagePlus size={13} className="text-sky-400 shrink-0" />
                <span className="text-xs text-sky-300">Install GitHub App</span>
              </a>
            )}
          </div>
        )}

        {/* User */}
        {user && (
          <div className="p-4 border-t border-gray-800 flex items-center gap-3">
            {user.avatar_url && (
              <img src={user.avatar_url} alt={user.username} className="w-8 h-8 rounded-full" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.username}</p>
              <p className="text-xs text-gray-500 truncate">{user.email ?? 'GitHub user'}</p>
            </div>
            <button onClick={logout} title="Logout" className="text-gray-500 hover:text-red-400 transition-colors">
              <LogOut size={15} />
            </button>
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-y-auto p-6 bg-gray-950">
        <Outlet />
      </main>
    </div>
  )
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
    isActive ? 'bg-sky-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
  }`
