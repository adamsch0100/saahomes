import getPool from '../config/database.js';
import { sendContactNotification } from '../services/emailService.js';
import { forwardContactToFollowUpBoss } from '../services/followUpBossService.js';
import { recordLeadConversion } from '../services/ga4MeasurementService.js';
import logger from '../utils/logger.js';

export const submitContactForm = async (req, res) => {
  const {
    name, email, phone, interest, message, area,
    sourcePage, utmSource, utmMedium, utmCampaign,
  } = req.body;

  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO contact_submissions
        (name, email, phone, interest, message, area, source_page, utm_source, utm_medium, utm_campaign)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        name, email, phone || null, interest || null, message || null, area || null,
        sourcePage || null, utmSource || null, utmMedium || null, utmCampaign || null,
      ]
    );

    const submission = { ...result.rows[0], ...req.body };

    await client.query('COMMIT');

    sendContactNotification(submission).catch((err) => {
      logger.error('Email notification failed (non-blocking)', err);
    });

    forwardContactToFollowUpBoss(submission).catch((err) => {
      logger.error('Follow Up Boss forwarding failed (non-blocking)', err);
    });

    recordLeadConversion('contact', req.body).catch((err) => {
      logger.warn('GA4 lead event failed (non-blocking)', { message: err.message });
    });

    logger.info('Contact form submitted', { id: submission.id, email, sourcePage });

    res.status(201).json({
      success: true,
      message: 'Thank you for your submission. We will contact you soon!',
      id: submission.id,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error submitting contact form', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit form. Please try again later.',
    });
  } finally {
    client.release();
  }
};
