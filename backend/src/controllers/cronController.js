/**
 * Cron endpoints — let the scheduler (Hermes cron, or Railway later) trigger
 * email work ON the saahomes.com backend instead of sending through Hermes.
 *
 *   POST /api/cron/digest?mode=due|outbox&key=CRON_SECRET
 *
 * Responds 200 with an EMPTY body when nothing was sent (silent watchdog),
 * or a small JSON summary when emails went out.
 */
import { runDigest } from '../services/alertDigest.js';

const CRON_SECRET = process.env.CRON_SECRET;

export const runCronDigest = async (req, res) => {
  if (!CRON_SECRET || req.query.key !== CRON_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const mode = req.query.mode === 'outbox' ? 'outbox' : 'due';
    const result = await runDigest({ outboxOnly: mode === 'outbox' });
    const sent = mode === 'outbox' ? result.outboxSent : result.sent;
    if (!sent) return res.status(200).send(''); // silent — nothing to report
    return res.json({ success: true, mode, sent, ...result });
  } catch (error) {
    console.error('cron digest error:', error);
    return res.status(500).json({ error: 'digest failed' });
  }
};
