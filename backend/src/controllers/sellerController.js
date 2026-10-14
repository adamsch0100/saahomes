/**
 * Seller dashboard ("I'm thinking of selling" on My Home).
 *
 * Client (signed in, their own plan only):
 *   GET   /api/seller                       — their plan, or null
 *   POST  /api/seller/start                 — start selling (agent is told)
 *   POST  /api/seller/cma                   — ask for a market analysis (agent is told)
 *   PATCH /api/seller/checklist/:itemId     — { done } tick a prep or closing item
 *
 * Staff (agent or owner, their clients only):
 *   GET    /api/agent/sellers                     — every plan they can see
 *   POST   /api/agent/clients/:id/seller          — one click: this buyer is now selling too
 *   GET    /api/agent/sellers/:planId
 *   PATCH  /api/agent/sellers/:planId             — status, listing, price, checklists, dates, CMA ready
 *   POST   /api/agent/sellers/:planId/offers      — add an offer summary
 *   PATCH  /api/agent/sellers/:planId/offers/:id
 *   DELETE /api/agent/sellers/:planId/offers/:id
 *   POST   /api/agent/sellers/:planId/feedback    — add showing feedback
 *   DELETE /api/agent/sellers/:planId/feedback/:id
 */
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import { resolveUser } from '../services/buyerSession.js';
import { setAuthCookie } from './alertController.js';
import { recordEvent } from '../services/events.js';
import { createNotification } from '../services/notificationService.js';
import { notifyAgent } from '../services/agentNotice.js';
import { visibleClient, visibleClientSql, staffScope } from '../services/clientAccess.js';
import {
  PLAN_STATUSES, startPlan, planForClient, planView, cleanChecklist, cleanTimeline, cleanOffer,
} from '../services/sellerPlans.js';

const fail = (res, error, status = 500) => res.status(status).json({ success: false, error });
const who = (u) => u.name || u.email;

// ------------------------------------------------------------- client

/** GET /api/seller */
export const getMySellerPlan = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return fail(res, 'Not signed in.', 401);
    if (req.query.token) setAuthCookie(res, user.manage_token);
    const pool = getPool();
    const plan = await planForClient(pool, user.id, user.tenant_id);
    return res.json({ success: true, data: plan && plan.status !== 'withdrawn' ? await planView(pool, plan) : null });
  } catch (error) {
    logger.error('getMySellerPlan error', error);
    return fail(res, 'Could not load your selling plan.');
  }
};

/** POST /api/seller/start */
export const startMySellerPlan = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return fail(res, 'Sign in to start your selling plan.', 401);
    const pool = getPool();
    const { plan, created } = await startPlan(pool, {
      client: user,
      origin: 'client',
      homeProfileId: Number(req.body?.home_profile_id) || null,
      address: req.body?.address || null,
    });
    if (created) {
      recordEvent({ type: 'seller_plan_started', userId: user.id, meta: { plan_id: plan.id, by: 'client' } });
      notifyAgent({
        client: user,
        kind: 'seller_start',
        title: `${who(user)} is thinking of selling`,
        lines: [
          plan.address_line ? `Home: ${[plan.address_line, plan.city].filter(Boolean).join(', ')}` : null,
          user.phone ? `Phone: ${user.phone}` : null,
          'Their seller dashboard is open on My Home. Set the dates and prep list when you talk.',
        ],
        dueNow: true,
        pool,
      }).catch(() => {});
      import('../services/followUpBossService.js')
        .then(({ pushNurtureSignalToFollowUpBoss }) => pushNurtureSignalToFollowUpBoss({
          signal: 'seller_heat', tenantId: user.tenant_id, email: user.email, name: user.name, phone: user.phone,
          message: 'Said they are thinking of selling (seller dashboard on My Home).',
        }))
        .catch(() => {});
    }
    return res.status(created ? 201 : 200).json({ success: true, data: await planView(pool, plan) });
  } catch (error) {
    logger.error('startMySellerPlan error', error);
    return fail(res, 'Could not start your selling plan.');
  }
};

