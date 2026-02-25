// Google Sheets automated sync for 10-year record retention
// Graceful no-op when GOOGLE_SHEETS_ID or GOOGLE_SERVICE_ACCOUNT_JSON not set.

const SHEETS_ID = process.env.GOOGLE_SHEETS_ID;
const SA_JSON   = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

if (!SHEETS_ID || !SA_JSON) {
  console.log('[sheets] GOOGLE_SHEETS_ID or GOOGLE_SERVICE_ACCOUNT_JSON not set — sync disabled');
  module.exports = { startSheetsSync: () => {} };
  return; // CommonJS early exit trick — safe at top level
}

const { google } = require('googleapis');

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
function getAuthClient() {
  const credentials = JSON.parse(SA_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth.getClient();
}

// ---------------------------------------------------------------------------
// Tab / header definitions
// ---------------------------------------------------------------------------
const TABS = {
  'Camper Profiles': [
    'ID', 'Name', 'Cabin', 'Age', 'Delivery Method', 'Allergies',
    'Med Breakfast', 'Med Lunch', 'Med Dinner', 'Med Bed', 'Med Emergency',
    'A1c', 'Weight', 'Long Acting Type', 'Short Acting Type', 'CGM Pin',
    'Home ICR', 'Home ISF', 'Home Target BG', 'Activity Level',
    'Closed Loop', 'Pump Pin', 'Home Basal Rates',
    'Home Long Acting AM', 'Home Long Acting BED',
    'Reg Illness', 'Reg Open Wounds', 'Reg Scar Tissue', 'Reg Lice',
    'Reg Meds Received', 'Reg CGM Supplies', 'Reg Pump Supplies',
    'Reg Pump Site Count', 'Reg Reservoir Count',
    'Reg Sensor Count', 'Reg Half Unit Syringes',
    'Profile Notes',
  ],
  'Treatment Log': [
    'ID', 'Timestamp', 'Camper', 'Cabin', 'Meal Type', 'Med Slot',
    'BG (CGM)', 'BG (Fingerstick)', 'Ketones', 'Carbs (g)',
    'Calc Dose', 'Dose Given', 'Site Change', 'Prebolus', 'Long Acting Given',
    'Note', 'Logged By',
  ],
  'CGM Readings': [
    'ID', 'Timestamp', 'Camper', 'Cabin', 'BG (mg/dL)', 'Trend',
  ],
  'Alerts': [
    'ID', 'Timestamp', 'Camper', 'Type', 'Value', 'Ack By', 'Ack Time',
  ],
  'Daily Settings': [
    'ID', 'Date', 'Camper', 'Cabin', 'ICR', 'ISF', 'Target BG',
    'Closed Loop', 'Long Acting AM', 'Long Acting BED', 'Set By',
  ],
};

// ---------------------------------------------------------------------------
// Ensure all tabs exist and have header rows
// ---------------------------------------------------------------------------
async function ensureSheets(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Set(meta.data.sheets.map(s => s.properties.title));

  const toAdd = Object.keys(TABS).filter(t => !existing.has(t));
  if (toAdd.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: toAdd.map(title => ({
          addSheet: { properties: { title } },
        })),
      },
    });
  }

  // Write headers for any tab that was newly created
  for (const title of toAdd) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${title}'!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [TABS[title]] },
    });
  }
}

// ---------------------------------------------------------------------------
// Profiles tab — full replace each cycle
// ---------------------------------------------------------------------------
async function syncProfiles(sheets, spreadsheetId, db) {
  const campers = db.prepare(`
    SELECT c.*,
           u.username AS logged_by
    FROM campers c
    LEFT JOIN app_users u ON u.id = c.created_by
    ORDER BY c.id
  `).all();

  const rows = campers.map(c => [
    c.id, c.name, c.cabin_group, c.age ?? '', c.delivery_method ?? 'pump',
    c.allergies ?? '', c.med_breakfast ?? '', c.med_lunch ?? '',
    c.med_dinner ?? '', c.med_bed ?? '', c.med_emergency ?? '',
    c.a1c ?? '', c.weight ?? '', c.long_acting_type ?? '',
    c.short_acting_type ?? '', c.cgm_pin ?? '',
    c.home_icr ?? '', c.home_isf ?? '', c.home_target_bg ?? '',
    c.activity_level ?? '',
    c.closed_loop ? 'Yes' : 'No', c.pump_pin ?? '', c.home_basal_rates ?? '',
    c.home_long_acting_am ?? '', c.home_long_acting_bed ?? '',
    c.reg_recent_illness ? 'Yes' : 'No',
    c.reg_open_wounds ? 'Yes' : 'No',
    c.reg_scar_tissue ? 'Yes' : 'No',
    c.reg_lice ? 'Yes' : 'No',
    c.reg_meds_received ? 'Yes' : 'No',
    c.reg_cgm_supplies_received ? 'Yes' : 'No',
    c.reg_pump_supplies_received ? 'Yes' : 'No',
    c.pump_site_count ?? '', c.pump_reservoir_count ?? '',
    c.reg_sensor_count ?? '',
    c.reg_half_unit_syringes ? 'Yes' : 'No',
    c.profile_notes ?? '',
  ]);

  // Clear data rows (keep header at row 1), then write
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'Camper Profiles'!A2:ZZ`,
  });

  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'Camper Profiles'!A2`,
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    });
  }
}

