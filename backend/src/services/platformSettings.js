/**
 * Platform-wide settings: one JSONB value per key in platform_settings
 * (migrate.js). For things that belong to the platform rather than to one
 * brokerage: the plan prices the owner set, and what the app set up in
 * Stripe for itself.
 */
import getPool from '../config/database.js';

export async function getSetting(key, { pool = getPool() } = {}) {
  const r = await pool.query('SELECT value FROM platform_settings WHERE key = $1', [key]);
  return r.rows[0]?.value ?? null;
}

/** Replace a key's value. */
export async function putSetting(key, value, { pool = getPool() } = {}) {
  await pool.query(
    `INSERT INTO platform_settings (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, JSON.stringify(value ?? {})]
  );
}

/** Merge a patch into a key's object value (top level). */
export async function mergeSetting(key, patch, { pool = getPool() } = {}) {
  await pool.query(
    `INSERT INTO platform_settings (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = platform_settings.value || EXCLUDED.value, updated_at = NOW()`,
    [key, JSON.stringify(patch ?? {})]
  );
}