/** POST /api/seller/cma */
export const requestCma = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return fail(res, 'Not signed in.', 401);
    const pool = getPool();
    let plan = await planForClient(pool, user.id, user.tenant_id);
    if (!plan || plan.status === 'withdrawn') ({ plan } = await startPlan(pool, { client: user, origin: 'client' }));
    if (plan.cma_requested_at && !plan.cma_ready_at && Date.now() - new Date(plan.cma_requested_at) < 24 * 3600000) {
      return res.json({ success: true, data: await planView(pool, plan) });
    }
    const note = String(req.body?.note || '').trim().slice(0, 1000) || null;
    const { rows: [fresh] } = await pool.query(
      `UPDATE seller_plans SET cma_requested_at = NOW(), cma_note = $1, cma_ready_at = NULL, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [note, plan.id, user.tenant_id]
    );
    recordEvent({ type: 'cma_request', userId: user.id, meta: { plan_id: plan.id } });
    notifyAgent({
      client: user,
      kind: 'cma_request',
      title: `${who(user)} asked for a market analysis`,
      lines: [
        fresh.address_line ? `Home: ${[fresh.address_line, fresh.city].filter(Boolean).join(', ')}` : null,
        note ? `Their note: ${note}` : null,
        user.phone ? `Phone: ${user.phone}` : null,
        'They will see it on their seller dashboard when you mark it ready.',
      ],
      dueNow: true,
      pool,
    }).catch(() => {});
    import('../services/followUpBossService.js')
      .then(({ pushNurtureSignalToFollowUpBoss }) => pushNurtureSignalToFollowUpBoss({
        signal: 'market_analysis', tenantId: user.tenant_id, email: user.email, name: user.name, phone: user.phone,
        message: [fresh.address_line ? `Home: ${fresh.address_line}` : null, note].filter(Boolean).join('\n'),
      }))
      .catch(() => {});
    return res.json({ success: true, data: await planView(pool, fresh) });
  } catch (error) {
    logger.error('requestCma error', error);
    return fail(res, 'Could not send your request.');
  }
};

/** PATCH /api/seller/checklist/:itemId — the client ticks an item done. */
export const tickChecklist = async (req, res) => {
  try {
    const user = await resolveUser(req);
    if (!user) return fail(res, 'Not signed in.', 401);
    const pool = getPool();
    const plan = await planForClient(pool, user.id, user.tenant_id);
    if (!plan) return fail(res, 'No selling plan yet.', 404);
    const list = req.body?.list === 'closing' ? 'closing_checklist' : 'checklist';
    const id = String(req.params.itemId || '');
    const items = Array.isArray(plan[list]) ? plan[list] : [];
    if (!items.some((i) => i.id === id)) return fail(res, 'Item not found.', 404);
    const next = items.map((i) => (i.id === id ? { ...i, done: req.body?.done === true } : i));
    const { rows: [fresh] } = await pool.query(
      `UPDATE seller_plans SET ${list} = $1::jsonb, updated_at = NOW() WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [JSON.stringify(next), plan.id, user.tenant_id]
    );
    return res.json({ success: true, data: await planView(pool, fresh) });
  } catch (error) {
    logger.error('tickChecklist error', error);
    return fail(res, 'Could not save.');
  }
};

// ------------------------------------------------------------- staff

