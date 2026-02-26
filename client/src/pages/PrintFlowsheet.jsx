import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';


// ---------------------------------------------------------------------------
// Time slot definitions
// Each slot covers one or more hours (0–23).
// "OVN" covers 3 A.M.–6 A.M. inclusive.
// ---------------------------------------------------------------------------
const ALL_SLOTS = [
  { id: '12A', hours: [0] },
  { id: '1A',  hours: [1] },
  { id: '2A',  hours: [2] },
  { id: 'OVN', hours: [3, 4, 5, 6], label: 'Overnight' },
  { id: '7A',  hours: [7] },
  { id: '8A',  hours: [8] },
  { id: '9A',  hours: [9] },
  { id: '10A', hours: [10] },
  { id: '11A', hours: [11] },
  { id: '12P', hours: [12] },
  { id: '1P',  hours: [13] },
  { id: '2P',  hours: [14] },
  { id: '3P',  hours: [15] },
  { id: '4P',  hours: [16] },
  { id: '5P',  hours: [17] },
  { id: '6P',  hours: [18] },
  { id: '7P',  hours: [19] },
  { id: '8P',  hours: [20] },
  { id: '9P',  hours: [21] },
  { id: '10P', hours: [22] },
  { id: '11P', hours: [23] },
];

// Arrival Saturday: just PM hours (1P onward) + a "Reg" column before them
const SAT_ARRIVAL_SLOTS = ALL_SLOTS.filter(s =>
  s.hours.some(h => h >= 13) // 1P–11P
);

// Departure Saturday: just overnight + AM hours (12A–10A) + "Other"
const SAT_DEPART_SLOTS = [
  ...ALL_SLOTS.filter(s => s.hours.some(h => h <= 10)),
  { id: 'OTHER', hours: [], label: 'Other' },
];

// Full-day slots for Sun–Fri
const FULL_SLOTS = ALL_SLOTS;

// ---------------------------------------------------------------------------
// Build a slot map: slotId → aggregated cell values for a day's events+readings
// ---------------------------------------------------------------------------
function buildSlotMap(events, readings, slots) {
  const map = {};

  // Initialize
  slots.forEach(s => {
    map[s.id] = { bgs: [], ketones: [], carbs: [], calcDose: [], doseGiven: [], siteChange: false, longActing: false, prebolus: false, notes: [] };
  });

  // Helper: which slot does an hour fall into?
  function slotFor(h) {
    return slots.find(s => s.hours.includes(h));
  }

  // CGM readings → BG row (italicised in display)
  readings.forEach(r => {
    const h = new Date(r.reading_time.includes('T') ? r.reading_time : r.reading_time + 'Z').getHours();
    const slot = slotFor(h);
    if (slot) map[slot.id].bgs.push({ val: r.value, cgm: true });
  });

  // Treatment events
  events.forEach(ev => {
    const h = new Date(ev.created_at.includes('T') ? ev.created_at : ev.created_at + 'Z').getHours();
    const slot = slotFor(h);
    if (!slot) return;
    const cell = map[slot.id];
    if (ev.bg_manual != null) cell.bgs.push({ val: ev.bg_manual, cgm: false });
    if (ev.ketones != null)   cell.ketones.push(ev.ketones);
    if (ev.carbs_g != null)   cell.carbs.push(ev.carbs_g);
    if (ev.calc_dose != null) cell.calcDose.push(ev.calc_dose);
    if (ev.dose_given != null) cell.doseGiven.push(ev.dose_given);
    if (ev.site_change)       cell.siteChange = true;
    if (ev.long_acting_given) cell.longActing = true;
    if (ev.prebolus)          cell.prebolus = true;
    if (ev.note)              cell.notes.push(ev.note);
  });

  return map;
}

// Format a cell's primary numeric values (prefer manual BG over CGM)
function fmtBG(bgs) {
  if (!bgs.length) return '';
  // Prefer manual readings; if none, use CGM
  const manual = bgs.filter(b => !b.cgm);
  const show = manual.length ? manual : bgs;
  return show.map(b => b.val).join('\n');
}

