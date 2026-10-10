/**
 * Instant alerts on a device (web push):
 *   GET  /api/push/key          → { enabled, publicKey }
 *   GET  /api/push/status       → { devices } for the signed-in client
 *   POST /api/push/subscribe    { subscription } (signed in)
 *   POST /api/push/unsubscribe  { endpoint }     (signed in)
 */
import { sessionUserId } from '../services/events.js';
import {
  getVapidKeys,
  saveSubscription,
  removeSubscription,
  activeDeviceCount,
} from '../services/pushService.js';

export const getPushKey = async (req, res) => {
  try {
    const { publicKey } = await getVapidKeys();
    res.set('Cache-Control', 'public, max-age=3600');
    return res.json({ success: true, enabled: true, publicKey });
  } catch (e) {
    console.error('push key error:', e.message);
    return res.json({ success: true, enabled: false });
  }
};

export const getPushStatus = async (req, res) => {
  const userId = await sessionUserId(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Not signed in.' });
  return res.json({ success: true, devices: await activeDeviceCount(userId) });
};

export const subscribePush = async (req, res) => {
  try {
    const userId = await sessionUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Sign in to turn on instant alerts.' });
    const r = await saveSubscription({ userId, subscription: req.body?.subscription, req });
    if (!r.ok) return res.status(400).json({ success: false, error: 'This browser sent a push subscription we can’t use.' });
    return res.status(201).json({ success: true });
  } catch (e) {
    console.error('push subscribe error:', e.message);
    return res.status(500).json({ success: false, error: 'Could not turn on instant alerts.' });
  }
};

export const unsubscribePush = async (req, res) => {
  try {
    const userId = await sessionUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Not signed in.' });
    await removeSubscription({ userId, endpoint: req.body?.endpoint, req });
    return res.json({ success: true });
  } catch (e) {
    console.error('push unsubscribe error:', e.message);
    return res.status(500).json({ success: false, error: 'Could not turn off instant alerts.' });
  }
};
