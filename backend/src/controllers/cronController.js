/**
 * Cron endpoints — let the scheduler (Hermes cron, or Railway later) trigger
 * email work ON the saahomes.com backend instead of sending through Hermes.
 *
 *   POST /api/cron/digest?mode=due|outbox|home-value&key=CRON_SECRET
 *
 * Responds 200 with an EMPTY body when nothing was sent (silent watchdog),
 * or a small JSON summary when emails went out.
 */
import { runDigest } from '../services/alertDigest.js';
import { runHomeValueDigest } from '../services/homeValueDigest.js';

const CRON_SECRET = process.env.CRON_SECRET;

export const runCronDigest = async (req, res) => {
  if (!CRON_SECRET || req.query.key !== CRON_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const mode = String(req.query.mode || 'due');
    if (mode === 'home-value' || mode === 'home_value' || mode === 'seller') {
      const result = await runHomeValueDigest({
        force: req.query.force === '1' || req.query.force === 'true',
      });
      if (!result.sent) return res.status(200).send('');
      return res.json({ success: true, mode: 'home-value', ...result });
    }
    const outboxOnly = mode === 'outbox';
    const result = await runDigest({ outboxOnly });
    const sent = outboxOnly ? result.outboxSent : result.sent;
    if (!sent) return res.status(200).send(''); // silent — nothing to report
    return res.json({ success: true, mode: outboxOnly ? 'outbox' : 'due', sent, ...result });
  } catch (error) {
    console.error('cron digest error:', error);
    return res.status(500).json({ error: 'digest failed' });
  }
};
