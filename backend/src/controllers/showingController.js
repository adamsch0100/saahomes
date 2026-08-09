/**
 * Showing request API — POST /api/showing
 * Captures name/email/phone + requested date/time for a listing, saves it,
 * and forwards the lead to Follow Up Boss (source: Showing Request).
 */
import getPool from '../config/database.js';
import { forwardShowingRequestToFollowUpBoss } from '../services/followUpBossService.js';
import { rejectIfDisposableEmail } from '../utils/emailQuality.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const submitShowingRequest = async (req, res) => {
  try {
    const { name, email, phone, date, time, message, listing_slug, listing_address, source_page } = req.body || {};

    const nameStr = String(name || '').trim();
    const emailStr = String(email || '').trim().toLowerCase();
    const phoneDigits = String(phone || '').replace(/\D/g, '');
    if (!nameStr) return res.status(400).json({ success: false, error: 'Please enter your name.' });
    if (!EMAIL_RE.test(emailStr)) return res.status(400).json({ success: false, error: 'Please enter a valid email.' });
    if (rejectIfDisposableEmail(emailStr, res, 'showing')) return;
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      return res.status(400).json({ success: false, error: 'Please add your phone number so we can confirm your showing.' });
    }
    if (!date) return res.status(400).json({ success: false, error: 'Please pick a date for your showing.' });
    if (!time) return res.status(400).json({ success: false, error: 'Please pick a time for your showing.' });

    // Date must be today or later
    const d = new Date(`${date}T12:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Number.isNaN(d.getTime()) || d < today) {
      return res.status(400).json({ success: false, error: 'Please pick a date in the future.' });
    }

    const pool = getPool();
    const inserted = await pool.query(
      `INSERT INTO showing_requests (name, email, phone, showing_date, showing_time, message, listing_slug, listing_address, source_page)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [nameStr, emailStr, String(phone || '').trim() || null, date, String(time).slice(0, 20),
       String(message || '').trim().slice(0, 2000) || null,
       String(listing_slug || '').trim() || null, String(listing_address || '').trim() || null,
       String(source_page || '').trim().slice(0, 255) || null]
    );

    // FUB lead + person-id capture (fire-and-forget)
    forwardShowingRequestToFollowUpBoss({
      name: nameStr, email: emailStr, phone: phoneDigits,
      showing_date: date, showing_time: time, message: String(message || '').trim(),
      listing_slug: String(listing_slug || '').trim(), listing_address: String(listing_address || '').trim(),
    }).catch(() => {});

    // Cockpit lifecycle: showing stage + next-touch (by email → users row if exists)
    try {
      const { refreshLeadLifecycleByEmail } = await import('../services/agentCockpit.js');
      refreshLeadLifecycleByEmail(emailStr, pool).catch(() => {});
    } catch { /* noop */ }

    return res.status(201).json({
      success: true,
      data: { id: inserted.rows[0].id, date, time, listing_address },
    });
  } catch (error) {
    console.error('submitShowingRequest error:', error);
    return res.status(500).json({ success: false, error: 'Could not submit your showing request. Please try again or call (970) 999-1407.' });
  }
};
