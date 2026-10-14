/**
 * Contacts in and out as CSV, so a brokerage is never locked in:
 *   - exportContactsCsv(): every contact with stage, source, tags, agent,
 *     notes, tasks and action plans (one row per contact).
 *   - importContactsCsv(): contacts from a Follow Up Boss people export (or
 *     any spreadsheet), with the owner's column mapping. Matches existing
 *     contacts by email, then phone, and fills in what's missing; never
 *     sends anything.
 */
import crypto from 'node:crypto';
import getPool from '../config/database.js';
import { normalizePhone } from './smsService.js';
import { normalizeTag } from './actionPlans.js';
import { placeholderEmail } from './leadIntake.js';
import { LIFECYCLE_STAGES } from './agentCockpit.js';

export const MAX_IMPORT_ROWS = 20000;
const NOTE_SEP = '\n---\n';

/** RFC 4180 CSV → rows of strings (quoted fields, doubled quotes, newlines in quotes). Pure. */
export function parseCsv(text) {
  const s = String(text || '').replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  return rows;
}

const cell = (v) => {
  const s = v == null ? '' : String(v);
  // Spreadsheet apps run cells that start with = + - @ as formulas (a phone number like +19705551111 is left alone).
  const safe = /^[=+\-@\t\r]/.test(s) && !/^\+?[\d\s().-]+$/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
export const toCsv = (rows) => rows.map((r) => r.map(cell).join(',')).join('\r\n');

/** Columns we can fill, with the header names we recognize for each. */
export const IMPORT_FIELDS = {
  name: { label: 'Full name', match: /^(name|full name|contact name|person|client name)$/i },
  first_name: { label: 'First name', match: /^(first name|first|given name)$/i },
  last_name: { label: 'Last name', match: /^(last name|last|surname|family name)$/i },
  email: { label: 'Email', match: /^(e-?mail( ?1| address| address 1)?|primary email|email 1)$/i },
  phone: { label: 'Phone', match: /^(phone( ?1| number)?|mobile( phone)?|cell( phone)?|primary phone|phone 1)$/i },
  stage: { label: 'Stage', match: /^(stage|status|lifecycle( stage)?)$/i },
  source: { label: 'Source', match: /^(source|lead source)$/i },
  tags: { label: 'Tags', match: /^tags?$/i },
  assigned: { label: 'Assigned agent', match: /^(assigned( to| agent)?|agent|owner|assigned email)$/i },
  notes: { label: 'Notes', match: /^(notes?|background|comments?)$/i },
  open_tasks: { label: 'Open tasks', match: /^(open tasks|tasks)$/i },
  created: { label: 'Created', match: /^(created( date| at)?|date added|added)$/i },
};

/** Our best guess at the mapping: { field: column index }. Pure. */
export function guessMapping(headers = []) {
  const map = {};
  headers.forEach((h, i) => {
    const name = String(h || '').trim();
    for (const [field, def] of Object.entries(IMPORT_FIELDS)) {
      if (map[field] === undefined && def.match.test(name)) { map[field] = i; break; }
    }
  });
  return map;
}

/** Follow Up Boss stage names (and ours) → our stages. Pure. */
export function mapStage(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  if (LIFECYCLE_STAGES.includes(s)) return s;
  if (/trash|lost|dead|unqualified|not interested|archived/.test(s)) return 'lost';
  if (/closed|past client|sold/.test(s)) return 'closed';
  if (/pending|under contract|active client|hot/.test(s)) return 'active';
  if (/showing|touring/.test(s)) return 'showing';
  if (/nurture|sphere|warm|cold|watch/.test(s)) return 'nurturing';
  if (/lead|new|prospect|attempted|contacted/.test(s)) return 'new';
  return null;
}

const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const firstLast = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return [parts[0] || '', parts.slice(1).join(' ')];
};

export const EXPORT_HEADERS = [
  'Name', 'First Name', 'Last Name', 'Email', 'Phone', 'Stage', 'Source', 'Tags', 'Assigned To', 'Assigned Email',
  'Created', 'Last Active', 'Notes', 'Open Tasks', 'Done Tasks', 'Action Plans',
];

