/**
 * Custom-domain admin + public tenant resolution (P-2b).
 *
 * Admin: set / verify / remove an agent's hostname.
 * Public GET /api/tenant: Host header → branded payload (or null).
 * Never returns domain_verify_token on the public endpoint.
 */
import getPool from '../config/database.js';
import logger from '../utils/logger.js';
import { tenantIdOf, tenantById, DEFAULT_TENANT_ID } from '../services/tenantContext.js';
import { getAgentBrand, publicAgentPayload } from '../services/tenantBrand.js';
import { publicBrand, isHomeTenant } from '../services/brand.js';
import { listingScope } from '../services/feeds.js';
import {
  normalizeDomain,
  isReservedHost,
  generateVerifyToken,
  txtRecordValue,
  verifyDomainTxt,
  resolveTenantByHost,
} from '../services/tenantDomain.js';

const AGENT_RETURNING = `
  id, email, name, phone, role, status, created_at, last_active_at,
  brand_name, brokerage_name, brand_phone, voice_style, market_key,
  custom_domain, domain_verified_at, domain_verify_token
`;

async function loadAgent(pool, id, tenantId) {
  const result = await pool.query(
    `SELECT ${AGENT_RETURNING}
     FROM users
     WHERE id = $1 AND role IN ('agent', 'admin') AND tenant_id = $2`,
    [id, tenantId]
  );
  return result.rows[0] || null;
}

function parseAgentId(req) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

/**
 * POST /api/admin/agents/:id/domain
 * Body: { custom_domain } or { custom_domain: null } to clear.
 */
export const setAgentDomain = async (req, res) => {
  try {
    const id = parseAgentId(req);
    if (!id) return res.status(400).json({ error: 'Invalid agent id' });

    const pool = getPool();
    const existing = await loadAgent(pool, id, tenantIdOf(req));
    if (!existing) return res.status(404).json({ error: 'Agent not found' });

    const raw = req.body?.custom_domain;
    if (raw === null || raw === '') {
      const updated = await pool.query(
        `UPDATE users
            SET custom_domain = NULL,
                domain_verified_at = NULL,
                domain_verify_token = NULL
          WHERE id = $1
          RETURNING ${AGENT_RETURNING}`,
        [id]
      );
      logger.info('Agent custom domain cleared', { id, by: req.user?.email });
      return res.json({ success: true, data: publicAgentPayload(updated.rows[0]) });
    }

    const domain = normalizeDomain(raw);
    if (!domain) {
      return res.status(400).json({
        error: 'Enter a valid hostname (e.g. homes.example.com) — no protocol or path.',
      });
    }
    if (isReservedHost(domain)) {
      return res.status(400).json({ error: 'That domain is reserved.' });
    }

    const token = generateVerifyToken();
    const updated = await pool.query(
      `UPDATE users
          SET custom_domain = $1,
              domain_verify_token = $2,
              domain_verified_at = NULL
        WHERE id = $3
        RETURNING ${AGENT_RETURNING}`,
      [domain, token, id]
    );

    logger.info('Agent custom domain set', { id, domain, by: req.user?.email });
    return res.json({
      success: true,
      data: publicAgentPayload(updated.rows[0]),
      token,
      txt: txtRecordValue(token, { home: isHomeTenant(req.tenant) }),
    });
  } catch (error) {
    logger.error('setAgentDomain error', error);
    return res.status(500).json({ error: 'Failed to set custom domain' });
  }
};

/**
 * POST /api/admin/agents/:id/domain/verify
 * Real DNS TXT check. Never fakes success.
 */
export const verifyAgentDomain = async (req, res) => {
  try {
    const id = parseAgentId(req);
    if (!id) return res.status(400).json({ error: 'Invalid agent id' });

    const pool = getPool();
    const existing = await loadAgent(pool, id, tenantIdOf(req));
    if (!existing) return res.status(404).json({ error: 'Agent not found' });

    const domain = existing.custom_domain;
    const token = existing.domain_verify_token;
    if (!domain || !token) {
      return res.status(400).json({
        error: 'No custom domain is set for this agent. Set a domain first.',
      });
    }

    const ok = await verifyDomainTxt(domain, token);
    if (!ok) {
      return res.status(400).json({
        error: `TXT record not found yet — create ${txtRecordValue(token, { home: isHomeTenant(req.tenant) })} at ${domain} and wait for propagation (up to a few minutes).`,
      });
    }

    let updated;
    try {
      updated = await pool.query(
        `UPDATE users
            SET domain_verified_at = NOW()
          WHERE id = $1
          RETURNING ${AGENT_RETURNING}`,
        [id]
      );
    } catch (err) {
      if (err && err.code === '23505') {
        return res.status(409).json({
          error: 'That domain is already verified for another agent.',
        });
      }
      throw err;
    }

    logger.info('Agent custom domain verified', { id, domain, by: req.user?.email });
    return res.json({
      verified: true,
      success: true,
      data: publicAgentPayload(updated.rows[0]),
    });
  } catch (error) {
    logger.error('verifyAgentDomain error', error);
    return res.status(500).json({ error: 'Failed to verify custom domain' });
  }
};

