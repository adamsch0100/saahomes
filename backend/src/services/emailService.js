import transporter from '../config/email.js';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const ADMIN_EMAIL = process.env.GMAIL_USER || 'adam@saahomes.com';

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

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info('Contact notification email sent', { messageId: info.messageId });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Failed to send contact notification email', error);
    throw error;
  }
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

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info('CHFA lead notification email sent', { messageId: info.messageId });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Failed to send CHFA lead notification email', error);
    throw error;
  }
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

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info('Market report notification email sent', { messageId: info.messageId });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Failed to send market report notification email', error);
    throw error;
  }
};

