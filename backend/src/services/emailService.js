import transporter from '../config/email.js';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';
import getPool from '../config/database.js';
import { currentTenant, currentTenantId, tenantById } from './tenantContext.js';
import { brandFor, isHomeTenant } from './brand.js';
import { sendEmail, smtpConfigured } from './emailer.js';

dotenv.config();

const ADMIN_EMAIL = process.env.GMAIL_USER || 'adam@saahomes.com';

/**
 * Who hears about a lead at another brokerage: the lead's assigned agent
 * when it has one, otherwise the brokerage's active admins. Never SAA's inbox.
 */
async function brokerageRecipients(pool, tenantId, submission) {
  const staff = async (id) => (id ? (await pool.query(
    `SELECT email FROM users WHERE id = $1 AND tenant_id = $2 AND role IN ('agent', 'admin')
       AND status = 'active' AND email IS NOT NULL`,
    [id, tenantId]
  )).rows.map((r) => r.email) : []);

  let agentId = Number(submission?.assigned_agent_id) || null;
  if (!agentId && submission?.email) {
    const lead = await pool.query(
      'SELECT assigned_agent_id FROM users WHERE lower(email) = lower($1) AND tenant_id = $2 LIMIT 1',
      [String(submission.email), tenantId]
    );
    agentId = lead.rows[0]?.assigned_agent_id || null;
  }
  const cur = currentTenant();
  if (!agentId && cur?.id === tenantId && cur.agent?.id) agentId = cur.agent.id;
  const agent = await staff(agentId);
  if (agent.length) return agent;

  const admins = await pool.query(
    `SELECT email FROM users WHERE tenant_id = $1 AND role = 'admin' AND status = 'active' AND email IS NOT NULL
     ORDER BY id`,
    [tenantId]
  );
  return admins.rows.map((r) => r.email);
}

/**
 * Deliver a staff lead notification. SAA's go to SAA's inbox exactly as
 * before; another brokerage's go to its own people, under its own name, and
 * queue in email_outbox when this runtime can't send.
 */
async function deliverLeadNotification(submission, mailOptions, sentLabel, failLabel) {
  const tenantId = Number(submission?.tenant_id) || currentTenantId();
  if (isHomeTenant({ id: tenantId })) {
    // The already-configured OUTREACH_SMTP_* transport first, Gmail second.
    // Gmail's app password has been dead (mail-test 503 code 535) since
    // inc-ed1cf484 while OUTREACH_SMTP_* still sends, so a lead notice must
    // not depend on the Gmail credential to reach a human.
    let outreachError = null;
    if (smtpConfigured()) {
      try {
        await sendEmail(
          ADMIN_EMAIL,
          mailOptions.subject,
          mailOptions.html,
          'SAA Homes Website',
          { tenantId, replyTo: submission?.email || null }
        );
        logger.info(`${sentLabel} notification email sent`, { via: 'outreach_smtp' });
        return { success: true, messageId: null, via: 'outreach_smtp' };
      } catch (error) {
        outreachError = error;
        logger.warn(`OUTREACH_SMTP_* ${failLabel} notification failed, trying Gmail`, { message: error.message });
      }
    }
    try {
      const info = await transporter.sendMail(mailOptions);
      logger.info(`${sentLabel} notification email sent`, { via: 'gmail', messageId: info.messageId });
      return { success: true, messageId: info.messageId, via: 'gmail' };
    } catch (error) {
      logger.error(`Failed to send ${failLabel} notification email`, error);
      if (outreachError) {
        const combined = new Error(`OUTREACH_SMTP_* failed (${outreachError.message}); Gmail failed (${error.message})`);
        combined.outreachError = outreachError.message;
        combined.gmailError = error.message;
        throw combined;
      }
      throw error;
    }
  }

  const pool = getPool();
  const brand = brandFor(await tenantById(tenantId, { pool }));
  const to = await brokerageRecipients(pool, tenantId, submission);
  if (!to.length) {
    const error = new Error(`No active admin to notify for tenant ${tenantId}`);
    logger.error(`Failed to send ${failLabel} notification email`, error);
    throw error;
  }
  const fromName = `${brand.name} Website`;
  let queued = 0;
  for (const addr of to) {
    try {
      await sendEmail(addr, mailOptions.subject, mailOptions.html, fromName, { tenantId, replyTo: submission?.email || null });
    } catch {
      await pool.query(
        'INSERT INTO email_outbox (to_email, subject, html, tenant_id) VALUES ($1, $2, $3, $4)',
        [addr, mailOptions.subject, mailOptions.html, tenantId]
      );
      queued += 1;
    }
  }
  logger.info(`${sentLabel} notification email sent`, { tenantId, recipients: to.length, queued });
  return { success: true, messageId: null, queued };
}