/**
 * DELETE /api/admin/agents/:id/domain
 */
export const deleteAgentDomain = async (req, res) => {
  try {
    const id = parseAgentId(req);
    if (!id) return res.status(400).json({ error: 'Invalid agent id' });

    const pool = getPool();
    const existing = await loadAgent(pool, id, tenantIdOf(req));
    if (!existing) return res.status(404).json({ error: 'Agent not found' });

    const updated = await pool.query(
      `UPDATE users
          SET custom_domain = NULL,
              domain_verified_at = NULL,
              domain_verify_token = NULL
        WHERE id = $1
        RETURNING ${AGENT_RETURNING}`,
      [id]
    );

    logger.info('Agent custom domain removed', { id, by: req.user?.email });
    return res.json({ success: true, data: publicAgentPayload(updated.rows[0]) });
  } catch (error) {
    logger.error('deleteAgentDomain error', error);
    return res.status(500).json({ error: 'Failed to remove custom domain' });
  }
};

/**
 * GET /api/tenant — PUBLIC. Host header → tenant brand, or { tenant: null }.
 * Never returns the verify token.
 */
export const getPublicTenant = async (req, res) => {
  try {
    let tenant = req.tenant;
    // A brokerage's console on the platform's own site (it has no address
    // yet) names it with ?brokerage=, so the console wears its brand, not
    // the home brokerage's. Only on the platform's host, never an agent's.
    const consoleSlug = String(req.query?.brokerage || '').trim().toLowerCase();
    if (consoleSlug && /^[a-z0-9-]{1,64}$/.test(consoleSlug) && isHomeTenant(tenant) && !tenant?.agent) {
      const r = await getPool().query('SELECT id FROM tenants WHERE slug = $1 AND id <> $2', [consoleSlug, DEFAULT_TENANT_ID]);
      if (r.rows[0]) tenant = await tenantById(Number(r.rows[0].id));
    }
    // Another brokerage's own domain: its brand, never SAA's.
    if (tenant && !isHomeTenant(tenant)) {
      let agent = null;
      if (tenant.agent?.id) {
        const r = await getPool().query(
          `SELECT id, name, email, phone, brand_name, brokerage_name, brand_phone, market_key
           FROM users WHERE id = $1 AND tenant_id = $2`,
          [tenant.agent.id, tenant.id]
        );
        agent = r.rows[0] || null;
      }
      const brand = publicBrand(tenant, { agent });
      const scope = await listingScope(tenant).catch(() => null);
      return res.json({
        tenant: {
          slug: tenant.slug,
          name: tenant.name,
          isBrokerage: true,
          agentName: brand.agentName,
          brand,
          marketKey: tenant.market_key || 'noco',
          marketName: brand.marketName,
          // Sample homes until the MLS approves this site.
          listings: { mode: scope?.demo === false ? 'live' : 'demo', sold: !!scope?.soldFeeds?.length },
        },
      });
    }

    // SAA: an agent's own verified domain gets that agent's brand; SAA's own
    // domains get null so the site stays exactly as it was.
    const host = req.hostname || req.headers.host || '';
    const row = await resolveTenantByHost(getPool(), host);
    if (!row) {
      return res.json({ tenant: null });
    }
    const payload = publicAgentPayload(row);
    const brand = getAgentBrand(row);
    return res.json({
      tenant: {
        agentName: brand.agentName,
        brand: payload.brand,
        marketKey: brand.marketKey,
        marketName: brand.marketName,
      },
    });
  } catch (error) {
    logger.error('getPublicTenant error', error);
    return res.json({ tenant: null });
  }
};
