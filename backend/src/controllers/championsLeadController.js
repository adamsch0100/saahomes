import getPool from '../config/database.js';
import { sendChampionsLeadNotification } from '../services/emailService.js';
import { forwardChampionsLeadToFollowUpBoss } from '../services/followUpBossService.js';
import logger from '../utils/logger.js';

export const submitChampionsLeadForm = async (req, res) => {
  const {
    firstName, lastName, email, phone, responderType, employerAgency, buyingTimeline, message,
    sourcePage, utmSource, utmMedium, utmCampaign,
  } = req.body;

  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO champions_lead_submissions
        (first_name, last_name, email, phone, responder_type, employer_agency, buying_timeline, message, source_page, utm_source, utm_medium, utm_campaign)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        firstName, lastName, email, phone || null, responderType || null, employerAgency || null,
        buyingTimeline || null, message || null,
        sourcePage || null, utmSource || null, utmMedium || null, utmCampaign || null,
      ]
    );

    const submission = { ...result.rows[0], ...req.body };

    await client.query('COMMIT');

    sendChampionsLeadNotification(submission).catch((err) => {
      logger.error('Champions lead email notification failed (non-blocking)', err);
    });

    forwardChampionsLeadToFollowUpBoss(submission).catch((err) => {
      logger.error('Follow Up Boss forwarding failed (non-blocking)', err);
    });

    logger.info('Champions lead form submitted', { id: submission.id, email, sourcePage });

    res.status(201).json({
      success: true,
      message: "Thank you! We'll reach out with program updates and local home buying guidance.",
      id: submission.id,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error submitting Champions lead form', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit form. Please try again later.',
    });
  } finally {
    client.release();
  }
};
