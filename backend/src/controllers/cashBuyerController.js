import getPool from '../config/database.js';
import { sendContactNotification } from '../services/emailService.js';
import { forwardContactToFollowUpBoss } from '../services/followUpBossService.js';
import { recordLeadConversion } from '../services/ga4MeasurementService.js';
import logger from '../utils/logger.js';

/**
 * POST /api/cash-buyer-lead — cash-home-buyers page lead capture.
 * Mirrors the contact flow so the lead lands in contact_submissions,
 * emails Adam, forwards to Follow Up Boss (source-tagged), and fires GA4.
 * Email + phone REQUIRED (CRO rule). Interest is prefixed "Cash offer:" so
 * it sorts cleanly in the CRM and the agent cockpit.
 */
export const submitCashBuyerLead = async (req, res) => {
  const { name, email, phone, interest, city, message } = req.body;

  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Name, email, and phone are required.' });
  }

  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO contact_submissions
        (name, email, phone, interest, message, area, source_page)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        name,
        email,
        phone,
        interest ? `Cash offer: ${interest}` : 'Cash offer',
        message || null,
        city || null,
        'cash-home-buyers',
      ]
    );

    const submission = { ...result.rows[0], ...req.body, sourcePage: 'cash-home-buyers' };

    await client.query('COMMIT');

    sendContactNotification(submission).catch((err) => {
      logger.error('Cash-buyer email notification failed (non-blocking)', err);
    });

    forwardContactToFollowUpBoss(submission).catch((err) => {
      logger.error('Cash-buyer Follow Up Boss forwarding failed (non-blocking)', err);
    });

    recordLeadConversion('cash-buyer-lead', req.body).catch((err) => {
      logger.warn('GA4 cash-buyer lead event failed (non-blocking)', { message: err.message });
    });

    logger.info('Cash-buyer lead submitted', { id: submission.id, email });

    res.status(201).json({
      success: true,
      message: 'Thank you for your submission. We will contact you soon!',
      id: submission.id,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error submitting cash-buyer lead', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit form. Please try again later.',
    });
  } finally {
    client.release();
  }
};