/** The plan when this staff member can see its client; else null. */
async function staffPlan(req, pool) {
  const id = Number(req.params.planId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const { tenantId } = staffScope(req);
  const { rows: [plan] } = await pool.query('SELECT * FROM seller_plans WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  if (!plan) return null;
  return (await visibleClient(req, plan.user_id, pool)) ? plan : null;
}

/** GET /api/agent/sellers */
export const listSellerPlans = async (req, res) => {
  try {
    const pool = getPool();
    const params = [];
    const visible = visibleClientSql(req, params, 'u.');
    const { rows } = await pool.query(
      `SELECT sp.id, sp.user_id, sp.status, sp.address_line, sp.city, sp.list_price, sp.listing_key,
              sp.cma_requested_at, sp.cma_ready_at, sp.updated_at, sp.timeline,
              u.name, u.email, u.phone,
              (SELECT COUNT(*)::int FROM seller_offers o WHERE o.plan_id = sp.id AND o.tenant_id = sp.tenant_id AND o.status IN ('active', 'countered')) AS open_offers
       FROM seller_plans sp JOIN users u ON u.id = sp.user_id AND u.tenant_id = sp.tenant_id
       WHERE ${visible} AND sp.status <> 'withdrawn'
       ORDER BY (sp.cma_requested_at IS NOT NULL AND sp.cma_ready_at IS NULL) DESC, sp.updated_at DESC LIMIT 200`,
      params
    );
    return res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        name: r.name || r.email,
        email: r.email,
        phone: r.phone,
        status: r.status,
        address: [r.address_line, r.city].filter(Boolean).join(', ') || null,
        list_price: r.list_price,
        cma_waiting: !!(r.cma_requested_at && !r.cma_ready_at),
        open_offers: r.open_offers,
        next_step: (r.timeline || []).find((s) => !s.done && s.date) || null,
        updated_at: r.updated_at,
      })),
    });
  } catch (error) {
    logger.error('listSellerPlans error', error);
    return fail(res, 'Could not load sellers.');
  }
};

/** POST /api/agent/clients/:id/seller — buyer to seller in one click, keeping their history. */
export const makeSeller = async (req, res) => {
  try {
    const pool = getPool();
    const client = await visibleClient(req, req.params.id, pool);
    if (!client) return fail(res, 'Client not found.', 404);
    const { staffId } = staffScope(req);
    const { plan, created } = await startPlan(pool, {
      client,
      agentId: client.assigned_agent_id || staffId || null,
      origin: 'agent',
      homeProfileId: Number(req.body?.home_profile_id) || null,
      address: req.body?.address || null,
    });
    if (created) {
      recordEvent({ type: 'seller_plan_started', userId: client.id, tenantId: client.tenant_id, meta: { plan_id: plan.id, by: 'agent' } });
      createNotification({
        userId: client.id,
        type: 'seller_plan',
        title: 'Your selling plan is ready',
        body: 'See your prep list, dates and next steps on My Home.',
        link: '/my-home/?mode=seller',
        pool,
        skipPrefCheck: true,
      }).catch(() => {});
    }
    return res.status(created ? 201 : 200).json({ success: true, data: await planView(pool, plan, { forStaff: true }) });
  } catch (error) {
    logger.error('makeSeller error', error);
    return fail(res, 'Could not start a selling plan.');
  }
};

/** GET /api/agent/sellers/:planId */
export const getSellerPlan = async (req, res) => {
  try {
    const pool = getPool();
    const plan = await staffPlan(req, pool);
    if (!plan) return fail(res, 'Plan not found.', 404);
    return res.json({ success: true, data: await planView(pool, plan, { forStaff: true }) });
  } catch (error) {
    logger.error('getSellerPlan error', error);
    return fail(res, 'Could not load the plan.');
  }
};