function fmtNums(arr) {
  if (!arr.length) return '';
  return arr.map(v => (Number.isInteger(v) ? v : parseFloat(v.toFixed(1)))).join('\n');
}

// ---------------------------------------------------------------------------
// DayGrid: renders one day's tracking table
// ---------------------------------------------------------------------------
function DayGrid({ label, slots, slotMap, isPump, showRegCol = false, showLongActingRow = false, dateStr }) {
  const rows = [
    { key: 'bg',       label: 'Blood Glucose' },
    { key: 'ketones',  label: 'Ketones' },
    { key: 'carbs',    label: 'Carbohydrates' },
    { key: 'calcDose', label: 'Calculated dose' },
    { key: 'doseGiven',label: 'Dose given' },
    { key: 'site',     label: 'Site change' },
    isPump
      ? { key: 'prebolus',  label: 'Prebolus given?' }
      : { key: 'longActing',label: 'Long acting given' },
    { key: 'notes',    label: 'Extra notes' },
  ];

  function cellValue(slotId, rowKey) {
    if (!slotMap) return '';
    const cell = slotMap[slotId];
    if (!cell) return '';
    switch (rowKey) {
      case 'bg':        return fmtBG(cell.bgs);
      case 'ketones':   return fmtNums(cell.ketones);
      case 'carbs':     return fmtNums(cell.carbs);
      case 'calcDose':  return fmtNums(cell.calcDose);
      case 'doseGiven': return fmtNums(cell.doseGiven);
      case 'site':      return cell.siteChange ? '✓' : '';
      case 'longActing':return cell.longActing ? '✓' : '';
      case 'prebolus':  return cell.prebolus ? '✓' : '';
      case 'notes':     return cell.notes.join('; ');
      default:          return '';
    }
  }

  return (
    <div className="day-section">
      <table className="flowsheet-table">
        <thead>
          <tr>
            <th className="row-label-hdr">{label}{dateStr ? <span className="date-sub"> {dateStr}</span> : ''}</th>
            {showRegCol && <th className="slot-hdr reg-col">Reg</th>}
            {slots.map(s => (
              <th key={s.id} className={`slot-hdr${s.id === 'OVN' ? ' ovn-col' : ''}`}>
                {s.label || s.id}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.key}>
              <td className="row-label">{row.label}</td>
              {showRegCol && <td className="data-cell" />}
              {slots.map(s => (
                <td key={s.id} className={`data-cell${s.id === 'OVN' ? ' ovn-col' : ''}${s.id === 'OTHER' ? ' other-col' : ''}`}>
                  {cellValue(s.id, row.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DaySettingsBlock: per-day ICR / ISF / Target / Closed-loop (pump front)
// ---------------------------------------------------------------------------
function DaySettingsBlock({ label, settings, camper }) {
  const icr = settings?.icr ?? camper?.home_icr;
  const isf = settings?.isf ?? camper?.home_isf;
  const target = settings?.target_bg ?? camper?.home_target_bg;
  const cl = settings?.closed_loop ?? camper?.closed_loop;
  return (
    <div className="settings-block">
      <div className="settings-day-label">{label}</div>
      <div className="settings-row">
        <span className="settings-kv">ICR: <b>{icr ?? ''}</b></span>
        <span className="settings-kv">ISF: <b>{isf ?? ''}</b></span>
        <span className="settings-kv">Target: <b>{target ?? ''}</b></span>
        <span className="settings-kv">CL: <b>{cl ? 'Yes' : 'No'}</b></span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header card
// ---------------------------------------------------------------------------
function FlowsheetHeader({ camper, isPump }) {
  const medLine = (label, val) => val
    ? <span className="med-item"><b>{label}:</b> {val}</span>
    : null;

  return (
    <div className="header-card">
      <div className="header-title">{isPump ? 'Pump' : 'Injection'} Flowsheet</div>
      <div className="header-grid">
        <div className="hf name-block">
          <span className="hf-label">Name:</span> <span className="hf-val">{camper.name}</span>
        </div>
        <div className="hf">
          <span className="hf-label">Age:</span> <span className="hf-val">{camper.age ?? ''}</span>
        </div>
        <div className="hf">
          <span className="hf-label">Group:</span> <span className="hf-val">{camper.cabin_group ?? ''}</span>
        </div>
        <div className="hf allergies-block">
          <span className="hf-label">Allergies:</span> <span className="hf-val">{camper.allergies ?? ''}</span>
        </div>
        <div className="hf a1c-block">
          <span className="hf-label">A1c:</span> <span className="hf-val">{camper.a1c ?? ''}</span>
        </div>
        <div className="hf">
          <span className="hf-label">Weight:</span> <span className="hf-val">{camper.weight ?? ''}</span>
        </div>
        {isPump && (
          <div className="hf">
            <span className="hf-label">Closed Loop?</span>
            <span className="hf-val">
              <span className={`cl-check${camper.closed_loop ? ' active' : ''}`}>Yes</span>
              <span className={`cl-check${!camper.closed_loop ? ' active' : ''}`}>No</span>
            </span>
          </div>
        )}
      </div>

      <div className="header-meds">
        <span className="hf-label">Medications:</span>
        {medLine('Breakfast', camper.med_breakfast)}
        {medLine('Lunch', camper.med_lunch)}
        {medLine('Dinner', camper.med_dinner)}
        {medLine('Bed', camper.med_bed)}
        {medLine('Emergency', camper.med_emergency)}
      </div>

      <div className="header-insulin">
        <div><span className="hf-label">Long acting:</span> <span className="hf-val">{camper.long_acting_type ?? ''}</span></div>
        <div><span className="hf-label">Short acting:</span> <span className="hf-val">{camper.short_acting_type ?? ''}</span></div>
        <div><span className="hf-label">CGM Pin:</span> <span className="hf-val">{camper.cgm_pin ?? ''}</span></div>
        {isPump && <div><span className="hf-label">Pump Pin:</span> <span className="hf-val">{camper.pump_pin ?? ''}</span></div>}
        {!isPump && (
          <>
            <div><span className="hf-label">Long acting AM dose:</span> <span className="hf-val">{camper.home_long_acting_am ?? ''}</span></div>
            <div><span className="hf-label">Long acting BED dose:</span> <span className="hf-val">{camper.home_long_acting_bed ?? ''}</span></div>
          </>
        )}
        <div><span className="hf-label">ICR:</span> <span className="hf-val">{camper.home_icr ?? ''}</span></div>
        <div><span className="hf-label">ISF:</span> <span className="hf-val">{camper.home_isf ?? ''}</span></div>
        <div><span className="hf-label">Target BG:</span> <span className="hf-val">{camper.home_target_bg ?? 150}</span></div>
        <div><span className="hf-label">Notes:</span> <span className="hf-val">{camper.profile_notes ?? ''}</span></div>
      </div>

      <div className="reg-section">
        <div className="reg-title">Registration Review</div>
        <div className="reg-grid">
          <div className="reg-item"><span className="reg-label">Recent illness/injuries:</span> <span className="reg-val">{camper.reg_recent_illness ?? ''}</span></div>
          <div className="reg-item"><span className="reg-label">Open wounds/sores:</span> <span className="reg-val">{camper.reg_open_wounds ?? ''}</span></div>
          <div className="reg-item"><span className="reg-label">Sites of scar tissue:</span> <span className="reg-val">{camper.reg_scar_tissue ?? ''}</span></div>
          <div className="reg-item"><span className="reg-label">Lice/infestations:</span> <span className="reg-val">{camper.reg_lice ?? ''}</span></div>
          <div className="reg-item">
            <span className="reg-label">Medications received:</span>
            <span className={`reg-check${camper.reg_meds_received ? ' yes' : ' no'}`}>{camper.reg_meds_received ? 'Yes' : 'No'}</span>
          </div>
          <div className="reg-item">
            <span className="reg-label">CGM supplies received:</span>
            <span className={`reg-check${camper.reg_cgm_supplies_received ? ' yes' : ' no'}`}>{camper.reg_cgm_supplies_received ? 'Yes' : 'No'}</span>
          </div>
          {camper.delivery_method === 'injection' && (
            <div className="reg-item">
              <span className="reg-label">Sensors received:</span>
              <span className="reg-val">{camper.reg_sensor_count ?? ''}</span>
            </div>
          )}
          {isPump && (
            <>
              <div className="reg-item">
                <span className="reg-label">Pump supplies received:</span>
                <span className={`reg-check${camper.reg_pump_supplies_received ? ' yes' : ' no'}`}>{camper.reg_pump_supplies_received ? 'Yes' : 'No'}</span>
              </div>
              <div className="reg-item">
                <span className="reg-label">Sites:</span>
                <span className="reg-val">{camper.pump_site_count ?? ''}</span>
                <span className="reg-label" style={{marginLeft:'8px'}}>Reservoirs:</span>
                <span className="reg-val">{camper.pump_reservoir_count ?? ''}</span>
              </div>
            </>
          )}
          {!isPump && (
            <div className="reg-item">
              <span className="reg-label">Half-unit syringes:</span>
              <span className={`reg-check${camper.reg_half_unit_syringes ? ' yes' : ' no'}`}>{camper.reg_half_unit_syringes ? 'Yes' : 'No'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Key styles — embedded for a self-contained print page
// ---------------------------------------------------------------------------
const PRINT_STYLES = `
  @page { size: letter landscape; margin: 0.35in 0.3in; }
  @media print {
    body { margin: 0; }
    .no-print { display: none !important; }
    .page-break { page-break-after: always; break-after: page; }
  }

  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #000; background: #fff; }

  /* Print button bar */
  .print-bar {
    background: #1e293b; color: #fff; padding: 10px 16px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; position: sticky; top: 0; z-index: 100;
  }
  .print-bar h1 { font-size: 14px; margin: 0; font-weight: 600; }
  .print-bar button {
    background: #3b82f6; color: #fff; border: none; border-radius: 6px;
    padding: 6px 14px; font-size: 13px; cursor: pointer; font-weight: 500;
  }
  .print-bar button:hover { background: #2563eb; }
  .print-bar label { font-size: 12px; display: flex; align-items: center; gap: 6px; }
  .print-bar input[type=date] {
    border: 1px solid #475569; background: #334155; color: #fff;
    border-radius: 4px; padding: 3px 6px; font-size: 12px;
  }

  /* Header card */
  .header-card { padding: 6px 0 8px; }
  .header-title { font-size: 13pt; font-weight: 700; text-align: center; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  .header-grid { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-bottom: 5px; border-bottom: 1px solid #000; padding-bottom: 4px; }
  .hf { display: flex; gap: 3px; align-items: baseline; }
  .hf-label { font-weight: 700; font-size: 7.5pt; white-space: nowrap; }
  .hf-val { font-size: 7.5pt; min-width: 40px; border-bottom: 1px solid #666; min-width: 80px; }
  .allergies-block .hf-val { min-width: 140px; }
  .header-meds { display: flex; flex-wrap: wrap; gap: 3px 10px; font-size: 7.5pt; margin-bottom: 5px; border-bottom: 1px solid #000; padding-bottom: 4px; }
  .med-item { display: inline-flex; gap: 2px; }
  .header-insulin { display: flex; flex-wrap: wrap; gap: 3px 16px; font-size: 7.5pt; margin-bottom: 6px; border-bottom: 1px solid #000; padding-bottom: 4px; }
  .header-insulin .hf-label { font-weight: 700; }
  .cl-check { margin-right: 5px; padding: 0 3px; border: 1px solid #999; font-size: 7pt; }
  .cl-check.active { background: #000; color: #fff; border-color: #000; }

  /* Registration */
  .reg-section { margin-top: 4px; }
  .reg-title { font-weight: 700; font-size: 8.5pt; margin-bottom: 3px; text-decoration: underline; }
  .reg-grid { display: flex; flex-wrap: wrap; gap: 2px 16px; }
  .reg-item { display: flex; gap: 3px; align-items: baseline; font-size: 7.5pt; }
  .reg-label { font-weight: 600; }
  .reg-val { border-bottom: 1px solid #666; min-width: 60px; }
  .reg-check { font-size: 7pt; padding: 0 3px; border: 1px solid #999; margin-left: 2px; }
  .reg-check.yes { background: #000; color: #fff; border-color: #000; }

  /* Flowsheet table */
  .day-section { margin-bottom: 4px; }
  .flowsheet-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .flowsheet-table th, .flowsheet-table td { border: 1px solid #000; padding: 1px 2px; vertical-align: top; }
  .row-label-hdr { font-size: 8pt; font-weight: 700; width: 88px; text-align: left; background: #e8e8e8; }
  .row-label { font-size: 7pt; font-weight: 600; width: 88px; background: #f4f4f4; }
  .slot-hdr { font-size: 6.5pt; font-weight: 700; text-align: center; background: #e8e8e8; width: 38px; }
  .ovn-col { width: 52px; background: #d4d4d4 !important; }
  .other-col { width: 44px; }
  .reg-col { width: 44px; background: #d4e8ff !important; }
  .date-sub { font-size: 6.5pt; font-weight: 400; color: #444; margin-left: 3px; }
  .data-cell { font-size: 7pt; text-align: center; vertical-align: middle; min-height: 12px; white-space: pre-line; line-height: 1.2; }
  .data-cell.ovn-col { background: #f8f8f8; }

  /* Daily settings strip (pump only) */
  .settings-strip { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
  .settings-block { border: 1px solid #000; padding: 3px 5px; flex: 1; min-width: 150px; }
  .settings-day-label { font-weight: 700; font-size: 7.5pt; border-bottom: 1px solid #ccc; margin-bottom: 2px; }
  .settings-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .settings-kv { font-size: 7pt; }
  .settings-kv b { border-bottom: 1px solid #666; min-width: 24px; display: inline-block; }

  /* Section titles */
  .section-title { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; margin: 6px 0 3px; border-bottom: 2px solid #000; padding-bottom: 2px; }

  /* Nabs/Tabs/Milk key */
  .key-legend { font-size: 7pt; font-style: italic; color: #444; text-align: right; margin-bottom: 2px; }
`;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function PrintFlowsheet() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [weekStart, setWeekStart] = useState(() => {
    if (searchParams.get('week_start')) return searchParams.get('week_start');
    // Default: most recent Saturday
    const today = new Date();
    const day = today.getDay();
    const diffToSat = day >= 6 ? 0 : day + 1;
    today.setDate(today.getDate() - diffToSat);
    return today.toISOString().slice(0, 10);
  });

  async function load(ws) {
    setData(null);
    setError(null);
    try {
      const result = await api.getPrintFlowsheet(id, ws);
      setData(result);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(weekStart); }, [id, weekStart]);

  if (error) return (
    <div style={{ padding: '20px', color: 'red' }}>
      <style>{PRINT_STYLES}</style>
      Error: {error}
    </div>
  );
  if (!data) return (
    <div style={{ padding: '20px' }}>
      <style>{PRINT_STYLES}</style>
      Loading flowsheet…
    </div>
  );

  const { camper, days } = data;
  const isPump = camper.delivery_method === 'pump';

  // days[0] = arrival Saturday, days[1..7] = Sun–Sat week
  const arrivalDay = days[0];
  const weekDays   = days.slice(1); // 7 days: Sun–Sat

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function dayLabel(dayObj, idx) {
    const d = new Date(dayObj.date + 'T12:00:00');
    const name = DAY_NAMES[d.getDay()];
    return `${name}  ${dayObj.date}`;
  }

  return (
    <>
      <style>{PRINT_STYLES}</style>

      {/* Screen-only controls */}
      <div className="print-bar no-print">
        <h1>{camper.name} — {isPump ? 'Pump' : 'Injection'} Flowsheet</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label>
            Week start (arrival Saturday):
            <input type="date" value={weekStart}
              onChange={e => setWeekStart(e.target.value)}
              style={{ marginLeft: '6px' }} />
          </label>
          <button
            onClick={async () => {
              setExporting(true);
              try { await api.downloadFlowsheet(id, weekStart); }
              finally { setExporting(false); }
            }}
            disabled={exporting}
            style={{ background: '#10b981' }}
          >
            {exporting ? 'Exporting…' : '⬇ Download CSV'}
          </button>
          <button onClick={() => window.print()}>🖨 Print / Save PDF</button>
        </div>
      </div>

      {/* ================================================================
          PAGE 1: Header + Arrival Saturday grid
      ================================================================ */}
      <div style={{ padding: '0 6px' }}>
        <FlowsheetHeader camper={camper} isPump={isPump} />

        <div className="section-title">
          Saturday (Arrival) — {arrivalDay.date}
        </div>
        <div className="key-legend">N = Nabs &nbsp;|&nbsp; T = Tabs &nbsp;|&nbsp; M = Milk</div>
        <DayGrid
          label="Saturday"
          slots={SAT_ARRIVAL_SLOTS}
          slotMap={buildSlotMap(arrivalDay.events, arrivalDay.readings, SAT_ARRIVAL_SLOTS)}
          isPump={isPump}
          showRegCol
          dateStr={arrivalDay.date}
        />
      </div>

      {/* ================================================================
          PAGE 2+: Pump daily settings strip (pump only)
      ================================================================ */}
      {isPump && (
        <div className="page-break" />
      )}
      {isPump && (
        <div style={{ padding: '0 6px' }}>
          <div className="section-title">Daily Settings — {camper.name}</div>
          <div className="settings-strip">
            <DaySettingsBlock label={`Saturday ${arrivalDay.date}`} settings={arrivalDay.settings} camper={camper} />
            {weekDays.map((d, i) => (
              <DaySettingsBlock key={d.date} label={`${DAY_NAMES[new Date(d.date + 'T12:00:00').getDay()]} ${d.date}`} settings={d.settings} camper={camper} />
            ))}
          </div>
          {camper.home_basal_rates && (
            <div style={{ fontSize: '7.5pt', marginTop: '4px' }}>
              <b>Home basal rates:</b> {camper.home_basal_rates}
            </div>
          )}
        </div>
      )}

      {/* ================================================================
          PAGE 3+: Weekly daily grids
      ================================================================ */}
      <div className="page-break" />
      <div style={{ padding: '0 6px' }}>
        <div className="section-title">Weekly Tracking — {camper.name} &nbsp;|&nbsp; {camper.cabin_group}</div>
        <div className="key-legend">N = Nabs &nbsp;|&nbsp; T = Tabs &nbsp;|&nbsp; M = Milk</div>

        {weekDays.map((dayObj, idx) => {
          const d = new Date(dayObj.date + 'T12:00:00');
          const name = DAY_NAMES[d.getDay()];
          const isLastSat = idx === 6; // departure Saturday
          const slots = isLastSat ? SAT_DEPART_SLOTS : FULL_SLOTS;
          const slotMap = buildSlotMap(dayObj.events, dayObj.readings, slots);
          return (
            <DayGrid
              key={dayObj.date}
              label={name}
              slots={slots}
              slotMap={slotMap}
              isPump={isPump}
              dateStr={dayObj.date}
            />
          );
        })}
      </div>
    </>
  );
}
