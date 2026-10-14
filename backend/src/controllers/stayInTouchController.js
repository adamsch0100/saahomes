/**
 * Stay in touch after closing.
 *
 * Staff (agent or owner, their clients only):
 *   GET   /api/agent/stay                         — who gets what next
 *   GET   /api/agent/clients/:id/closing          — closing facts (or a prefill)
 *   POST  /api/agent/clients/:id/closing          — save closing facts, mark closed
 *   PATCH /api/agent/stay/:id                     — { kind, on } | { agent_note } | { target_rate }
 *   GET   /api/agent/stay/:id/preview/:kind       — the email as it would go out
 *   GET   /api/agent/stay/template                — the agent's birthday note
 *   PUT   /api/agent/stay/template                — { subject, body, approve }
 *   GET   /api/agent/stay/settings                — brokerage tax season month
 *   PUT   /api/agent/stay/settings                — owners only: { tax_month, tax_enabled }
 *
 * Client (signed in, or the ?token= link in the email):
 *   GET   /api/stay/me                            — their stay-in-touch emails
 *   PUT   /api/stay/me                            — { kind, on } | { target_rate }
 */
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import { denverToday } from './tourController.js';
import { resolveUser } from '../services/buyerSession.js';
import { setAuthCookie } from './alertController.js';
import { clearTenantCache } from '../services/tenantContext.js';
import { visibleClient, visibleClientSql, staffScope, staffRow } from '../services/clientAccess.js';
import {
  STAY_KINDS, STAY_LABELS, KIND_HELP, NEIGHBOR_MONTHLY_CAP, cleanClosingFacts, saveClosing, setStayPref, loadPrefs,
  clientState, planFor, buildStayEmail, kindsForClosing, staySettings, birthdayTemplate, latestMortgageRate, rateSourceConfigured,
} from '../services/stayInTouch.js';
import { DEFAULT_BIRTHDAY_TEMPLATE } from '../services/stayEmails.js';

const fail = (res, error, status = 500) => res.status(status).json({ success: false, error });
const ymd = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

function closingOut(c) {
  if (!c) return null;
  return {
    side: c.side,
    address_line: c.address_line,
    city: c.city,
    state: c.state,
    postal_code: c.postal_code,
    close_date: ymd(c.close_date),
    close_price: c.close_price,
    loan_amount: c.loan_amount,
    loan_rate: c.loan_rate != null ? Number(c.loan_rate) : null,
    loan_years: c.loan_years,
    birthday: c.birthday_month ? `${String(c.birthday_month).padStart(2, '0')}-${String(c.birthday_day).padStart(2, '0')}` : null,
    stay_in_touch: c.stay_in_touch,
    consent_at: c.consent_at,
    target_rate: c.target_rate != null ? Number(c.target_rate) : null,
    agent_note: c.agent_note,
    updated_at: c.updated_at,
  };
}

/** GET /api/agent/stay */
export const listStayInTouch = async (req, res) => {
  try {
    const pool = getPool();
    const params = [];
    const visible = visibleClientSql(req, params, 'u.');
    const { rows } = await pool.query(
      `SELECT c.*, u.name, u.email, u.phone, u.manage_token, u.assigned_agent_id, u.status AS user_status,
              si.score AS seller_score, si.reasons AS seller_reasons
       FROM client_closings c
       JOIN users u ON u.id = c.user_id AND u.tenant_id = c.tenant_id
       LEFT JOIN seller_intent si ON si.user_id = u.id
       WHERE ${visible}
       ORDER BY c.close_date DESC LIMIT 500`,
      params
    );
    const today = denverToday();
    const rate = await latestMortgageRate({ pool });
    const items = [];
    for (const r of rows) {
      const client = { id: r.user_id, tenant_id: r.tenant_id, assigned_agent_id: r.assigned_agent_id };
      const state = await clientState(pool, r, client, { today, rate });
      const plan = planFor(r, today, state).map((p) => (r.user_status !== 'active' ? { ...p, status: 'off_by_client', detail: 'Unsubscribed from all emails.' } : p));
      const next = plan.filter((p) => p.next_on && p.status === 'scheduled').sort((a, b) => a.next_on.localeCompare(b.next_on))[0] || null;
      items.push({
        user_id: r.user_id,
        name: r.name || r.email,
        email: r.email,
        phone: r.phone,
        closing: closingOut(r),
        plan,
        next,
        seller_score: r.seller_score ?? null,
        seller_reasons: r.seller_reasons || [],
      });
    }
    items.sort((a, b) => (a.next?.next_on || '9999').localeCompare(b.next?.next_on || '9999'));
    return res.json({
      success: true,
      data: {
        items,
        kinds: STAY_KINDS.map((k) => ({ kind: k, label: STAY_LABELS[k], help: KIND_HELP[k] })),
        neighbor_cap: NEIGHBOR_MONTHLY_CAP,
        rate_source: rateSourceConfigured(),
        rate: rate ? { rate: rate.rate, as_of: rate.as_of, source: rate.source } : null,
        settings: staySettings(req.tenant),
      },
    });
  } catch (error) {
    logger.error('listStayInTouch error', error);
    return fail(res, 'Could not load your stay-in-touch list.');
  }
};

