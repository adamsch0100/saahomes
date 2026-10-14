/**
 * Which clients a signed-in staff member may work with: their own brokerage
 * only; owners (admins) see every client there, agents per the brokerage's
 * lead visibility (the same rule as the cockpit).
 */
import getPool from '../config/database.js';
import { tenantIdOf, leadVisibility } from './tenantContext.js';

/** { tenantId, staffId, isAdmin } for the request's staff token. */
export function staffScope(req) {
  return {
    tenantId: tenantIdOf(req),
    staffId: Number(req.user?.id) || 0,
    isAdmin: String(req.user?.role || '') === 'admin',
  };
}

/** WHERE fragment for visible clients; appends its values to params. */
export function visibleClientSql(req, params, alias = '') {
  const { tenantId, staffId, isAdmin } = staffScope(req);
  params.push(tenantId);
  let sql = `${alias}tenant_id = $${params.length} AND COALESCE(${alias}role, 'client') = 'client'`;
  const visibility = isAdmin ? 'all' : leadVisibility(req.tenant);
  if (visibility !== 'all') {
    params.push(staffId);
    const p = `$${params.length}`;
    sql += visibility === 'own'
      ? ` AND ${alias}assigned_agent_id = ${p}`
      : ` AND (${alias}assigned_agent_id = ${p} OR ${alias}assigned_agent_id IS NULL)`;
  }
  return sql;
}

/** The client row when this staff member may see it, else null. */
export async function visibleClient(req, userId, pool = getPool()) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const params = [id];
  const { rows } = await pool.query(
    `SELECT * FROM users WHERE id = $1 AND ${visibleClientSql(req, params)}`,
    params
  );
  return rows[0] || null;
}

/** The staff member's own users row (null for the platform login). */
export async function staffRow(req, pool = getPool()) {
  const { staffId, tenantId } = staffScope(req);
  if (!staffId) return null;
  const { rows } = await pool.query(
    "SELECT id, name, email, phone, role, tenant_id FROM users WHERE id = $1 AND tenant_id = $2 AND role IN ('agent', 'admin')",
    [staffId, tenantId]
  );
  return rows[0] || null;
}