/** Every contact of a brokerage as CSV text. */
export async function exportContactsCsv(tenantId, pool = getPool()) {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.phone, u.lifecycle_stage, u.source, u.tags, u.created_at, u.last_active_at,
            a.name AS agent_name, a.email AS agent_email,
            (SELECT string_agg('[' || to_char(n.created_at, 'YYYY-MM-DD') || '] ' || COALESCE(n.author_name, 'Note') || ': ' || n.body, E'${NOTE_SEP.replace(/\n/g, '\\n')}' ORDER BY n.created_at)
               FROM lead_notes n WHERE n.lead_id = u.id AND n.tenant_id = u.tenant_id AND n.deleted_at IS NULL) AS notes,
            (SELECT string_agg(t.title || COALESCE(' (due ' || to_char(t.due_at, 'YYYY-MM-DD') || ')', ''), '; ' ORDER BY t.due_at NULLS LAST)
               FROM lead_tasks t WHERE t.lead_id = u.id AND t.tenant_id = u.tenant_id AND t.done_at IS NULL) AS open_tasks,
            (SELECT string_agg(t.title, '; ' ORDER BY t.done_at)
               FROM lead_tasks t WHERE t.lead_id = u.id AND t.tenant_id = u.tenant_id AND t.done_at IS NOT NULL) AS done_tasks,
            (SELECT string_agg(p.name || ' (' || r.status || ')', '; ' ORDER BY r.started_at)
               FROM action_plan_runs r JOIN action_plans p ON p.id = r.plan_id WHERE r.lead_id = u.id AND r.tenant_id = u.tenant_id) AS plans
     FROM users u LEFT JOIN users a ON a.id = u.assigned_agent_id
     WHERE u.tenant_id = $1 AND COALESCE(u.role, 'client') = 'client'
     ORDER BY u.created_at, u.id`,
    [tenantId]
  );
  const out = [EXPORT_HEADERS];
  for (const r of rows) {
    const [first, last] = firstLast(r.name);
    out.push([
      r.name || '', first, last, /\.invalid$/i.test(r.email || '') ? '' : r.email, r.phone || '', r.lifecycle_stage || '', r.source || '',
      (r.tags || []).join(', '), r.agent_name || '', r.agent_email || '', fmtDate(r.created_at), fmtDate(r.last_active_at),
      r.notes || '', r.open_tasks || '', r.done_tasks || '', r.plans || '',
    ]);
  }
  return { csv: toCsv(out), count: rows.length };
}

/** A sample of what an import would do: headers, our guess, first rows. */
export function previewImport(text) {
  const rows = parseCsv(text);
  if (!rows.length) return { error: 'That file looks empty.' };
  const [headers, ...data] = rows;
  return {
    headers,
    mapping: guessMapping(headers),
    fields: Object.fromEntries(Object.entries(IMPORT_FIELDS).map(([k, v]) => [k, v.label])),
    sample: data.slice(0, 5),
    rows: data.length,
    too_many: data.length > MAX_IMPORT_ROWS,
  };
}

/** Notes from one cell: our own export's separate notes, or one note. Pure. */
export function splitNotes(raw) {
  const s = String(raw || '').trim();
  if (!s) return [];
  return s.split(NOTE_SEP).map((n) => {
    const m = /^\[(\d{4}-\d{2}-\d{2})\]\s+([^:\n]{1,80}):\s([\s\S]*)$/.exec(n.trim());
    return m ? { at: m[1], author: m[2], body: m[3].trim() } : { at: null, author: null, body: n.trim() };
  }).filter((n) => n.body);
}

/**
 * Import contacts. mapping: { field: column index }. Returns
 * { created, updated, skipped, notes, errors: [{ row, reason }] }.
 */
export async function importContactsCsv(tenantId, text, mapping, { importedBy = null } = {}, pool = getPool()) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { error: 'That file has no contacts in it.' };
  const data = rows.slice(1, MAX_IMPORT_ROWS + 1);
  const col = (row, field) => {
    const i = mapping?.[field];
    const v = Number.isInteger(Number(i)) && i !== null && i !== '' && Number(i) >= 0 ? String(row[Number(i)] ?? '').trim() : '';
    return /^'[=+\-@]/.test(v) ? v.slice(1) : v;
  };
  if (mapping?.email === undefined && mapping?.phone === undefined) return { error: 'Pick the column with each contact’s email or phone.' };

  const { rows: staff } = await pool.query(
    "SELECT id, name, email FROM users WHERE tenant_id = $1 AND role IN ('agent', 'admin')", [tenantId]
  );
  const staffEmails = new Set(staff.map((s) => String(s.email).toLowerCase()));
  const findAgent = (v) => {
    const s = String(v || '').trim().toLowerCase();
    if (!s) return null;
    return staff.find((a) => String(a.email).toLowerCase() === s || String(a.name || '').trim().toLowerCase() === s)?.id || null;
  };

  const result = { created: 0, updated: 0, skipped: 0, notes: 0, errors: [] };
  for (const [i, row] of data.entries()) {
    const line = i + 2;
    const rawEmail = col(row, 'email').toLowerCase();
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) && !/\.invalid$/.test(rawEmail) ? rawEmail : null;
    const phone = normalizePhone(col(row, 'phone'));
    if (!email && !phone) {
      result.skipped += 1;
      if (result.errors.length < 50) result.errors.push({ row: line, reason: 'No email or phone' });
      continue;
    }
    if (email && staffEmails.has(email)) {
      result.skipped += 1;
      if (result.errors.length < 50) result.errors.push({ row: line, reason: 'That email belongs to someone on your team' });
      continue;
    }
    const name = col(row, 'name') || [col(row, 'first_name'), col(row, 'last_name')].filter(Boolean).join(' ') || null;
    const stage = mapStage(col(row, 'stage'));
    const source = col(row, 'source').slice(0, 64) || null;
    const tags = [...new Set(col(row, 'tags').split(/[,;|]/).map(normalizeTag).filter(Boolean))].slice(0, 30);
    const agentId = findAgent(col(row, 'assigned'));
    const createdRaw = col(row, 'created');
    const createdAt = createdRaw && !Number.isNaN(new Date(createdRaw).getTime()) ? new Date(createdRaw) : null;

    let existing = null;
    if (email) {
      ({ rows: [existing] } = await pool.query(
        "SELECT id, tags, email FROM users WHERE tenant_id = $1 AND LOWER(email) = $2 AND COALESCE(role, 'client') = 'client' LIMIT 1", [tenantId, email]
      ));
    }
    if (!existing && phone) {
      ({ rows: [existing] } = await pool.query(
        `SELECT id, tags, email FROM users WHERE tenant_id = $1 AND COALESCE(role, 'client') = 'client'
           AND RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g'), 10) = RIGHT($2, 10) LIMIT 1`,
        [tenantId, phone.replace(/\D/g, '')]
      ));
    }
    let leadId;
    try {
      if (existing) {
        leadId = existing.id;
        await pool.query(
          `UPDATE users SET name = COALESCE(name, $2), phone = COALESCE(NULLIF(phone, ''), $3),
                  email = CASE WHEN $4::text IS NOT NULL AND email LIKE '%.invalid' THEN $4 ELSE email END,
                  tags = (SELECT ARRAY(SELECT DISTINCT unnest(tags || $5::text[]))),
                  source = COALESCE(source, $6), assigned_agent_id = COALESCE(assigned_agent_id, $7),
                  lifecycle_stage = CASE WHEN $8::text IS NOT NULL AND COALESCE(lifecycle_stage, 'new') = 'new' THEN $8 ELSE lifecycle_stage END
           WHERE id = $1`,
          [leadId, name, phone, email, tags, source, agentId, stage]
        );
        result.updated += 1;
      } else {
        const { rows: [u] } = await pool.query(
          `INSERT INTO users (email, name, phone, manage_token, role, status, source, assigned_agent_id, lifecycle_stage,
                              lifecycle_stage_manual, tags, tenant_id, created_at)
           VALUES ($1, $2, $3, $4, 'client', 'active', $5, $6, $7, $8, $9, $10, COALESCE($11, NOW())) RETURNING id`,
          [email || placeholderEmail(phone), name, phone, crypto.randomBytes(24).toString('hex'), source || 'import', agentId,
            stage || 'new', !!stage, tags, tenantId, createdAt]
        );
        leadId = u.id;
        result.created += 1;
      }
    } catch (e) {
      result.skipped += 1;
      if (result.errors.length < 50) result.errors.push({ row: line, reason: 'Could not save this row' });
      continue;
    }
    for (const note of splitNotes(col(row, 'notes'))) {
      const { rowCount } = await pool.query(
        `INSERT INTO lead_notes (tenant_id, lead_id, author_id, author_name, kind, body, created_at)
         SELECT $1, $2, $3, $4, 'note', $5, COALESCE($6::date::timestamptz, NOW())
         WHERE NOT EXISTS (SELECT 1 FROM lead_notes WHERE lead_id = $2 AND body = $5 AND deleted_at IS NULL)`,
        [tenantId, leadId, importedBy, note.author || 'Imported', note.body.slice(0, 5000), note.at]
      );
      result.notes += rowCount;
    }
    for (const item of col(row, 'open_tasks').split(/;\s*/).map((t) => t.trim()).filter(Boolean).slice(0, 20)) {
      const m = /^(.*?)(?:\s*\(due (\d{4}-\d{2}-\d{2})\))?$/.exec(item);
      await pool.query(
        `INSERT INTO lead_tasks (tenant_id, lead_id, assignee_id, created_by, title, kind, due_at)
         SELECT $1, $2, $3, $4, $5::text, 'follow_up', $6::date::timestamptz
         WHERE NOT EXISTS (SELECT 1 FROM lead_tasks WHERE lead_id = $2 AND title = $5::text AND done_at IS NULL)`,
        [tenantId, leadId, agentId, importedBy, m[1].slice(0, 255), m[2] || null]
      );
    }
  }
  if (rows.length - 1 > MAX_IMPORT_ROWS) result.truncated = true;
  return result;
}