/** GET /api/agent/clients/:id/closing */
export const getClosing = async (req, res) => {
  try {
    const pool = getPool();
    const client = await visibleClient(req, req.params.id, pool);
    if (!client) return fail(res, 'Client not found.', 404);
    const { rows: [c] } = await pool.query('SELECT * FROM client_closings WHERE user_id = $1 AND tenant_id = $2', [client.id, client.tenant_id]);
    let prefill = null;
    if (!c) {
      const { rows: [home] } = await pool.query(
        'SELECT address_line, city, state, postal_code FROM home_profiles WHERE user_id = $1 ORDER BY updated_at DESC NULLS LAST LIMIT 1',
        [client.id]
      );
      prefill = { side: client.intent === 'selling' ? 'seller' : 'buyer', ...(home || {}), close_date: denverToday() };
    }
    return res.json({ success: true, data: { client: { id: client.id, name: client.name, email: client.email }, closing: closingOut(c), prefill } });
  } catch (error) {
    logger.error('getClosing error', error);
    return fail(res, 'Could not load closing details.');
  }
};

/** POST /api/agent/clients/:id/closing — save facts and mark the client closed. */
export const postClosing = async (req, res) => {
  try {
    const pool = getPool();
    const client = await visibleClient(req, req.params.id, pool);
    if (!client) return fail(res, 'Client not found.', 404);
    const { facts, error } = cleanClosingFacts(req.body || {});
    if (error) return fail(res, error, 400);
    const { staffId } = staffScope(req);
    const agentId = client.assigned_agent_id || staffId || null;
    const saved = await saveClosing(pool, { client, agentId, facts });
    if (req.body?.mark_closed !== false) {
      await pool.query(
        "UPDATE users SET lifecycle_stage = 'closed', lifecycle_stage_manual = TRUE, next_touch_at = NULL WHERE id = $1 AND tenant_id = $2",
        [client.id, client.tenant_id]
      );
      // Buyer plans end; a "closed" plan (past client) starts if one is on.
      const { onStageChanged } = await import('../services/actionPlans.js');
      await onStageChanged({ tenantId: client.tenant_id, leadId: client.id, from: client.lifecycle_stage || null, to: 'closed' }, pool)
        .catch((e) => logger.warn('closing plan trigger failed', { message: e.message }));
    }
    // A sale closed through the seller dashboard closes the plan too.
    if (facts.side === 'seller') {
      await pool.query(
        "UPDATE seller_plans SET status = 'closed', updated_at = NOW() WHERE user_id = $1 AND tenant_id = $2 AND status <> 'withdrawn'",
        [client.id, client.tenant_id]
      );
    }
    const state = await clientState(pool, saved, client);
    return res.status(201).json({
      success: true,
      data: { closing: closingOut(saved), plan: planFor(saved, denverToday(), state) },
    });
  } catch (error) {
    logger.error('postClosing error', error);
    return fail(res, 'Could not save closing details.');
  }
};

