import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Clock, X, ChevronLeft } from 'lucide-react';
import { api } from '../api';
import { getGlucoseStatus, STATUS_STYLES } from '../components/GlucoseIndicator';

const MEALS = [
  { key: 'breakfast', label: 'Breakfast', start: 7, end: 9.5 },
  { key: 'snack_am', label: 'AM Snack', start: 9.5, end: 11.5 },
  { key: 'lunch', label: 'Lunch', start: 11.5, end: 13.5 },
  { key: 'snack_pm', label: 'PM Snack', start: 13.5, end: 16.5 },
  { key: 'dinner', label: 'Dinner', start: 16.5, end: 19.5 },
];

const TREND_ARROWS = {
  DoubleUp: '↑↑', SingleUp: '↑', FortyFiveUp: '↗',
  Flat: '→',
  FortyFiveDown: '↘', SingleDown: '↓', DoubleDown: '↓↓',
};

function getCurrentMeal() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  return MEALS.find(m => h >= m.start && h < m.end)
    || MEALS.find(m => h < m.start)
    || MEALS[MEALS.length - 1];
}

function timeAgo(iso) {
  if (!iso) return null;
  const mins = Math.round((Date.now() - new Date(iso)) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('gv_user')); } catch { return null; }
}

// Sort cabin groups: prefix alphabetically, then numerically within prefix (B2, B4…B20 / G1, G3…G25)
function sortCabins(groups) {
  return [...groups].sort((a, b) => {
    const aP = a.match(/^[A-Za-z]+/)?.[0] || '';
    const bP = b.match(/^[A-Za-z]+/)?.[0] || '';
    const aN = parseInt(a.match(/\d+/)?.[0] || '0');
    const bN = parseInt(b.match(/\d+/)?.[0] || '0');
    if (aP !== bP) return aP.localeCompare(bP);
    return aN - bN;
  });
}

// ─── BgCard ──────────────────────────────────────────────────────────────────
function BgCard({ camper, entry, onNext, onSkip, index, total }) {
  const [bg, setBg] = useState(entry.bg || '');
  const status = getGlucoseStatus(camper.latest_value, camper.target_low, camper.target_high);
  const styles = STATUS_STYLES[status];
  const arrow = TREND_ARROWS[camper.latest_trend] || '';

  return (
    <div className="flex flex-col gap-4">
      {/* Camper info */}
      <div className={`rounded-2xl p-5 ring-2 ${styles.bg} ${styles.ring}`}>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-0.5">{camper.cabin_group}</p>
        <h2 className="text-2xl font-bold text-slate-800">{camper.name}</h2>
        {camper.latest_value ? (
          <div className={`mt-2 ${styles.text}`}>
            <span className="text-3xl font-bold">{camper.latest_value}</span>
            <span className="text-lg ml-1">{arrow}</span>
            <span className="text-xs font-normal text-slate-500 ml-2">
              CGM · {timeAgo(camper.latest_reading_time)}
            </span>
          </div>
        ) : (
          <p className="text-slate-400 text-sm mt-2">No CGM data</p>
        )}
      </div>

      {/* BG input */}
      <div>
        <label className="text-sm font-medium text-slate-700 block mb-2 text-center">
          Fingerstick BG (mg/dL)
        </label>
        <input
          type="number" min="40" max="600"
          value={bg}
          onChange={e => setBg(e.target.value)}
          placeholder="—"
          className="w-full border-2 border-slate-200 rounded-2xl px-4 py-5 text-4xl font-bold text-center focus:outline-none focus:border-blue-500 transition-colors"
          autoFocus
        />
      </div>

      {/* Progress */}
      <p className="text-center text-sm text-slate-400">{index + 1} of {total}</p>

      {/* Buttons */}
      <div className="flex gap-3">
        <button onClick={onSkip}
          className="flex-1 py-3.5 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
          Skip
        </button>
        <button onClick={() => onNext(bg)}
          className="flex-[2] py-3.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors">
          Next →
        </button>
      </div>
    </div>
  );
}

