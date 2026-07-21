import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, LogOut, Shield, UserCog, Volume2, VolumeX, ClipboardList, TrendingUp, Home, CalendarDays } from 'lucide-react';
import { getMuted, setMuted } from '../hooks/useAudioAlerts';
import AiHelper from './AiHelper';

function getUser() {
  try { return JSON.parse(localStorage.getItem('gv_user') || 'null'); } catch { return null; }
}

export default function Layout() {
  const navigate = useNavigate();
  const user = getUser();
  const [muted, _setMuted] = useState(getMuted());

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    _setMuted(next);
  }

  function logout() {
    localStorage.removeItem('gv_token');
    localStorage.removeItem('gv_user');
    navigate('/login');
  }

  const navClass = ({ isActive }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
      isActive
        ? 'bg-pine-500 text-white shadow-glow'
        : 'text-pine-100/80 hover:bg-white/5 hover:text-white'
    }`;

  const mobileNavClass = ({ isActive }) =>
    `shrink-0 snap-center flex flex-col items-center justify-center gap-1 min-w-[64px] px-2 py-2.5 text-[10px] font-medium whitespace-nowrap transition-colors ${
      isActive ? 'text-trail-400' : 'text-pine-100/50 active:text-pine-100'
    }`;

  return (
    <div className="flex h-app-screen overflow-hidden">
      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex w-56 bg-ink flex-col shrink-0 border-r border-pine-700/40">
        <div className="px-4 py-5 border-b border-pine-700/40 bg-gradient-to-b from-ink-700/60 to-transparent">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-pine-500 to-pine-700 shadow-glow shrink-0">
              <Shield className="text-white" size={18} />
            </span>
            <span className="text-white font-display font-bold text-lg tracking-tight">GuardianView</span>
          </div>
          {user && (
            <div className="flex items-center gap-1.5 mt-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <p className="text-pine-100/60 text-xs truncate">
                <span className="text-pine-50 font-medium">{user.username}</span> · {user.role}
              </p>
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLink to="/cabin" className={navClass}>
            <Home size={16} /> Cabin View
          </NavLink>
          <NavLink to="/dashboard" className={navClass}>
            <LayoutDashboard size={16} /> Dashboard
          </NavLink>
          {(user?.role === 'admin' || user?.role === 'nurse') && (
            <>
              <NavLink to="/checkin" className={navClass}>
                <ClipboardList size={16} /> Check-In
              </NavLink>
              <NavLink to="/trends" className={navClass}>
                <TrendingUp size={16} /> Trends
              </NavLink>
              <NavLink to="/daysheet" className={navClass}>
                <CalendarDays size={16} /> Day Sheet
              </NavLink>
              <NavLink to="/manage" className={navClass}>
                <Users size={16} /> Manage Campers
              </NavLink>
            </>
          )}
          {user?.role === 'admin' && (
            <NavLink to="/staff" className={navClass}>
              <UserCog size={16} /> Staff Accounts
            </NavLink>
          )}
        </nav>

        <div className="px-3 py-4 border-t border-pine-700/40 space-y-1">
          <button
            onClick={toggleMute}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-pine-100/60 hover:text-white hover:bg-white/5 w-full transition-colors"
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} className="text-trail-400" />}
            {muted ? 'Sound Off' : 'Sound On'}
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-pine-100/60 hover:text-white hover:bg-white/5 w-full transition-colors"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-24 md:pb-0">
        <Outlet />
      </main>

      <AiHelper />

      {/* Bottom tab bar — mobile only. Horizontally scrollable so it never squeezes/wraps labels. */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-ink/95 backdrop-blur border-t border-pine-700/40">
        <nav className="flex overflow-x-auto no-scrollbar snap-x pb-[env(safe-area-inset-bottom)]">
          <NavLink to="/cabin" className={mobileNavClass}>
            <Home size={20} />
            <span>Cabin</span>
          </NavLink>
          <NavLink to="/dashboard" className={mobileNavClass}>
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>
          {(user?.role === 'admin' || user?.role === 'nurse') && (
            <>
              <NavLink to="/checkin" className={mobileNavClass}>
                <ClipboardList size={20} />
                <span>Check-In</span>
              </NavLink>
              <NavLink to="/trends" className={mobileNavClass}>
                <TrendingUp size={20} />
                <span>Trends</span>
              </NavLink>
              <NavLink to="/daysheet" className={mobileNavClass}>
                <CalendarDays size={20} />
                <span>Day Sheet</span>
              </NavLink>
              <NavLink to="/manage" className={mobileNavClass}>
                <Users size={20} />
                <span>Manage</span>
              </NavLink>
            </>
          )}
          {user?.role === 'admin' && (
            <NavLink to="/staff" className={mobileNavClass}>
              <UserCog size={20} />
              <span>Staff</span>
            </NavLink>
          )}
          <button
            onClick={logout}
            className="shrink-0 snap-center flex flex-col items-center justify-center gap-1 min-w-[64px] px-2 py-2.5 text-[10px] font-medium text-pine-100/50 active:text-pine-100"
          >
            <LogOut size={20} />
            <span>Sign out</span>
          </button>
        </nav>
        {/* Fade hint that the bar scrolls horizontally */}
        <div className="pointer-events-none absolute right-0 bottom-0 top-0 w-8 bg-gradient-to-l from-ink to-transparent" />
      </div>
    </div>
  );
}