export const sendContactNotification = async (submission) => {
  const { name, email, phone, interest, message, area } = submission;

  const mailOptions = {
    from: `"SAA Homes Website" <${ADMIN_EMAIL}>`,
    to: ADMIN_EMAIL,
    subject: `New Contact Form Submission - ${name}`,
    html: `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
      ${interest ? `<p><strong>Interest:</strong> ${interest}</p>` : ''}
      ${area ? `<p><strong>Area:</strong> ${area}</p>` : ''}
      ${message ? `<p><strong>Message:</strong><br>${message.replace(/\n/g, '<br>')}</p>` : ''}
      <hr>
      <p><small>Submitted at: ${new Date().toLocaleString()}</small></p>
    `,
    text: `
New Contact Form Submission

Name: ${name}
Email: ${email}
${phone ? `Phone: ${phone}` : ''}
${interest ? `Interest: ${interest}` : ''}
${area ? `Area: ${area}` : ''}
${message ? `Message:\n${message}` : ''}

Submitted at: ${new Date().toLocaleString()}
    `.trim(),
  };

  return deliverLeadNotification(submission, mailOptions, 'Contact', 'contact');
};

export const sendChfaLeadNotification = async (submission) => {
  const { first_name, last_name, email, phone, school_employer, buying_timeline, message } = submission;

  const mailOptions = {
    from: `"SAA Homes Website" <${ADMIN_EMAIL}>`,
    to: ADMIN_EMAIL,
    subject: `New CHFA Schools To Home Lead - ${first_name} ${last_name}`,
    html: `
      <h2>New CHFA Schools To Home Lead</h2>
      <p><strong>Name:</strong> ${first_name} ${last_name}</p>
      <p><strong>Email:</strong> ${email}</p>
      ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
      ${school_employer ? `<p><strong>School/District:</strong> ${school_employer}</p>` : ''}
      ${buying_timeline ? `<p><strong>Buying Timeline:</strong> ${buying_timeline}</p>` : ''}
      ${message ? `<p><strong>Message:</strong><br>${message.replace(/\n/g, '<br>')}</p>` : ''}
      <hr>
      <p><small>Submitted at: ${new Date().toLocaleString()}</small></p>
    `,
    text: `
New CHFA Schools To Home Lead

Name: ${first_name} ${last_name}
Email: ${email}
${phone ? `Phone: ${phone}` : ''}
${school_employer ? `School/District: ${school_employer}` : ''}
${buying_timeline ? `Buying Timeline: ${buying_timeline}` : ''}
${message ? `Message:\n${message}` : ''}

Submitted at: ${new Date().toLocaleString()}
    `.trim(),
  };

  return deliverLeadNotification(submission, mailOptions, 'CHFA lead', 'CHFA lead');
};

export const sendMarketReportNotification = async (submission) => {
  const { firstName, lastName, email, phone, area } = submission;

  const mailOptions = {
    from: `"SAA Homes Website" <${ADMIN_EMAIL}>`,
    to: ADMIN_EMAIL,
    subject: `New Market Report Request - ${firstName} ${lastName}`,
    html: `
      <h2>New Market Report Request</h2>
      <p><strong>Name:</strong> ${firstName} ${lastName}</p>
      <p><strong>Email:</strong> ${email}</p>
      ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
      ${area ? `<p><strong>Area:</strong> ${area}</p>` : ''}
      <hr>
      <p><small>Submitted at: ${new Date().toLocaleString()}</small></p>
    `,
    text: `
New Market Report Request

Name: ${firstName} ${lastName}
Email: ${email}
${phone ? `Phone: ${phone}` : ''}
${area ? `Area: ${area}` : ''}

Submitted at: ${new Date().toLocaleString()}
    `.trim(),
  };

  return deliverLeadNotification(submission, mailOptions, 'Market report', 'market report');
};

