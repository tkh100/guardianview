import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, User, Lock, ArrowRight } from 'lucide-react';
import { api } from '../api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.login(username, password);
      localStorage.setItem('gv_token', token);
      localStorage.setItem('gv_user', JSON.stringify(user));
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-ink">
      {/* Ambient background — topographic contour lines, like elevation rings on a trail map */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(47,93,80,0.35),transparent)]" />
        <svg className="absolute inset-0 w-full h-full opacity-[0.16]" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs>
            <pattern id="contours" width="240" height="240" patternUnits="userSpaceOnUse">
              <g stroke="#7FA396" strokeWidth="1" fill="none" transform="translate(120,120)">
                <path id="contourRing" d="M-95,-10 C-90,-55 -50,-95 0,-98 C55,-101 98,-58 95,0 C92,55 52,97 -3,95 C-58,93 -100,48 -95,-10 Z" />
                <use href="#contourRing" transform="scale(0.72)" />
                <use href="#contourRing" transform="scale(0.44)" />
                <use href="#contourRing" transform="scale(0.18)" />
              </g>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#contours)" />
        </svg>
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-pine-500/10 rounded-full blur-3xl" />
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-trail-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-pine-500 to-pine-700 rounded-2xl mb-4 shadow-glow">
            <Shield className="text-white w-8 h-8" />
          </div>
          <h1 className="text-white text-3xl font-display font-semibold tracking-tight">GuardianView</h1>
          <p className="text-pine-100/50 text-sm mt-1.5">Glucose monitoring for diabetes camps</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-ink-800/70 backdrop-blur-xl border border-pine-700/40 rounded-2xl p-6 space-y-4 shadow-2xl shadow-black/40">
          {error && (
            <div className="bg-red-950/60 border border-red-800/60 text-red-300 text-sm rounded-lg px-4 py-3 animate-fade-in">
              {error}
            </div>
          )}
          <div>
            <label className="block text-pine-100/70 text-sm font-medium mb-1.5">Username</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-pine-100/40" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-ink-700/60 text-white border border-pine-700/50 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pine-400 focus:border-pine-400 transition-colors placeholder:text-pine-100/30"
                placeholder="admin"
                required
                autoFocus
              />
            </div>
          </div>
          <div>
            <label className="block text-pine-100/70 text-sm font-medium mb-1.5">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-pine-100/40" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-ink-700/60 text-white border border-pine-700/50 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pine-400 focus:border-pine-400 transition-colors placeholder:text-pine-100/30"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-pine-500 hover:bg-pine-400 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-all shadow-glow hover:shadow-none"
          >
            {loading ? 'Signing in…' : <>Sign in <ArrowRight size={15} /></>}
          </button>
        </form>

        <p className="text-center text-pine-100/30 text-xs mt-6">
          Built for volunteer-run T1D camps
        </p>
      </div>
    </div>
  );
}
