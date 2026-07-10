import getPool from '../config/database.js';
import { sendContactNotification } from '../services/emailService.js';
import { forwardContactToFollowUpBoss } from '../services/followUpBossService.js';
import { recordLeadConversion } from '../services/ga4MeasurementService.js';
import logger from '../utils/logger.js';

export const submitCashBuyerLeadForm = async (req, res) => {
  const {
    name, email, phone, interest, city, message, source,
  } = req.body;

  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO contact_submissions
        (name, email, phone, interest, area, message, source_page)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        name, email, phone || null, interest || 'cash-buyer-inquiry',
        city || null, message || null, source || 'cash-home-buyers-page',
      ]
    );

    const submission = { ...result.rows[0], ...req.body };

    await client.query('COMMIT');

    sendContactNotification({ ...submission, interest: `Cash Buyer: ${interest || 'inquiry'}` }).catch((err) => {
      logger.error('Cash buyer lead email notification failed (non-blocking)', err);
    });

    forwardContactToFollowUpBoss({ ...submission, source: 'cash-buyer-page' }).catch((err) => {
      logger.error('Follow Up Boss forwarding failed (non-blocking)', err);
    });

    recordLeadConversion('cash_buyer', req.body).catch((err) => {
      logger.warn('GA4 lead event failed (non-blocking)', { message: err.message });
    });

    logger.info('Cash buyer lead form submitted', { id: submission.id, email, interest });

    res.status(201).json({
      success: true,
      message: "Thank you! We'll reach out within 24 hours to discuss your options.",
      id: submission.id,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error submitting cash buyer lead form', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit form. Please try again later.',
    });
  } finally {
    client.release();
  }
};