export const sendChampionsLeadNotification = async (submission) => {
  const {
    first_name, last_name, email, phone, responder_type, employer_agency, buying_timeline, message,
  } = submission;

  const mailOptions = {
    from: `"SAA Homes Website" <${ADMIN_EMAIL}>`,
    to: ADMIN_EMAIL,
    subject: `New Champions Home Loan Lead - ${first_name} ${last_name}`,
    html: `
      <h2>New Colorado Champions Home Loan Lead</h2>
      <p><strong>Name:</strong> ${first_name} ${last_name}</p>
      <p><strong>Email:</strong> ${email}</p>
      ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
      ${responder_type ? `<p><strong>Role:</strong> ${responder_type}</p>` : ''}
      ${employer_agency ? `<p><strong>Employer/Agency:</strong> ${employer_agency}</p>` : ''}
      ${buying_timeline ? `<p><strong>Buying Timeline:</strong> ${buying_timeline}</p>` : ''}
      ${message ? `<p><strong>Message:</strong><br>${message.replace(/\n/g, '<br>')}</p>` : ''}
      <hr>
      <p><small>Submitted at: ${new Date().toLocaleString()}</small></p>
    `,
    text: `
New Colorado Champions Home Loan Lead

Name: ${first_name} ${last_name}
Email: ${email}
${phone ? `Phone: ${phone}` : ''}
${responder_type ? `Role: ${responder_type}` : ''}
${employer_agency ? `Employer/Agency: ${employer_agency}` : ''}
${buying_timeline ? `Buying Timeline: ${buying_timeline}` : ''}
${message ? `Message:\n${message}` : ''}

Submitted at: ${new Date().toLocaleString()}
    `.trim(),
  };

  return deliverLeadNotification(submission, mailOptions, 'Champions lead', 'Champions lead');
};

export const sendChfaDpaLeadNotification = async (submission) => {
  const {
    first_name, last_name, email, phone, buyer_status, target_county, buying_timeline, message,
  } = submission;

  const mailOptions = {
    from: `"SAA Homes Website" <${ADMIN_EMAIL}>`,
    to: ADMIN_EMAIL,
    subject: `New CHFA DPA Lead - ${first_name} ${last_name}`,
    html: `
      <h2>New CHFA Down Payment Assistance Lead</h2>
      <p><strong>Name:</strong> ${first_name} ${last_name}</p>
      <p><strong>Email:</strong> ${email}</p>
      ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
      ${buyer_status ? `<p><strong>Buyer Status:</strong> ${buyer_status}</p>` : ''}
      ${target_county ? `<p><strong>Target County:</strong> ${target_county}</p>` : ''}
      ${buying_timeline ? `<p><strong>Buying Timeline:</strong> ${buying_timeline}</p>` : ''}
      ${message ? `<p><strong>Message:</strong><br>${message.replace(/\n/g, '<br>')}</p>` : ''}
      <hr>
      <p><small>Submitted at: ${new Date().toLocaleString()}</small></p>
    `,
    text: `
New CHFA Down Payment Assistance Lead

Name: ${first_name} ${last_name}
Email: ${email}
${phone ? `Phone: ${phone}` : ''}
${buyer_status ? `Buyer Status: ${buyer_status}` : ''}
${target_county ? `Target County: ${target_county}` : ''}
${buying_timeline ? `Buying Timeline: ${buying_timeline}` : ''}
${message ? `Message:\n${message}` : ''}

Submitted at: ${new Date().toLocaleString()}
    `.trim(),
  };

  return deliverLeadNotification(submission, mailOptions, 'CHFA DPA lead', 'CHFA DPA lead');
};

export const sendGhopeLeadNotification = async (submission) => {
  const {
    first_name, last_name, email, phone, employer_name, target_zone, buying_timeline, message,
  } = submission;

  const mailOptions = {
    from: `"SAA Homes Website" <${ADMIN_EMAIL}>`,
    to: ADMIN_EMAIL,
    subject: `New G-HOPE Greeley Lead - ${first_name} ${last_name}`,
    html: `
      <h2>New G-HOPE Greeley Lead</h2>
      <p><strong>Name:</strong> ${first_name} ${last_name}</p>
      <p><strong>Email:</strong> ${email}</p>
      ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
      ${employer_name ? `<p><strong>Employer:</strong> ${employer_name}</p>` : ''}
      ${target_zone ? `<p><strong>Target Zone:</strong> ${target_zone}</p>` : ''}
      ${buying_timeline ? `<p><strong>Buying Timeline:</strong> ${buying_timeline}</p>` : ''}
      ${message ? `<p><strong>Message:</strong><br>${message.replace(/\n/g, '<br>')}</p>` : ''}
      <hr>
      <p><small>Submitted at: ${new Date().toLocaleString()}</small></p>
    `,
    text: `
New G-HOPE Greeley Lead

Name: ${first_name} ${last_name}
Email: ${email}
${phone ? `Phone: ${phone}` : ''}
${employer_name ? `Employer: ${employer_name}` : ''}
${target_zone ? `Target Zone: ${target_zone}` : ''}
${buying_timeline ? `Buying Timeline: ${buying_timeline}` : ''}
${message ? `Message:\n${message}` : ''}

Submitted at: ${new Date().toLocaleString()}
    `.trim(),
  };

  return deliverLeadNotification(submission, mailOptions, 'G-HOPE lead', 'G-HOPE lead');
};

