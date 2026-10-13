import { recordEvent as recordStreamEvent, VISITOR_COOKIE, sessionUserId } from '../services/events.js';
import getPool from '../config/database.js';
import { sendContactNotification } from '../services/emailService.js';
import { forwardContactToFollowUpBoss } from '../services/followUpBossService.js';
import { recordLeadConversion } from '../services/ga4MeasurementService.js';
import {
  createLeadSubmitLog,
  recordGa4Leg,
  recordFubLeg,
  recordNotifyLeg,
} from '../services/leadSubmitLog.js';
import logger from '../utils/logger.js';
import { reportLeadToBoard } from '../services/boardLeadCount.js';

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

    recordStreamEvent({
      type: 'form_submit',
      visitorId: req.cookies?.[VISITOR_COOKIE],
      userId: await sessionUserId(req),
      meta: { form: 'contact', submission_id: submission.id, source_page: sourcePage || null },
    });

    // One log row per submit: did each delivery leg actually fire?
    const logId = await createLeadSubmitLog({
      leadType: 'contact',
      submissionId: submission.id,
      email,
      sourcePage: sourcePage || null,
    });

    sendContactNotification(submission)
      .then((info) => recordNotifyLeg(logId, { success: true, messageId: info?.messageId }))
      .catch((err) => {
        recordNotifyLeg(logId, { success: false, error: err.message });
        logger.error('Email notification failed (non-blocking)', err);
      });

    reportLeadToBoard('contact');
    forwardContactToFollowUpBoss(submission)
      .then((result) => recordFubLeg(logId, {
        success: !!result?.success,
        personId: result?.fubPersonId,
        error: result?.success ? null : (result?.reason || result?.error || null),
      }))
      .catch((err) => {
        recordFubLeg(logId, { success: false, error: err.message });
        logger.error('Follow Up Boss forwarding failed (non-blocking)', err);
      });

    // Server-side GA4 Measurement Protocol leg — generate_lead + saa_lead_submit.
    recordLeadConversion('contact', req.body)
      .then((result) => recordGa4Leg(logId, {
        fired: !!result?.fired,
        status: result?.status,
        error: result?.error || result?.reason || null,
      }))
      .catch((err) => {
        recordGa4Leg(logId, { fired: false, error: err.message });
        logger.warn('GA4 lead event failed (non-blocking)', { message: err.message });
      });

    // Cockpit lifecycle refresh when contact email maps to a users row
    import('../services/agentCockpit.js')
      .then(({ refreshLeadLifecycleByEmail }) => refreshLeadLifecycleByEmail(email))
      .catch(() => {});

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