/** PATCH /api/agent/stay/:id */
export const patchStay = async (req, res) => {
  try {
    const pool = getPool();
    const client = await visibleClient(req, req.params.id, pool);
    if (!client) return fail(res, 'Client not found.', 404);
    const { rows: [closing] } = await pool.query('SELECT * FROM client_closings WHERE user_id = $1 AND tenant_id = $2', [client.id, client.tenant_id]);
    if (!closing) return fail(res, 'Add closing details first.', 404);
    const body = req.body || {};
    if (body.kind !== undefined) {
      if (!STAY_KINDS.includes(body.kind)) return fail(res, 'Unknown email type.', 400);
      await setStayPref(pool, { tenantId: client.tenant_id, userId: client.id, kind: body.kind, by: 'agent', off: body.on === false });
    }
    if (body.agent_note !== undefined) {
      await pool.query('UPDATE client_closings SET agent_note = $1, updated_at = NOW() WHERE id = $2',
        [String(body.agent_note || '').trim().slice(0, 2000) || null, closing.id]);
    }
    if (body.target_rate !== undefined) {
      const t = body.target_rate === null || body.target_rate === '' ? null : Number(body.target_rate);
      if (t !== null && !(t >= 0.5 && t <= 25)) return fail(res, 'Target rate should be between 0.5% and 25%.', 400);
      await pool.query('UPDATE client_closings SET target_rate = $1, updated_at = NOW() WHERE id = $2', [t, closing.id]);
    }
    const { rows: [fresh] } = await pool.query('SELECT * FROM client_closings WHERE id = $1', [closing.id]);
    const state = await clientState(pool, fresh, client);
    return res.json({ success: true, data: { closing: closingOut(fresh), plan: planFor(fresh, denverToday(), state) } });
  } catch (error) {
    logger.error('patchStay error', error);
    return fail(res, error.status ? error.message : 'Could not update.', error.status || 500);
  }
};

/** GET /api/agent/stay/:id/preview/:kind */
export const previewStay = async (req, res) => {
  try {
    const pool = getPool();
    const kind = String(req.params.kind || '');
    if (!STAY_KINDS.includes(kind)) return fail(res, 'Unknown email type.', 400);
    const client = await visibleClient(req, req.params.id, pool);
    if (!client) return fail(res, 'Client not found.', 404);
    const { rows: [closing] } = await pool.query('SELECT * FROM client_closings WHERE user_id = $1 AND tenant_id = $2', [client.id, client.tenant_id]);
    if (!closing) return fail(res, 'Add closing details first.', 404);
    if (!kindsForClosing(closing).includes(kind)) return fail(res, 'That email does not apply to this client.', 400);
    const built = await buildStayEmail(pool, {
      closing, client, kind, preview: true, rate: await latestMortgageRate({ pool }),
    });
    if (built.skip) return fail(res, 'Nothing to preview yet.', 404);
    if (req.query.format === 'html') {
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.set('Cache-Control', 'private, no-store');
      return res.send(built.html);
    }
    return res.json({ success: true, data: { subject: built.subject, html: built.html } });
  } catch (error) {
    logger.error('previewStay error', error);
    return fail(res, 'Could not build the preview.');
  }
};

/** GET /api/agent/stay/template */
export const getStayTemplate = async (req, res) => {
  try {
    const t = await birthdayTemplate(getPool(), staffScope(req).staffId);
    return res.json({ success: true, data: { kind: 'birthday', subject: t.subject, body: t.body, approved: t.approved, approved_at: t.approved_at || null, is_default: t.is_default, placeholders: ['{first_name}', '{agent_name}', '{brand_name}'] } });
  } catch (error) {
    logger.error('getStayTemplate error', error);
    return fail(res, 'Could not load your birthday note.');
  }
};

/** PUT /api/agent/stay/template */
export const putStayTemplate = async (req, res) => {
  try {
    const me = await staffRow(req);
    if (!me) return fail(res, 'Sign in with your own account to save a note.', 403);
    const subject = String(req.body?.subject ?? DEFAULT_BIRTHDAY_TEMPLATE.subject).trim().slice(0, 150);
    const body = String(req.body?.body ?? DEFAULT_BIRTHDAY_TEMPLATE.body).trim().slice(0, 2000);
    if (!subject || !body) return fail(res, 'Add a subject and a note.', 400);
    const approve = req.body?.approve === true;
    const { rows: [t] } = await getPool().query(
      `INSERT INTO stay_touch_templates (tenant_id, agent_id, kind, subject, body, approved_at)
       VALUES ($1, $2, 'birthday', $3, $4, CASE WHEN $5::boolean THEN NOW() END)
       ON CONFLICT (agent_id, kind) DO UPDATE SET subject = EXCLUDED.subject, body = EXCLUDED.body,
         approved_at = EXCLUDED.approved_at, updated_at = NOW()
       RETURNING *`,
      [me.tenant_id, me.id, subject, body, approve]
    );
    return res.json({ success: true, data: { kind: 'birthday', subject: t.subject, body: t.body, approved: !!t.approved_at, approved_at: t.approved_at, is_default: false } });
  } catch (error) {
    logger.error('putStayTemplate error', error);
    return fail(res, 'Could not save your birthday note.');
  }
};

