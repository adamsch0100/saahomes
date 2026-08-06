/**
 * Shared SMTP sender — reads OUTREACH_SMTP_* env vars.
 * Used by the alert digest, magic-link emails, and any transactional mail.
 * Falls back to the email_outbox queue when SMTP isn't configured on the
 * runtime (e.g. the deployed backend without SMTP env vars).
 */
import nodemailer from 'nodemailer';

const FROM = process.env.OUTREACH_SMTP_FROM || process.env.OUTREACH_SMTP_USER || 'alerts@saahomes.com';

export const smtpConfigured = () =>
  !!(process.env.OUTREACH_SMTP_HOST && process.env.OUTREACH_SMTP_USER && process.env.OUTREACH_SMTP_PASSWORD);

export async function sendEmail(to, subject, html, fromName = 'SAA Homes') {
  if (!smtpConfigured()) throw new Error('OUTREACH_SMTP_* not set');
  const transporter = nodemailer.createTransport({
    host: process.env.OUTREACH_SMTP_HOST,
    port: Number(process.env.OUTREACH_SMTP_PORT || 587),
    secure: String(process.env.OUTREACH_SMTP_SECURE || '') === 'true',
    auth: { user: process.env.OUTREACH_SMTP_USER, pass: process.env.OUTREACH_SMTP_PASSWORD },
  });
  await transporter.sendMail({ from: `"${fromName}" <${FROM}>`, to, subject, html });
}