// ---------------------------------------------------------------------------
// Generic incremental append
// ---------------------------------------------------------------------------
async function syncIncremental(sheets, spreadsheetId, db, tabName, query, transform) {
  const state = db.prepare(
    `SELECT last_synced_id FROM sheets_sync_state WHERE table_name = ?`
  ).get(tabName);
  const lastId = state?.last_synced_id ?? 0;

  const rows = db.prepare(query).all(lastId);
  if (rows.length === 0) return;

  const values = rows.map(transform);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${tabName}'!A1`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });

  const maxId = rows[rows.length - 1].id;
  db.prepare(`
    INSERT INTO sheets_sync_state (table_name, last_synced_id, last_synced_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(table_name) DO UPDATE SET last_synced_id = excluded.last_synced_id, last_synced_at = excluded.last_synced_at
  `).run(tabName, maxId);
}

// ---------------------------------------------------------------------------
// Main sync runner
// ---------------------------------------------------------------------------
async function runSync(db) {
  let authClient, sheets, spreadsheetId;
  try {
    authClient = await getAuthClient();
    sheets = google.sheets({ version: 'v4', auth: authClient });
    spreadsheetId = SHEETS_ID;

    await ensureSheets(sheets, spreadsheetId);
    await syncProfiles(sheets, spreadsheetId, db);

    // Treatment Log
    await syncIncremental(sheets, spreadsheetId, db,
      'Treatment Log',
      `SELECT e.*, c.name AS camper_name, c.cabin_group, u.username AS logged_by_name
       FROM camper_events e
       LEFT JOIN campers c ON c.id = e.camper_id
       LEFT JOIN app_users u ON u.id = e.created_by
       WHERE e.id > ? ORDER BY e.id`,
      r => [
        r.id, r.created_at, r.camper_name, r.cabin_group ?? '',
        r.meal_type ?? '', r.med_slot ?? '',
        r.insulin_units ?? '', r.bg_manual ?? '',
        r.ketones ?? '', r.carbs_g ?? '',
        r.calc_dose ?? '', r.dose_given ?? '',
        r.site_change ? 'Yes' : '', r.prebolus ? 'Yes' : '',
        r.long_acting_given ? 'Yes' : '',
        r.note ?? '', r.logged_by_name ?? '',
      ]
    );

    // CGM Readings
    await syncIncremental(sheets, spreadsheetId, db,
      'CGM Readings',
      `SELECT g.*, c.name AS camper_name, c.cabin_group
       FROM glucose_readings g
       LEFT JOIN campers c ON c.id = g.camper_id
       WHERE g.id > ? ORDER BY g.id`,
      r => [r.id, r.reading_time, r.camper_name, r.cabin_group ?? '', r.value, r.trend ?? '']
    );

    // Alerts
    await syncIncremental(sheets, spreadsheetId, db,
      'Alerts',
      `SELECT a.*, c.name AS camper_name, u.username AS ack_by_name
       FROM alerts a
       LEFT JOIN campers c ON c.id = a.camper_id
       LEFT JOIN app_users u ON u.id = a.acknowledged_by
       WHERE a.id > ? ORDER BY a.id`,
      r => [
        r.id, r.created_at, r.camper_name, r.type, r.value ?? '',
        r.ack_by_name ?? '', r.acknowledged_at ?? '',
      ]
    );

    // Daily Settings
    await syncIncremental(sheets, spreadsheetId, db,
      'Daily Settings',
      `SELECT ds.*, c.name AS camper_name, c.cabin_group, u.username AS set_by_name
       FROM daily_settings ds
       LEFT JOIN campers c ON c.id = ds.camper_id
       LEFT JOIN app_users u ON u.id = ds.created_by
       WHERE ds.id > ? ORDER BY ds.id`,
      r => [
        r.id, r.setting_date, r.camper_name, r.cabin_group ?? '',
        r.icr ?? '', r.isf ?? '', r.target_bg ?? '',
        r.closed_loop ? 'Yes' : 'No',
        r.long_acting_am ?? '', r.long_acting_bed ?? '',
        r.set_by_name ?? '',
      ]
    );

    console.log('[sheets] Sync complete');
  } catch (err) {
    console.error('[sheets] Sync error:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
function startSheetsSync(db) {
  runSync(db);
  setInterval(() => runSync(db), 5 * 60 * 1000);
}

module.exports = { startSheetsSync };
