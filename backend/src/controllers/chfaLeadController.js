import pool from '../config/database.js';
import { sendChfaLeadNotification } from '../services/emailService.js';
import { forwardChfaLeadToFollowUpBoss } from '../services/followUpBossService.js';
import logger from '../utils/logger.js';

export const submitChfaLeadForm = async (req, res) => {
  const { firstName, lastName, email, phone, schoolEmployer, buyingTimeline, message } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO chfa_lead_submissions
        (first_name, last_name, email, phone, school_employer, buying_timeline, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        firstName,
        lastName,
        email,
        phone || null,
        schoolEmployer || null,
        buyingTimeline || null,
        message || null,
      ]
    );

    const submission = result.rows[0];

    await client.query('COMMIT');

    sendChfaLeadNotification(submission).catch((err) => {
      logger.error('CHFA lead email notification failed (non-blocking)', err);
    });

    forwardChfaLeadToFollowUpBoss(submission).catch((err) => {
      logger.error('Follow Up Boss forwarding failed (non-blocking)', err);
    });

    logger.info('CHFA lead form submitted', { id: submission.id, email });

    res.status(201).json({
      success: true,
      message: "Thank you! We'll reach out shortly to help you explore CHFA Schools To Home.",
      id: submission.id,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error submitting CHFA lead form', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit form. Please try again later.',
    });
  } finally {
    client.release();
  }
};