// ─── CarbsCard ────────────────────────────────────────────────────────────────
function CarbsCard({ camper, entry, onNext, onSkip, index, total }) {
  const [carbs, setCarbs] = useState(entry.carbs || '');
  const [doseGiven, setDoseGiven] = useState('');
  const [doseManual, setDoseManual] = useState(false);

  const icr = camper.home_icr || camper.carb_ratio || null;
  const isf = camper.home_isf || null;
  const targetBg = camper.home_target_bg || 150;
  const bg = entry.bg ? parseInt(entry.bg) : (camper.latest_value || null);

  const { carbDose, correction, total: totalCalc } = useMemo(() => {
    const c = carbs !== '' ? parseInt(carbs) : 0;
    const carbD = (c > 0 && icr) ? c / icr : 0;
    const corr = (bg && isf && bg > targetBg) ? Math.max(0, (bg - targetBg) / isf) : 0;
    const tot = Math.round((carbD + corr) * 2) / 2;
    return { carbDose: carbD, correction: corr, total: tot };
  }, [carbs, icr, isf, bg, targetBg]);

  // Auto-fill dose given from calc when carbs change (unless manually overridden)
  useEffect(() => {
    if (!doseManual && totalCalc > 0) {
      setDoseGiven(String(totalCalc));
    } else if (!doseManual && carbs === '') {
      setDoseGiven('');
    }
  }, [totalCalc]);

  const bgStatus = getGlucoseStatus(bg, camper.target_low, camper.target_high);
  const bgStyles = STATUS_STYLES[bgStatus];
  const bgLabel = entry.bg ? `${entry.bg} mg/dL` : bg ? `${bg} mg/dL (CGM)` : 'No BG';

  const showCalc = carbs !== '' && parseInt(carbs) >= 0 && icr;

  return (
    <div className="flex flex-col gap-4">
      {/* Camper info + BG */}
      <div className="rounded-2xl p-4 bg-slate-50 border border-slate-200">
        <p className="text-xs text-slate-400 font-medium">{camper.cabin_group}</p>
        <h2 className="text-xl font-bold text-slate-800">{camper.name}</h2>
        <div className={`text-2xl font-bold mt-1 ${bgStyles.text}`}>{bgLabel}</div>
        <p className="text-xs text-slate-400 mt-0.5">Target: {camper.target_low}–{camper.target_high}</p>
      </div>

      {/* Carbs input */}
      <div>
        <label className="text-sm font-medium text-slate-700 block mb-2 text-center">Carbs eaten (g)</label>
        <input
          type="number" min="0" max="999"
          value={carbs}
          onChange={e => setCarbs(e.target.value)}
          placeholder="0"
          className="w-full border-2 border-slate-200 rounded-2xl px-4 py-5 text-4xl font-bold text-center focus:outline-none focus:border-blue-500 transition-colors"
          autoFocus
        />
      </div>

      {/* Suggested dose */}
      {showCalc && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide text-center mb-2">Suggested dose</p>
          <div className="space-y-1 text-sm text-blue-600 mb-2">
            {icr && carbDose > 0 && (
              <div className="flex justify-between">
                <span>Carbs ({carbs}g ÷ {icr})</span>
                <span className="font-medium">{carbDose.toFixed(1)}u</span>
              </div>
            )}
            {correction > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>Correction ({bg} → {targetBg})</span>
                <span className="font-medium">+{correction.toFixed(1)}u</span>
              </div>
            )}
          </div>
          <div className="text-center">
            <span className="text-3xl font-bold text-blue-700">{totalCalc}u</span>
          </div>
        </div>
      )}

      {/* Dose given */}
      <div>
        <label className="text-sm font-medium text-slate-700 block mb-2 text-center">Insulin given (units)</label>
        <input
          type="number" min="0" max="99" step="0.5"
          value={doseGiven}
          onChange={e => { setDoseGiven(e.target.value); setDoseManual(true); }}
          placeholder="0.0"
          className="w-full border-2 border-slate-200 rounded-2xl px-4 py-4 text-3xl font-bold text-center focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Progress */}
      <p className="text-center text-sm text-slate-400">{index + 1} of {total}</p>

      {/* Buttons */}
      <div className="flex gap-3">
        <button onClick={onSkip}
          className="flex-1 py-3.5 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
          Skip
        </button>
        <button onClick={() => onNext(carbs, totalCalc > 0 ? String(totalCalc) : '', doseGiven)}
          className="flex-[2] py-3.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors">
          Next →
        </button>
      </div>
    </div>
  );
}