/** GET /api/agent/stay/settings */
export const getStaySettings = async (req, res) => res.json({
  success: true,
  data: { ...staySettings(req.tenant), can_edit: staffScope(req).isAdmin, rate_source: rateSourceConfigured() },
});

/** PUT /api/agent/stay/settings — owners only. */
export const putStaySettings = async (req, res) => {
  try {
    if (!staffScope(req).isAdmin) return fail(res, 'Only the brokerage owner can change this.', 403);
    const month = req.body?.tax_month === null || req.body?.tax_month === '' ? null : Number(req.body?.tax_month);
    if (month !== null && !(Number.isInteger(month) && month >= 1 && month <= 12)) return fail(res, 'Pick a month.', 400);
    const value = { tax_month: month, tax_enabled: req.body?.tax_enabled !== false && month !== null };
    const { rows: [t] } = await getPool().query(
      `UPDATE tenants SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{stay_in_touch}',
         COALESCE(settings->'stay_in_touch', '{}'::jsonb) || $1::jsonb)
       WHERE id = $2 RETURNING settings`,
      [JSON.stringify(value), staffScope(req).tenantId]
    );
    clearTenantCache();
    return res.json({ success: true, data: { ...staySettings({ id: staffScope(req).tenantId, settings: t.settings }), can_edit: true, rate_source: rateSourceConfigured() } });
  } catch (error) {
    logger.error('putStaySettings error', error);
    return fail(res, 'Could not save.');
  }
};

// ------------------------------------------------------------- client

async function clientStay(pool, user) {
  const { rows: [closing] } = await pool.query('SELECT * FROM client_closings WHERE user_id = $1 AND tenant_id = $2', [user.id, user.tenant_id]);
  if (!closing) return { has_closing: false, kinds: [] };
  const prefs = await loadPrefs(pool, user.id);
  return {
    has_closing: true,
    stay_in_touch: closing.stay_in_touch,
    target_rate: closing.target_rate != null ? Number(closing.target_rate) : null,
    rate_source: rateSourceConfigured(),
    kinds: kindsForClosing(closing).map((k) => ({
      kind: k,
      label: STAY_LABELS[k],
      on: closing.stay_in_touch && !prefs[k]?.client_off && !prefs[k]?.agent_off,
      off_by_agent: !!prefs[k]?.agent_off,
    })),
  };
}

/** GET /api/stay/me */
export const getMyStay = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return fail(res, 'Not signed in.', 401);
    if (req.query.token) setAuthCookie(res, user.manage_token);
    return res.json({ success: true, data: await clientStay(getPool(), user) });
  } catch (error) {
    logger.error('getMyStay error', error);
    return fail(res, 'Could not load your email settings.');
  }
};

/** PUT /api/stay/me — a client turns one kind on/off, or sets a target rate. */
export const putMyStay = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return fail(res, 'Not signed in.', 401);
    const pool = getPool();
    const { rows: [closing] } = await pool.query('SELECT id FROM client_closings WHERE user_id = $1 AND tenant_id = $2', [user.id, user.tenant_id]);
    if (!closing) return fail(res, 'Nothing to change yet.', 404);
    const body = req.body || {};
    if (body.kind !== undefined) {
      if (!STAY_KINDS.includes(body.kind)) return fail(res, 'Unknown email type.', 400);
      await setStayPref(pool, { tenantId: user.tenant_id, userId: user.id, kind: body.kind, by: 'client', off: body.on === false });
    }
    if (body.target_rate !== undefined) {
      const t = body.target_rate === null || body.target_rate === '' ? null : Number(body.target_rate);
      if (t !== null && !(t >= 0.5 && t <= 25)) return fail(res, 'Pick a rate between 0.5% and 25%.', 400);
      await pool.query('UPDATE client_closings SET target_rate = $1, updated_at = NOW() WHERE id = $2', [t, closing.id]);
    }
    return res.json({ success: true, data: await clientStay(pool, user) });
  } catch (error) {
    logger.error('putMyStay error', error);
    return fail(res, 'Could not save your email settings.');
  }
};
