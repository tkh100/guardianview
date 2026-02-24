import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, LogOut, Shield, UserCog } from 'lucide-react';

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

  const mobileNavClass = ({ isActive }) =>
    `flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-medium transition-colors ${
      isActive ? 'text-blue-400' : 'text-slate-400'
    }`;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex w-56 bg-slate-900 flex-col shrink-0">
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
          {user?.role === 'admin' && (
            <NavLink to="/staff" className={navClass}>
              <UserCog size={16} /> Staff Accounts
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
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* Bottom tab bar — mobile only */}
      <nav className="flex md:hidden fixed bottom-0 inset-x-0 z-50 bg-slate-900 border-t border-slate-700">
        <NavLink to="/dashboard" className={mobileNavClass}>
          <LayoutDashboard size={22} />
          <span>Dashboard</span>
        </NavLink>
        {(user?.role === 'admin' || user?.role === 'nurse') && (
          <NavLink to="/manage" className={mobileNavClass}>
            <Users size={22} />
            <span>Manage</span>
          </NavLink>
        )}
        {user?.role === 'admin' && (
          <NavLink to="/staff" className={mobileNavClass}>
            <UserCog size={22} />
            <span>Staff</span>
          </NavLink>
        )}
        <button
          onClick={logout}
          className="flex-1 flex flex-col items-center gap-0.5 py-3 text-xs text-slate-400"
        >
          <LogOut size={22} />
          <span>Sign out</span>
        </button>
      </nav>
    </div>
  );
}