/** PATCH /api/agent/sellers/:planId */
export const patchSellerPlan = async (req, res) => {
  try {
    const pool = getPool();
    const plan = await staffPlan(req, pool);
    if (!plan) return fail(res, 'Plan not found.', 404);
    const b = req.body || {};
    const sets = [];
    const params = [];
    const set = (col, val, cast = '') => {
      params.push(val);
      sets.push(`${col} = $${params.length}${cast}`);
    };
    if (b.status !== undefined) {
      if (!PLAN_STATUSES.includes(b.status)) return fail(res, `Status must be one of: ${PLAN_STATUSES.join(', ')}`, 400);
      set('status', b.status);
    }
    if (b.list_price !== undefined) {
      const n = b.list_price === null || b.list_price === '' ? null : Math.round(Number(String(b.list_price).replace(/[$,]/g, '')));
      if (n !== null && !(n >= 1000 && n <= 100000000)) return fail(res, 'Check the list price.', 400);
      set('list_price', n);
    }
    if (b.listing_key !== undefined) set('listing_key', String(b.listing_key || '').trim().slice(0, 64) || null);
    for (const [k, max] of [['address_line', 255], ['city', 100], ['postal_code', 16]]) {
      if (b[k] !== undefined) set(k, String(b[k] || '').trim().slice(0, max) || null);
    }
    for (const [k, clean] of [['checklist', cleanChecklist], ['closing_checklist', cleanChecklist], ['timeline', cleanTimeline]]) {
      if (b[k] !== undefined) {
        const v = clean(b[k]);
        if (!v) return fail(res, `Could not read the ${k.replace('_', ' ')}.`, 400);
        set(k, JSON.stringify(v), '::jsonb');
      }
    }
    if (b.cma_ready !== undefined) {
      if (b.cma_ready) {
        sets.push('cma_ready_at = NOW()');
        set('cma_summary', String(b.cma_summary || '').trim().slice(0, 2000) || null);
      } else {
        sets.push('cma_ready_at = NULL');
      }
    } else if (b.cma_summary !== undefined) {
      set('cma_summary', String(b.cma_summary || '').trim().slice(0, 2000) || null);
    }
    if (!sets.length) return fail(res, 'Nothing to update.', 400);
    params.push(plan.id, plan.tenant_id);
    const { rows: [fresh] } = await pool.query(
      `UPDATE seller_plans SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length - 1} AND tenant_id = $${params.length} RETURNING *`,
      params
    );
    if (b.cma_ready === true && !plan.cma_ready_at) {
      createNotification({
        userId: plan.user_id, type: 'seller_plan', title: 'Your market analysis is ready',
        body: 'See it on your seller dashboard.', link: '/my-home/?mode=seller', pool, skipPrefCheck: true,
      }).catch(() => {});
    }
    return res.json({ success: true, data: await planView(pool, fresh, { forStaff: true }) });
  } catch (error) {
    logger.error('patchSellerPlan error', error);
    return fail(res, 'Could not update the plan.');
  }
};

/** POST /api/agent/sellers/:planId/offers */
export const addOffer = async (req, res) => {
  try {
    const pool = getPool();
    const plan = await staffPlan(req, pool);
    if (!plan) return fail(res, 'Plan not found.', 404);
    const { offer, error } = cleanOffer(req.body || {});
    if (error) return fail(res, error, 400);
    const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int AS n FROM seller_offers WHERE plan_id = $1 AND tenant_id = $2', [plan.id, plan.tenant_id]);
    if (!offer.label) offer.label = `Offer ${String.fromCharCode(65 + (n % 26))}`;
    const cols = Object.keys(offer);
    await pool.query(
      `INSERT INTO seller_offers (tenant_id, plan_id, created_by, ${cols.join(', ')})
       VALUES ($1, $2, $3, ${cols.map((_, i) => `$${i + 4}`).join(', ')})`,
      [plan.tenant_id, plan.id, staffScope(req).staffId || null, ...cols.map((c) => offer[c])]
    );
    createNotification({
      userId: plan.user_id, type: 'seller_plan', title: 'You have a new offer',
      body: 'Your agent added an offer to your seller dashboard.', link: '/my-home/?mode=seller', pool, skipPrefCheck: true,
    }).catch(() => {});
    return res.status(201).json({ success: true, data: await planView(pool, plan, { forStaff: true }) });
  } catch (error) {
    logger.error('addOffer error', error);
    return fail(res, 'Could not add the offer.');
  }
};

