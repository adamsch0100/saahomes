/**
 * Public agent website form capture (P-3b).
 * POST /api/webform/lead — no auth; resolves agent by webform_slug.
 * Never returns fub_api_key or agent private data.
 */
import crypto from 'crypto';
import getPool from '../config/database.js';
import { forwardContactToFollowUpBoss } from '../services/followUpBossService.js';
import {
  normalizeEmail,
  isValidLeadEmail,
  isDisposableEmail,
  logBlockedEmail,
  noteIfDuplicateSubmission,
} from '../utils/emailQuality.js';
import logger from '../utils/logger.js';

/** Known-safe source tags for client rows (never free-form arbitrary). */
const SAFE_SOURCES = new Set([
  'webform',
  'agent-site',
  'agent-website',
  'website',
  'embed',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanPhone(v) {
  const digits = String(v || '').replace(/\D/g, '');
  if (digits.length >= 7 && digits.length <= 15) return digits;
  return null;
}

function sanitizeInterest(v) {
  if (v == null) return null;
  const s = String(v).trim().slice(0, 100);
  return s || null;
}

function sanitizeMessage(v) {
  if (v == null) return null;
  const s = String(v).trim().slice(0, 5000);
  return s || null;
}

function sanitizeArea(v) {
  if (v == null) return null;
  const s = String(v).trim().slice(0, 100);
  return s || null;
}

function sanitizeName(v) {
  if (v == null) return null;
  const s = String(v).trim().slice(0, 255);
  return s || null;
}

function resolveSource(raw) {
  if (raw == null || raw === '') return 'webform';
  const s = String(raw).trim().toLowerCase().slice(0, 64);
  if (SAFE_SOURCES.has(s)) return s === 'website' || s === 'embed' || s === 'agent-site' || s === 'agent-website'
    ? 'webform'
    : s;
  return 'webform';
}

/**
 * POST /api/webform/lead
 * Body: { slug, name, email, phone, interest?, message?, area?, source? }
 * Response: { ok: true, leadId, duplicate } — or error. Never leaks agent PII/keys.
 */
export const submitWebformLead = async (req, res) => {
  try {
    const slug = String(req.body?.slug || '').trim().toLowerCase();
    if (!slug || slug.length > 80) {
      return res.status(400).json({ ok: false, error: 'slug is required' });
    }

    const emailRaw = req.body?.email;
    const phoneRaw = req.body?.phone;
    const name = sanitizeName(req.body?.name);
    const interest = sanitizeInterest(req.body?.interest);
    const message = sanitizeMessage(req.body?.message);
    const area = sanitizeArea(req.body?.area);
    const source = resolveSource(req.body?.source);

    const email = normalizeEmail(emailRaw);
    if (!email || !EMAIL_RE.test(email) || !isValidLeadEmail(email)) {
      if (email && isDisposableEmail(email)) {
        logBlockedEmail(email, 'webform').catch(() => {});
        return res.status(400).json({ ok: false, error: 'Please use a real email address' });
      }
      return res.status(400).json({ ok: false, error: 'A valid email is required' });
    }

    const phone = cleanPhone(phoneRaw);
    if (!phone) {
      return res.status(400).json({ ok: false, error: 'A valid phone number is required' });
    }

    const pool = getPool();

    // Resolve agent by public slug only (active agent or admin)
    const agentRes = await pool.query(
      `SELECT id, email, name, brand_name, fub_api_key, role, status
       FROM users
       WHERE webform_slug = $1
         AND role IN ('agent', 'admin')
         AND status = 'active'
       LIMIT 1`,
      [slug]
    );
    const agent = agentRes.rows[0];
    if (!agent) {
      return res.status(404).json({ ok: false, error: 'Unknown form link' });
    }

    // Observability for rapid re-submits (never blocks)
    noteIfDuplicateSubmission(pool, email, 'webform').catch(() => {});

    // Dedupe: existing client by email, then phone — never create a second row
    let existing = null;
    const byEmail = await pool.query(
      `SELECT * FROM users
       WHERE LOWER(email) = $1 AND COALESCE(role, 'client') = 'client'
       LIMIT 1`,
      [email]
    );
    existing = byEmail.rows[0] || null;

    if (!existing) {
      const byPhone = await pool.query(
        `SELECT * FROM users
         WHERE COALESCE(role, 'client') = 'client'
           AND phone IS NOT NULL AND TRIM(phone) <> ''
           AND regexp_replace(phone, '\\D', '', 'g') IN ($1, $2)
         LIMIT 1`,
        [phone, phone.length === 10 ? `1${phone}` : phone]
      );
      existing = byPhone.rows[0] || null;
    }

    // Never demote agent/admin accounts that share the email
    const staff = await pool.query(
      `SELECT id FROM users WHERE LOWER(email) = $1 AND role IN ('agent', 'admin') LIMIT 1`,
      [email]
    );
    if (staff.rows[0] && !existing) {
      return res.status(400).json({
        ok: false,
        error: 'This email cannot be used for a lead submission',
      });
    }

    let leadId;
    let duplicate = false;

    if (existing) {
      duplicate = true;
      leadId = existing.id;
      const updates = [];
      const params = [];
      let i = 1;

      if (name && !existing.name) {
        updates.push(`name = $${i++}`);
        params.push(name);
      }
      if (phone && !existing.phone) {
        updates.push(`phone = $${i++}`);
        params.push(phone);
      }
      // Always assign to the webform owner when unassigned; keep existing assignment otherwise
      if (existing.assigned_agent_id == null) {
        updates.push(`assigned_agent_id = $${i++}`);
        params.push(agent.id);
      }
      if (!existing.source) {
        updates.push(`source = $${i++}`);
        params.push(source);
      }
      updates.push(`status = 'active'`);
      updates.push(`last_active_at = NOW()`);

      params.push(existing.id);
      await pool.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${i}`,
        params
      );
    } else {
      const manageToken = crypto.randomBytes(24).toString('hex');
      const inserted = await pool.query(
        `INSERT INTO users (
           email, name, phone, manage_token, role, status,
           source, assigned_agent_id, lifecycle_stage, lifecycle_stage_manual,
           last_active_at
         ) VALUES (
           $1, $2, $3, $4, 'client', 'active',
           $5, $6, 'new', FALSE,
           NOW()
         ) RETURNING id`,
        [email, name, phone, manageToken, source, agent.id]
      );
      leadId = inserted.rows[0].id;
    }

    // Optional interest/area/message land on contact_submissions for history + FUB body
    // (users table has no freeform interest column)
    try {
      await pool.query(
        `INSERT INTO contact_submissions
           (name, email, phone, interest, message, area, source_page)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          name || null,
          email,
          phone,
          interest,
          message,
          area,
          `webform:${slug}`,
        ]
      );
    } catch (err) {
      logger.warn('webform contact_submissions insert failed (non-blocking)', {
        message: err.message,
      });
    }

    // FUB: agent key when connected, else brokerage env key. Lead is stored either way.
    const agentKey = agent.fub_api_key && String(agent.fub_api_key).trim()
      ? String(agent.fub_api_key).trim()
      : null;

    let fub = { success: false, reason: 'not_attempted' };
    try {
      fub = await forwardContactToFollowUpBoss(
        {
          name: name || email,
          email,
          phone,
          interest,
          message,
          area,
          sourcePage: `webform:${slug}`,
        },
        {
          apiKey: agentKey || undefined,
          eventSource: 'Agent Website Form',
          tags: ['Website Lead', 'Agent Webform', 'saahomes.com'],
          path: 'webform',
        }
      );
    } catch (err) {
      logger.error('webform FUB forward failed (non-blocking)', err);
      fub = { success: false, error: err.message };
    }

    // Lifecycle refresh for cockpit
    import('../services/agentCockpit.js')
      .then(({ refreshLeadLifecycle }) => refreshLeadLifecycle(leadId))
      .catch(() => {});

    logger.info('Webform lead captured', {
      leadId,
      duplicate,
      agentId: agent.id,
      slug,
      fubSuccess: !!fub?.success,
      fubReason: fub?.reason || null,
    });

    // Honest public response — no agent email/phone/key
    const body = {
      ok: true,
      leadId,
      duplicate,
    };
    if (!fub?.success) {
      body.crm = fub?.reason === 'not_configured'
        ? 'not_configured'
        : 'forward_failed';
    } else {
      body.crm = 'forwarded';
    }

    return res.status(duplicate ? 200 : 201).json(body);
  } catch (error) {
    logger.error('submitWebformLead error', error);
    return res.status(500).json({ ok: false, error: 'Failed to submit form. Please try again later.' });
  }
};