// ─── CabinView ────────────────────────────────────────────────────────────────
export default function CabinView() {
  const user = getCurrentUser();
  const [campers, setCampers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState(
    user?.role === 'counselor' ? (user.cabin_group || 'all') : 'all'
  );

  // Meal round state
  const [roundOpen, setRoundOpen] = useState(false);
  const [phase, setPhase] = useState('bg');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [entries, setEntries] = useState({});
  const [mealKey, setMealKey] = useState(null);
  const [logging, setLogging] = useState(false);
  const [done, setDone] = useState(false);
  const [loggedCount, setLoggedCount] = useState(0);

  async function load() {
    try {
      const data = await api.getCampers('all');
      setCampers(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const cabinGroups = useMemo(() => {
    const groups = [...new Set(campers.map(c => c.cabin_group).filter(Boolean))];
    return sortCabins(groups);
  }, [campers]);

  const filtered = useMemo(() => {
    if (groupFilter === 'all') return campers;
    return campers.filter(c => c.cabin_group === groupFilter);
  }, [campers, groupFilter]);

  const currentCamper = filtered[currentIndex] || null;
  const meal = getCurrentMeal();

  function startRound() {
    const m = getCurrentMeal();
    setMealKey(m.key);
    const init = {};
    filtered.forEach(c => { init[c.id] = { bg: '', carbs: '', calcDose: '', doseGiven: '' }; });
    setEntries(init);
    setCurrentIndex(0);
    setPhase('bg');
    setDone(false);
    setLoggedCount(0);
    setRoundOpen(true);
  }

  // Phase 1 advance
  function handleBgNext(bg) {
    if (currentCamper) {
      setEntries(prev => ({ ...prev, [currentCamper.id]: { ...prev[currentCamper.id], bg } }));
    }
    advanceBg();
  }
  function advanceBg() {
    if (currentIndex < filtered.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      setPhase('carbs');
      setCurrentIndex(0);
    }
  }

  // Phase 2 advance
  function handleCarbsNext(carbs, calcDose, doseGiven) {
    if (currentCamper) {
      setEntries(prev => ({ ...prev, [currentCamper.id]: { ...prev[currentCamper.id], carbs, calcDose, doseGiven } }));
    }
    advanceCarbs();
  }
  function advanceCarbs() {
    if (currentIndex < filtered.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      setPhase('review');
    }
  }

  // Log all
  async function handleLogAll() {
    setLogging(true);
    const toLog = filtered.filter(camper => {
      const e = entries[camper.id];
      return e && (e.bg || e.carbs !== '' || e.doseGiven);
    });
    try {
      const results = await Promise.allSettled(toLog.map(camper => {
        const e = entries[camper.id];
        return api.addEvent(camper.id, {
          meal_type: mealKey,
          bg_manual: e.bg ? parseInt(e.bg) : null,
          carbs_g: e.carbs !== '' ? parseInt(e.carbs) : 0,
          calc_dose: e.calcDose ? parseFloat(e.calcDose) : null,
          dose_given: e.doseGiven ? parseFloat(e.doseGiven) : null,
        });
      }));
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      setLoggedCount(succeeded);
      if (failed > 0) console.error(`${failed} event(s) failed to log`);
      setDone(true);
    } catch (err) {
      console.error('Log all failed:', err);
    } finally { setLogging(false); }
  }

  function closeRound() {
    setRoundOpen(false);
    load();
  }

  const mealLabel = MEALS.find(m => m.key === mealKey)?.label || 'Meal';

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Cabin View</h1>
          <p className="text-slate-500 text-sm">{filtered.length} camper{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={startRound}
          disabled={filtered.length === 0 || loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl font-semibold text-sm hover:bg-violet-700 disabled:opacity-40 transition-colors shadow-sm"
        >
          🍽️ {meal.label} Round
        </button>
      </div>

      {/* Cabin filter */}
      {cabinGroups.length > 1 && (
        <div className="flex gap-1.5 flex-wrap mb-4">
          <button
            onClick={() => setGroupFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${groupFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            All
          </button>
          {cabinGroups.map(g => (
            <button key={g} onClick={() => setGroupFilter(g)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${groupFilter === g ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {g}
            </button>
          ))}
        </div>
      )}

      {/* Camper list */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">No campers</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const status = getGlucoseStatus(c.latest_value, c.target_low, c.target_high);
            const styles = STATUS_STYLES[status];
            const stale = c.latest_reading_time
              ? Date.now() - new Date(c.latest_reading_time) > 15 * 60_000
              : true;
            const arrow = TREND_ARROWS[c.latest_trend] || '';
            const mins = c.latest_reading_time
              ? Math.round((Date.now() - new Date(c.latest_reading_time)) / 60_000)
              : null;
            const timeColor = mins > 15 ? 'text-rose-400' : mins > 10 ? 'text-amber-400' : 'text-slate-400';

            return (
              <Link key={c.id} to={`/campers/${c.id}`}>
                <div className={`rounded-xl px-4 py-3 ring-2 flex items-center gap-3 hover:shadow-md transition-all ${styles.bg} ${styles.ring}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{c.name}</p>
                    {c.cabin_group && <p className="text-slate-500 text-xs">{c.cabin_group}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    {!c.cgm_connected || stale ? (
                      <span className="text-slate-400 text-sm">No data</span>
                    ) : (
                      <div className={`text-2xl font-bold leading-none ${styles.text}`}>
                        {c.latest_value}<span className="text-base ml-0.5">{arrow}</span>
                      </div>
                    )}
                    {c.latest_reading_time && (
                      <p className={`text-xs mt-0.5 ${timeColor}`}>{timeAgo(c.latest_reading_time)}</p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Meal Round Overlay ── */}
      {roundOpen && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
            <div className="flex items-center gap-3">
              {/* Back in phase (go to prev camper) */}
              {(phase === 'bg' || phase === 'carbs') && (
                <button
                  onClick={() => {
                    if (currentIndex > 0) {
                      setCurrentIndex(i => i - 1);
                    } else if (phase === 'carbs') {
                      setPhase('bg');
                      setCurrentIndex(filtered.length - 1);
                    }
                  }}
                  disabled={phase === 'bg' && currentIndex === 0}
                  className="p-1.5 text-slate-400 disabled:opacity-30 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
              )}
              {phase === 'review' && (
                <button
                  onClick={() => { setPhase('bg'); setCurrentIndex(0); }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
              )}
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                  {phase === 'bg' ? 'Step 1 of 3' : phase === 'carbs' ? 'Step 2 of 3' : 'Step 3 of 3'}
                  {' · '}{mealLabel}
                </p>
                <h2 className="font-bold text-slate-800 text-sm">
                  {phase === 'bg' ? '🩸 Blood Sugars' : phase === 'carbs' ? '🍽️ Carbs & Insulin' : '📋 Review & Log'}
                </h2>
              </div>
            </div>
            <button onClick={closeRound} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-slate-100 shrink-0">
            <div className={`h-full bg-blue-500 transition-all duration-300 ${
              phase === 'bg' ? 'w-1/3' : phase === 'carbs' ? 'w-2/3' : 'w-full'
            }`} />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4">
            <div className="max-w-md mx-auto">
              {/* Phase 1: BG */}
              {phase === 'bg' && currentCamper && (
                <BgCard
                  key={currentCamper.id}
                  camper={currentCamper}
                  entry={entries[currentCamper.id] || {}}
                  onNext={handleBgNext}
                  onSkip={advanceBg}
                  index={currentIndex}
                  total={filtered.length}
                />
              )}

              {/* Phase 2: Carbs */}
              {phase === 'carbs' && currentCamper && (
                <CarbsCard
                  key={currentCamper.id}
                  camper={currentCamper}
                  entry={entries[currentCamper.id] || {}}
                  onNext={handleCarbsNext}
                  onSkip={advanceCarbs}
                  index={currentIndex}
                  total={filtered.length}
                />
              )}

              {/* Phase 3: Review */}
              {phase === 'review' && (
                done ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-emerald-600 text-3xl">✓</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-1">All Done!</h3>
                    <p className="text-slate-500 mb-6">Logged {loggedCount} camper{loggedCount !== 1 ? 's' : ''}</p>
                    <button onClick={closeRound}
                      className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors">
                      Back to Cabin View
                    </button>
                  </div>
                ) : (
                  <>
                    <h3 className="font-semibold text-slate-700 mb-3">{mealLabel} — {filtered.length} campers</h3>
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-4">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500">Camper</th>
                            <th className="text-center px-2 py-2.5 text-xs font-semibold text-slate-500">BG</th>
                            <th className="text-center px-2 py-2.5 text-xs font-semibold text-slate-500">Carbs</th>
                            <th className="text-center px-2 py-2.5 text-xs font-semibold text-slate-500">Calc</th>
                            <th className="text-center px-2 py-2.5 text-xs font-semibold text-slate-500">Given</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filtered.map(c => {
                            const e = entries[c.id] || {};
                            const hasAny = e.bg || e.carbs !== '' || e.doseGiven;
                            return (
                              <tr key={c.id} className={!hasAny ? 'opacity-35' : ''}>
                                <td className="px-3 py-2.5 font-medium text-slate-800 max-w-[100px] truncate">{c.name}</td>
                                <td className="px-2 py-2.5 text-center text-slate-700">{e.bg || '—'}</td>
                                <td className="px-2 py-2.5 text-center text-slate-700">{e.carbs !== '' && e.carbs !== undefined ? `${e.carbs}g` : '—'}</td>
                                <td className="px-2 py-2.5 text-center text-blue-600 font-medium">{e.calcDose ? `${e.calcDose}u` : '—'}</td>
                                <td className="px-2 py-2.5 text-center font-bold text-slate-800">{e.doseGiven ? `${e.doseGiven}u` : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <button
                      onClick={handleLogAll}
                      disabled={logging}
                      className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-base hover:bg-emerald-700 disabled:opacity-40 transition-colors">
                      {logging ? 'Logging...' : '✓ Log All'}
                    </button>
                  </>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
