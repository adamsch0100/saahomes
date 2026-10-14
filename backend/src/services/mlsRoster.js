/**
 * The MLS's office and agent roster (MLS Grid Office and Member resources).
 *
 * IDX rules want "Listing courtesy of {office}" on every home. IRES's listing
 * feed refuses ListOfficeName in $select but carries the office's MLS id, so
 * the names come from the roster: refreshed daily after the full sync, then
 * copied onto listings and sold listings that have the id but no name.
 *
 * Read-only against the MLS, never blocks the listing sync: any error is
 * logged and the next day tries again.
 */
import getPool from '../config/database.js';
import { getToken } from './iresSync.js';

const PAGE = 1000;
const MAX_PAGES = 60;
const PAUSE_MS = 700; // same pace as the listing sync
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const RESOURCES = {
  office: {
    path: 'Office', table: 'mls_offices', idCol: 'office_mls_id', nameCol: 'name',
    idField: 'OfficeMlsId', nameField: 'OfficeName',
  },
  member: {
    path: 'Member', table: 'mls_members', idCol: 'member_mls_id', nameCol: 'full_name',
    idField: 'MemberMlsId', nameField: 'MemberFullName',
  },
};

async function fetchJson(url, token, fetchImpl) {
  const res = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'User-Agent': 'saahomes-idx/1.0 (Schwartz and Associates)',
    },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`MLS ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** Pull one roster resource (incremental from the newest row we hold) into its table. */
async function refreshResource(kind, { pool, token, fetchImpl, base, feed }) {
  const r = RESOURCES[kind];
  const { rows: [{ since }] } = await pool.query(`SELECT MAX(modified_at) AS since FROM ${r.table} WHERE feed = $1`, [feed]);
  const url = new URL(`${base}/${r.path}`);
  url.searchParams.set('$top', String(PAGE));
  url.searchParams.set('$select', [r.idField, r.nameField, 'ModificationTimestamp', 'MlgCanView'].join(','));
  if (since) url.searchParams.set('$filter', `ModificationTimestamp gt ${new Date(since).toISOString()}`);

  let next = url.toString();
  let pages = 0;
  let saved = 0;
  while (next && pages < MAX_PAGES) {
    const data = await fetchJson(next, token, fetchImpl);
    pages += 1;
    for (const row of data.value || []) {
      const id = row[r.idField] ? String(row[r.idField]).slice(0, 40) : null;
      if (!id) continue;
      // MlgCanView false: the MLS withdrew the record from display.
      const name = row.MlgCanView === false || !row[r.nameField] ? null : String(row[r.nameField]).slice(0, 255);
      await pool.query(
        `INSERT INTO ${r.table} (feed, ${r.idCol}, ${r.nameCol}, modified_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (feed, ${r.idCol}) DO UPDATE
           SET ${r.nameCol} = EXCLUDED.${r.nameCol}, modified_at = EXCLUDED.modified_at, updated_at = NOW()`,
        [feed, id, name, row.ModificationTimestamp || null]
      );
      saved += 1;
    }
    next = data['@odata.nextLink'] || null;
    if (next) await sleep(PAUSE_MS);
  }
  return { pages, saved };
}

/** Copy roster names onto listings and sold listings that have the MLS id but no name. */
export async function applyRosterNames({ pool = getPool(), feed = 'ires' } = {}) {
  const out = {};
  for (const table of ['listings', 'sold_listings']) {
    const office = await pool.query(
      `UPDATE ${table} t SET list_office_name = o.name
       FROM mls_offices o
       WHERE t.feed = $1 AND o.feed = $1 AND t.list_office_mls_id = o.office_mls_id
         AND o.name IS NOT NULL AND t.list_office_name IS DISTINCT FROM o.name`,
      [feed]
    );
    const agent = await pool.query(
      `UPDATE ${table} t SET list_agent_name = m.full_name
       FROM mls_members m
       WHERE t.feed = $1 AND m.feed = $1 AND t.list_agent_mls_id = m.member_mls_id
         AND m.full_name IS NOT NULL AND t.list_agent_name IS DISTINCT FROM m.full_name`,
      [feed]
    );
    out[table] = { offices: office.rowCount, agents: agent.rowCount };
  }
  return out;
}

/**
 * Refresh the roster from the MLS and name every listing it can. Returns a
 * summary; never throws.
 */
export async function refreshMlsRoster({ pool = getPool(), fetchImpl = fetch, feed = 'ires' } = {}) {
  const base = process.env.IRES_API_URL;
  if (!base) return { skipped: 'not_configured' };
  const result = {};
  let token;
  try {
    token = await getToken();
  } catch (e) {
    return { error: `token: ${e.message}` };
  }
  for (const kind of Object.keys(RESOURCES)) {
    try {
      result[kind] = await refreshResource(kind, { pool, token, fetchImpl, base, feed });
    } catch (e) {
      result[kind] = { error: e.message };
      console.warn(`[mls-roster] ${kind} refresh failed: ${e.message}`);
    }
  }
  try {
    result.applied = await applyRosterNames({ pool, feed });
  } catch (e) {
    result.applied = { error: e.message };
  }
  return result;
}
