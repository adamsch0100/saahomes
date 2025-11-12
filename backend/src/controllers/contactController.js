import pool from '../config/database.js';
import { sendContactNotification } from '../services/emailService.js';
import { forwardContactToFollowUpBoss } from '../services/followUpBossService.js';
import logger from '../utils/logger.js';

export const submitContactForm = async (req, res) => {
  const { name, email, phone, interest, message, area } = req.body;

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Insert into database
    const result = await client.query(
      `INSERT INTO contact_submissions (name, email, phone, interest, message, area)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, email, phone || null, interest || null, message || null, area || null]
    );

    const submission = result.rows[0];

    await client.query('COMMIT');

    // Send email notification (don't await - fire and forget)
    sendContactNotification(submission).catch(err => {
      logger.error('Email notification failed (non-blocking)', err);
    });

    // Forward to Follow Up Boss (don't await - fire and forget)
    forwardContactToFollowUpBoss(submission).catch(err => {
      logger.error('Follow Up Boss forwarding failed (non-blocking)', err);
    });

    logger.info('Contact form submitted', { id: submission.id, email });

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

