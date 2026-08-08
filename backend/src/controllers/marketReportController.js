import crypto from 'crypto';
import getPool from '../config/database.js';
import { sendMarketReportNotification } from '../services/emailService.js';
import { forwardMarketReportToFollowUpBoss } from '../services/followUpBossService.js';
import { recordLeadConversion } from '../services/ga4MeasurementService.js';
import { upsertHomeProfile, computeOurEstimate } from '../services/sellerValueService.js';
import { setAuthCookie } from './alertController.js';
import logger from '../utils/logger.js';

function cleanPhone(v) {
  const digits = String(v || '').replace(/\D/g, '');
  if (digits.length >= 7 && digits.length <= 15) return digits;
  return null;
}

/**
 * Market report form → FUB + optional home profile for seller nurture track.
 * When address is provided, creates/attaches a home_profiles row and sets
 * the saa_user_token cookie so /my-home/ works immediately.
 */
export const submitMarketReportForm = async (req, res) => {
  const {
    firstName, lastName, email, phone, area,
    sourcePage, utmSource, utmMedium, utmCampaign,
    address_line, address, street, postal_code, zip, zipCode,
    living_area, sqft, city,
  } = req.body;

  const client = await getPool().connect();
  let homeProfileId = null;
  let manageToken = null;

  try {
    await client.query('BEGIN');

    const addr = String(address_line || address || street || '').trim().slice(0, 255) || null;
    const zipVal = String(postal_code || zip || zipCode || '').trim().slice(0, 16) || null;
    const living = living_area != null || sqft != null
      ? Number(living_area ?? sqft)
      : null;
    const cityVal = String(city || area || '').trim().slice(0, 100) || null;
    const phoneDigits = cleanPhone(phone);

    const result = await client.query(
      `INSERT INTO market_report_submissions
        (first_name, last_name, email, phone, area, source_page, utm_source, utm_medium, utm_campaign,
         address_line, postal_code, living_area)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        firstName, lastName, email, phone || null, area || null,
        sourcePage || null, utmSource || null, utmMedium || null, utmCampaign || null,
        addr, zipVal,
        living && Number.isFinite(living) ? living : null,
      ]
    );

    const submission = { ...result.rows[0], ...req.body };

    // Create/attach user + home profile for seller nurture when we have an address
    const emailStr = String(email || '').trim().toLowerCase();
    if (emailStr && addr) {
      try {
        let userRow;
        const existing = await client.query('SELECT * FROM users WHERE email = $1', [emailStr]);
        if (existing.rows[0]) {
          const updated = await client.query(
            `UPDATE users SET
               status = 'active',
               last_active_at = NOW(),
               name = COALESCE(NULLIF($1, ''), name),
               phone = COALESCE(NULLIF($2, ''), phone),
               intent = CASE
                 WHEN intent IS NULL THEN 'selling'
                 WHEN intent = 'buying' THEN 'both'
                 ELSE intent
               END,
               seller_heat = TRUE,
               seller_heat_at = COALESCE(seller_heat_at, NOW())
             WHERE id = $3 RETURNING *`,
            [
              `${firstName || ''} ${lastName || ''}`.trim(),
              phoneDigits || '',
              existing.rows[0].id,
            ]
          );
          userRow = updated.rows[0];
        } else {
          const token = crypto.randomBytes(24).toString('hex');
          const created = await client.query(
            `INSERT INTO users (email, name, manage_token, phone, intent, seller_heat, seller_heat_at)
             VALUES ($1, $2, $3, $4, 'selling', TRUE, NOW()) RETURNING *`,
            [
              emailStr,
              `${firstName || ''} ${lastName || ''}`.trim() || null,
              token,
              phoneDigits,
            ]
          );
          userRow = created.rows[0];
        }
        manageToken = userRow.manage_token;

        // upsertHomeProfile uses getPool() — commit first path: do after COMMIT
        submission._userId = userRow.id;
        submission._addr = addr;
        submission._zip = zipVal;
        submission._living = living && Number.isFinite(living) ? living : null;
        submission._city = cityVal;
      } catch (e) {
        logger.warn('market report user attach failed (non-blocking)', { message: e.message });
      }
    }

    await client.query('COMMIT');

    // Home profile after commit (uses own pool connections)
    if (submission._userId && submission._addr) {
      try {
        const profile = await upsertHomeProfile(submission._userId, {
          address_line: submission._addr,
          postal_code: submission._zip,
          city: submission._city,
          living_area: submission._living,
        });
        homeProfileId = profile.id;
        // Free our-comps estimate so dashboard has numbers immediately
        await computeOurEstimate(profile).then(async (our) => {
          if (our.mid == null) return;
          await getPool().query(
            `UPDATE home_profiles SET
               our_estimate_low = $1, our_estimate_mid = $2, our_estimate_high = $3,
               our_estimate_label = $4, our_estimate_at = NOW(), updated_at = NOW()
             WHERE id = $5`,
            [our.low, our.mid, our.high, our.label, profile.id]
          );
        }).catch(() => {});

        await getPool().query(
          `UPDATE market_report_submissions SET home_profile_id = $1 WHERE id = $2`,
          [homeProfileId, submission.id]
        );
      } catch (e) {
        logger.warn('market report home profile failed (non-blocking)', { message: e.message });
      }
    }

    if (manageToken) {
      setAuthCookie(res, manageToken);
    }

    sendMarketReportNotification(submission).catch((err) => {
      logger.error('Email notification failed (non-blocking)', err);
    });

    forwardMarketReportToFollowUpBoss(submission).catch((err) => {
      logger.error('Follow Up Boss forwarding failed (non-blocking)', err);
    });

    // Market analysis is a high-intent seller signal → cockpit + optional FUB already handled
    import('../services/agentCockpit.js')
      .then(({ refreshLeadLifecycleByEmail }) => refreshLeadLifecycleByEmail(email))
      .catch(() => {});

    recordLeadConversion('market_report', req.body).catch((err) => {
      logger.warn('GA4 lead event failed (non-blocking)', { message: err.message });
    });

    logger.info('Market report form submitted', {
      id: submission.id,
      email,
      area,
      home_profile_id: homeProfileId,
    });

    res.status(201).json({
      success: true,
      message: homeProfileId
        ? 'Thank you! We will send your market report shortly — and your home is saved on My Home.'
        : 'Thank you! We will send you the market report shortly.',
      id: submission.id,
      home_profile_id: homeProfileId,
      my_home_path: homeProfileId ? '/my-home/' : null,
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