/** PATCH /api/agent/sellers/:planId/offers/:id */
export const patchOffer = async (req, res) => {
  try {
    const pool = getPool();
    const plan = await staffPlan(req, pool);
    if (!plan) return fail(res, 'Plan not found.', 404);
    const { rows: [existing] } = await pool.query(
      'SELECT * FROM seller_offers WHERE id = $1 AND plan_id = $2 AND tenant_id = $3', [Number(req.params.id) || 0, plan.id, plan.tenant_id]
    );
    if (!existing) return fail(res, 'Offer not found.', 404);
    const merged = {
      ...existing,
      close_date: existing.close_date ? new Date(existing.close_date).toISOString().slice(0, 10) : null,
      ...(req.body || {}),
    };
    const { offer, error } = cleanOffer(merged);
    if (error) return fail(res, error, 400);
    const cols = Object.keys(offer);
    await pool.query(
      `UPDATE seller_offers SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')}, updated_at = NOW()
       WHERE id = $${cols.length + 1} AND tenant_id = $${cols.length + 2}`,
      [...cols.map((c) => offer[c]), existing.id, plan.tenant_id]
    );
    if (offer.status === 'accepted' && plan.status === 'listed') {
      await pool.query("UPDATE seller_plans SET status = 'under_contract', updated_at = NOW() WHERE id = $1 AND tenant_id = $2", [plan.id, plan.tenant_id]);
    }
    const { rows: [fresh] } = await pool.query('SELECT * FROM seller_plans WHERE id = $1', [plan.id]);
    return res.json({ success: true, data: await planView(pool, fresh, { forStaff: true }) });
  } catch (error) {
    logger.error('patchOffer error', error);
    return fail(res, 'Could not update the offer.');
  }
};

/** DELETE /api/agent/sellers/:planId/offers/:id */
export const deleteOffer = async (req, res) => {
  try {
    const pool = getPool();
    const plan = await staffPlan(req, pool);
    if (!plan) return fail(res, 'Plan not found.', 404);
    await pool.query('DELETE FROM seller_offers WHERE id = $1 AND plan_id = $2 AND tenant_id = $3', [Number(req.params.id) || 0, plan.id, plan.tenant_id]);
    return res.json({ success: true, data: await planView(pool, plan, { forStaff: true }) });
  } catch (error) {
    logger.error('deleteOffer error', error);
    return fail(res, 'Could not remove the offer.');
  }
};

/** POST /api/agent/sellers/:planId/feedback */
export const addFeedback = async (req, res) => {
  try {
    const pool = getPool();
    const plan = await staffPlan(req, pool);
    if (!plan) return fail(res, 'Plan not found.', 404);
    const text = String(req.body?.feedback || '').trim().slice(0, 1500);
    if (!text) return fail(res, 'Add the feedback.', 400);
    const shownOn = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.shown_on || '')) ? req.body.shown_on : null;
    const interest = ['high', 'medium', 'low'].includes(req.body?.interest) ? req.body.interest : null;
    await pool.query(
      `INSERT INTO seller_showing_feedback (tenant_id, plan_id, shown_on, interest, feedback, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [plan.tenant_id, plan.id, shownOn, interest, text, staffScope(req).staffId || null]
    );
    return res.status(201).json({ success: true, data: await planView(pool, plan, { forStaff: true }) });
  } catch (error) {
    logger.error('addFeedback error', error);
    return fail(res, 'Could not add the feedback.');
  }
};

/** DELETE /api/agent/sellers/:planId/feedback/:id */
export const deleteFeedback = async (req, res) => {
  try {
    const pool = getPool();
    const plan = await staffPlan(req, pool);
    if (!plan) return fail(res, 'Plan not found.', 404);
    await pool.query('DELETE FROM seller_showing_feedback WHERE id = $1 AND plan_id = $2 AND tenant_id = $3', [Number(req.params.id) || 0, plan.id, plan.tenant_id]);
    return res.json({ success: true, data: await planView(pool, plan, { forStaff: true }) });
  } catch (error) {
    logger.error('deleteFeedback error', error);
    return fail(res, 'Could not remove the feedback.');
  }
};
