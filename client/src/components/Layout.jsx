import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, LogOut, Shield } from 'lucide-react';

function getUser() {
  try { return JSON.parse(localStorage.getItem('gv_user') || 'null'); } catch { return null; }
}

export default function Layout() {
  const navigate = useNavigate();
  const user = getUser();

  function logout() {
    localStorage.removeItem('gv_token');
    localStorage.removeItem('gv_user');
    navigate('/login');
  }

  const navClass = ({ isActive }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-600 text-white'
        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
    }`;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 flex flex-col shrink-0">
        <div className="px-4 py-5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Shield className="text-blue-400 w-6 h-6" />
            <span className="text-white font-bold text-lg tracking-tight">GuardianView</span>
          </div>
          {user && (
            <p className="text-slate-400 text-xs mt-1 truncate">{user.username} · {user.role}</p>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLink to="/dashboard" className={navClass}>
            <LayoutDashboard size={16} /> Dashboard
          </NavLink>
          {(user?.role === 'admin' || user?.role === 'nurse') && (
            <NavLink to="/manage" className={navClass}>
              <Users size={16} /> Manage Campers
            </NavLink>
          )}
        </nav>

        <div className="px-3 py-4 border-t border-slate-700">
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-700 w-full transition-colors"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
