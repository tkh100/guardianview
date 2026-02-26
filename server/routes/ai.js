const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// Build a snapshot of live camper data for AI context
function getLiveContext(userRole, cabinGroup) {
  const camperQuery = userRole === 'counselor'
    ? db.prepare('SELECT * FROM campers WHERE is_active=1 AND cabin_group=? ORDER BY name').all(cabinGroup)
    : db.prepare('SELECT * FROM campers WHERE is_active=1 ORDER BY name').all();

  const now = Date.now();
  const campers = camperQuery.map(c => {
    const readingAge = c.latest_reading_time
      ? Math.round((now - new Date(c.latest_reading_time).getTime()) / 60000)
      : null;

    let status = 'no_data';
    if (c.latest_value != null) {
      const lo = c.target_low || 70;
      const hi = c.target_high || 180;
      if (c.latest_value < 55) status = 'critical_low';
      else if (c.latest_value < lo) status = 'low';
      else if (c.latest_value > 250) status = 'critical_high';
      else if (c.latest_value > hi) status = 'high';
      else status = 'in_range';
    }

    return {
      name: c.name,
      cabin: c.cabin_group,
      bg: c.latest_value != null ? `${c.latest_value} mg/dL` : 'no data',
      trend: c.latest_trend || 'unknown',
      status,
      reading_age_min: readingAge,
      target_range: `${c.target_low || 70}–${c.target_high || 180} mg/dL`,
      delivery: c.delivery_method,
      closed_loop: c.closed_loop ? 'yes' : 'no',
    };
  });

  const alerts = db.prepare(`
    SELECT a.type, c.name as camper_name, c.cabin_group, a.value
    FROM alerts a
    JOIN campers c ON c.id = a.camper_id
    WHERE a.acknowledged_at IS NULL
    ORDER BY a.created_at DESC
    LIMIT 20
  `).all();

  return { campers, alerts };
}

// POST /api/ai/chat
router.post('/chat', requireAuth, async (req, res) => {
  if (!client) {
    return res.status(503).json({ error: 'AI assistant is not configured (missing ANTHROPIC_API_KEY).' });
  }

  const { message, history = [] } = req.body;
  if (!message || typeof message !== 'string' || message.length > 2000) {
    return res.status(400).json({ error: 'Invalid message' });
  }

  const { campers, alerts } = getLiveContext(req.user.role, req.user.cabin_group);

  const activeAlerts = alerts.length > 0
    ? alerts.map(a => `• ${a.type.replace('_', ' ').toUpperCase()} — ${a.camper_name} (${a.cabin_group})${a.value ? ` BG ${a.value}` : ''}`).join('\n')
    : 'None';

  const camperLines = campers.length > 0
    ? campers.map(c =>
        `• ${c.name} (${c.cabin}): ${c.bg}, trend ${c.trend}, status ${c.status}` +
        (c.reading_age_min != null ? `, ${c.reading_age_min} min ago` : '') +
        `, target ${c.target_range}, ${c.delivery}${c.delivery === 'pump' ? `, closed loop ${c.closed_loop}` : ''}`
      ).join('\n')
    : 'No active campers.';

  const systemPrompt = `You are GuardianView Assistant, an AI helper embedded in GuardianView — a diabetes camp CGM monitoring dashboard used by camp nurses, counselors, and administrators.

## Your role
Help staff:
1. **Navigate the app** — explain features, pages, buttons, and workflows
2. **Understand live camper data** — answer questions about current blood glucose readings, trends, alerts, and patterns
3. **Clinical guidance** — explain diabetes concepts (ICR, ISF, target BG, closed-loop, carb ratios, ketones, CGM trends), help staff interpret readings, and suggest what to document. Always remind staff that clinical decisions should be confirmed with medical staff.

## App overview
- **Cabin View** (/cabin) — filtered view for counselors showing their cabin group
- **Dashboard** (/dashboard) — full grid of all active campers with real-time BG and status badges
- **Camper Detail** (/campers/:id) — individual camper page with glucose chart, treatment logging (BG, carbs, insulin, meds, site changes), daily settings, time-in-range stats, and meal/med reminders
- **Check-In** (/checkin) — camp registration and intake workflow (nurses/admins)
- **Trends** (/trends) — multi-camper analytics (nurses/admins)
- **Day Sheet** (/daysheet) — daily flowsheet overview (nurses/admins)
- **Manage Campers** (/manage) — add/edit camper profiles and CGM connections (nurses/admins)
- **Staff Accounts** (/staff) — manage user accounts (admins only)
- **Alerts panel** — sidebar shows unacknowledged alerts; click the bell icon to acknowledge
- **Glucose status colors**: green = in range, yellow = low/high, red = critical low/high, gray = no data

## Glucose trend arrows
DoubleUp ↑↑ (>3 mg/dL/min rising fast), SingleUp ↑ (2–3 mg/dL/min), FortyFiveUp ↗ (1–2), Flat → (stable), FortyFiveDown ↘, SingleDown ↓, DoubleDown ↓↓ (falling fast)

## Current live data (as of this moment)
### Active campers (${campers.length} total)
${camperLines}

### Unacknowledged alerts
${activeAlerts}

## Guidelines
- Be concise and helpful. Use bullet points for lists.
- For clinical questions, give useful information but always recommend confirming with the nurse or medical director for treatment decisions.
- Do not make up camper data that isn't in the live snapshot above.
- The logged-in user is "${req.user.username}" with role "${req.user.role}".`;

  // Convert history to Anthropic message format (last 20 messages for context)
  const trimmedHistory = history.slice(-20).filter(
    m => m.role && m.content && typeof m.content === 'string'
  );

  const messages = [
    ...trimmedHistory.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const text = response.content[0]?.text || 'Sorry, I could not generate a response.';
    res.json({ response: text });
  } catch (err) {
    console.error('[ai] Anthropic error:', err.message);
    res.status(500).json({ error: 'AI assistant encountered an error. Please try again.' });
  }
});

module.exports = router;
