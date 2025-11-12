import pool from '../config/database.js';
import { sendMarketReportNotification } from '../services/emailService.js';
import { forwardMarketReportToFollowUpBoss } from '../services/followUpBossService.js';
import logger from '../utils/logger.js';

export const submitMarketReportForm = async (req, res) => {
  const { firstName, lastName, email, phone, area } = req.body;

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Insert into database
    const result = await client.query(
      `INSERT INTO market_report_submissions (first_name, last_name, email, phone, area)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [firstName, lastName, email, phone || null, area || null]
    );

    const submission = result.rows[0];

    await client.query('COMMIT');

    // Send email notification (don't await - fire and forget)
    sendMarketReportNotification(submission).catch(err => {
      logger.error('Email notification failed (non-blocking)', err);
    });

    // Forward to Follow Up Boss (don't await - fire and forget)
    forwardMarketReportToFollowUpBoss(submission).catch(err => {
      logger.error('Follow Up Boss forwarding failed (non-blocking)', err);
    });

    logger.info('Market report form submitted', { id: submission.id, email });

    res.status(201).json({
      success: true,
      message: 'Thank you! We will send you the market report shortly.',
      id: submission.id,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error submitting market report form', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit form. Please try again later.',
    });
  } finally {
    client.release();
  }
};

