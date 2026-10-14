/**
 * One place client-life features ask to send a text message. Texting is set
 * up elsewhere (consent, quiet hours, the sending number); until it is wired
 * in, every call answers that nothing was sent, and callers carry on.
 *
 * @param {{ tenantId: number, userId: number, body: string, kind: string }} msg
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
// eslint-disable-next-line no-unused-vars
export async function sendTextIfAllowed({ tenantId, userId, body, kind } = {}) {
  return { sent: false, reason: 'texting not set up' };
}

export default sendTextIfAllowed;
