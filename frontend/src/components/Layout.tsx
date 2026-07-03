import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { GitBranch, LayoutDashboard, BookOpen, LogOut, CheckCircle, PackagePlus } from 'lucide-react'

export default function Layout() {
  const { user, logout } = useAuth()
  const installUrl = `https://github.com/apps/pipeline-autopilot/installations/new`

  return (
    <div className="min-h-screen bg-gray-950 md:flex">
      <aside className="bg-gray-900 border-b border-gray-800 md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
        {/* Logo */}
        <div className="flex items-center justify-between gap-4 border-b border-gray-800 p-4 md:block md:p-5">
          <div className="flex items-center gap-2">
            <GitBranch className="shrink-0 text-sky-400" size={22} />
            <span className="font-bold text-white text-lg">Autopilot</span>
          </div>
          <p className="hidden text-gray-500 text-xs mt-1 md:block">AI Pipeline Fixer</p>
          {user && (
            <button
              onClick={logout}
              title="Logout"
              className="text-gray-500 transition-colors hover:text-red-400 md:hidden"
            >
              <LogOut size={17} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex gap-2 overflow-x-auto p-3 md:flex-1 md:flex-col md:space-y-1 md:overflow-visible md:p-4">
          <NavLink to="/" end className={navClass}>
            <LayoutDashboard size={15} /> Dashboard
          </NavLink>
          <NavLink to="/repos" className={navClass}>
            <BookOpen size={15} /> Repositories
          </NavLink>
        </nav>

        {/* App install status */}
        {user && (
          <div className="hidden px-4 pb-3 md:block">
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
          <div className="hidden p-4 border-t border-gray-800 md:flex items-center gap-3">
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

      <main className="min-w-0 flex-1 p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  )
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors md:gap-3 ${
    isActive ? 'bg-sky-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
  }`
