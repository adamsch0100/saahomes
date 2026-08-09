/**
 * Client account auth — regular username/password on top of the cookie session:
 *   POST /api/auth/register  {email, name, phone, password}  → sets cookie
 *   POST /api/auth/login     {email, password}               → sets cookie
 *   POST /api/auth/password  {password}  (signed in)         → set/change password
 * The existing magic-link flow stays as the no-password fallback.
 */
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import getPool from '../config/database.js';
import { setAuthCookie } from './alertController.js';
import { rejectIfDisposableEmail } from '../utils/emailQuality.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cleanPhone = (v) => {
  const digits = String(v || '').replace(/\D/g, '');
  if (digits.length >= 7 && digits.length <= 15) return digits;
  return null;
};

export const register = async (req, res) => {
  try {
    const { email, name, phone, password } = req.body || {};
    const emailStr = String(email || '').trim().toLowerCase();
    const passStr = String(password || '');
    if (!EMAIL_RE.test(emailStr)) return res.status(400).json({ success: false, error: 'Please enter a valid email.' });
    if (rejectIfDisposableEmail(emailStr, res, 'signup')) return;
    if (passStr.length < 8) return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });

    const pool = getPool();
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [emailStr]);
    if (existing.rows.length && existing.rows[0].password_hash) {
      return res.status(409).json({ success: false, error: 'An account with that email already exists. Log in instead.' });
    }

    const hash = await bcrypt.hash(passStr, 10);
    const phoneDigits = cleanPhone(phone);
    const nameStr = String(name || '').trim().slice(0, 255) || null;

    let userRow;
    if (existing.rows.length) {
      const updated = await pool.query(
        `UPDATE users SET password_hash = $1, name = COALESCE(NULLIF($2, ''), name),
           phone = COALESCE(NULLIF($3, ''), phone), status = 'active', role = 'client'
         WHERE id = $4 RETURNING *`,
        [hash, nameStr, phoneDigits || '', existing.rows[0].id]
      );
      userRow = updated.rows[0];
    } else {
      const token = crypto.randomBytes(24).toString('hex');
      const created = await pool.query(
        `INSERT INTO users (email, name, phone, manage_token, password_hash, role)
         VALUES ($1, $2, $3, $4, $5, 'client') RETURNING *`,
        [emailStr, nameStr, phoneDigits, token, hash]
      );
      userRow = created.rows[0];
    }

    setAuthCookie(res, userRow.manage_token);
    return res.status(201).json({
      success: true,
      data: { email: userRow.email, name: userRow.name, phone: userRow.phone },
    });
  } catch (error) {
    console.error('register error:', error);
    return res.status(500).json({ success: false, error: 'Could not create your account. Please try again.' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const emailStr = String(email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(emailStr) || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }
    const pool = getPool();
    const user = await pool.query(
      "SELECT * FROM users WHERE email = $1 AND status = 'active'",
      [emailStr]
    );
    if (!user.rows.length || !user.rows[0].password_hash) {
      return res.status(401).json({ success: false, error: 'Incorrect email or password.' });
    }
    const ok = await bcrypt.compare(String(password), user.rows[0].password_hash);
    if (!ok) return res.status(401).json({ success: false, error: 'Incorrect email or password.' });

    await pool.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [user.rows[0].id]);
    setAuthCookie(res, user.rows[0].manage_token);
    return res.json({
      success: true,
      data: { email: user.rows[0].email, name: user.rows[0].name, phone: user.rows[0].phone },
    });
  } catch (error) {
    console.error('login error:', error);
    return res.status(500).json({ success: false, error: 'Could not log in. Please try again.' });
  }
};

export const setPassword = async (req, res) => {
  try {
    const token = req.cookies?.saa_user_token;
    if (!token) return res.status(401).json({ success: false, error: 'Not signed in.' });
    const passStr = String(req.body?.password || '');
    if (passStr.length < 8) return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });

    const pool = getPool();
    const user = await pool.query('SELECT * FROM users WHERE manage_token = $1 AND status = \'active\'', [token]);
    if (!user.rows.length) return res.status(401).json({ success: false, error: 'Session expired.' });

    const hash = await bcrypt.hash(passStr, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user.rows[0].id]);
    return res.json({ success: true });
  } catch (error) {
    console.error('setPassword error:', error);
    return res.status(500).json({ success: false, error: 'Could not set your password.' });
  }
};

/**
 * POST /api/auth/session — email + phone (required) → upsert user + set cookie.
 * Used by "Sign in to save homes" modal (no password required — magic-link users pattern).
 * Optional password: if provided (≥8 chars), set/update password_hash.
 */
export const ensureSession = async (req, res) => {
  try {
    const { email, name, phone, password } = req.body || {};
    const emailStr = String(email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(emailStr)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email.' });
    }
    if (rejectIfDisposableEmail(emailStr, res, 'signup')) return;
    const phoneDigits = cleanPhone(phone);
    if (!phoneDigits) {
      return res.status(400).json({
        success: false,
        error: 'Please add your phone number so we can reach you about saved homes.',
      });
    }

    const pool = getPool();
    let user = await pool.query('SELECT * FROM users WHERE email = $1', [emailStr]);
    const nameStr = String(name || '').trim().slice(0, 255) || null;
    const passStr = String(password || '');
    let hash = null;
    if (passStr.length >= 8) hash = await bcrypt.hash(passStr, 10);

    if (!user.rows.length) {
      const token = crypto.randomBytes(24).toString('hex');
      const created = await pool.query(
        `INSERT INTO users (email, name, phone, manage_token, password_hash, role, status, last_active_at)
         VALUES ($1, $2, $3, $4, $5, 'client', 'active', NOW()) RETURNING *`,
        [emailStr, nameStr, phoneDigits, token, hash]
      );
      user = created;
    } else {
      const updates = [
        `status = 'active'`,
        `last_active_at = NOW()`,
        `phone = COALESCE(NULLIF($1, ''), phone)`,
        `name = COALESCE(NULLIF($2, ''), name)`,
      ];
      const params = [phoneDigits, nameStr || ''];
      let i = 3;
      if (hash) {
        updates.push(`password_hash = $${i++}`);
        params.push(hash);
      }
      params.push(user.rows[0].id);
      const updated = await pool.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
        params
      );
      user = updated;
    }

    setAuthCookie(res, user.rows[0].manage_token);
    return res.json({
      success: true,
      data: {
        email: user.rows[0].email,
        name: user.rows[0].name,
        phone: user.rows[0].phone,
      },
    });
  } catch (error) {
    console.error('ensureSession error:', error);
    return res.status(500).json({ success: false, error: 'Could not sign you in. Please try again.' });
  }
};
