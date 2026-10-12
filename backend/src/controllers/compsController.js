/**
 * Homeowner comps on My Home:
 *   GET /api/home/:id/comps — recent similar sales, the owner's picks and their estimate
 *   PUT /api/home/:id/comps — { included: [sale ids], condition, upgrades: [] }
 *
 * Choices are kept on the home profile, so the owner's number survives a
 * reload. The agent hears about it as seller interest, at most every half hour.
 */
import getPool from '../config/database.js';
import { recordEvent as recordStreamEvent } from '../services/events.js';
import {
  CONDITIONS,
  DEFAULT_INCLUDED,
  UPGRADES,
  adjustComp,
  compEstimate,
  findComps,
} from '../services/compsService.js';
import { flagSellerHeat } from '../services/sellerValueService.js';
import { resolveUser } from './savedHomesController.js';

const NOTE_EVERY_MS = 30 * 60 * 1000;
const fmt = (v) => (v == null ? '—' : `$${Math.round(v).toLocaleString('en-US')}`);

async function ownedProfile(req, res) {
  const user = await resolveUser(req);
  if (!user) {
    res.status(401).json({ success: false, error: 'Sign in to see your home.' });
    return {};
  }
  const { rows: [profile] } = await getPool().query(
    'SELECT * FROM home_profiles WHERE id = $1 AND user_id = $2',
    [Number(req.params.id) || 0, user.id]
  );
  if (!profile) {
    res.status(404).json({ success: false, error: 'Home not found.' });
    return {};
  }
  return { user, profile };
}

function view(profile, found, settings) {
  const included = new Set(settings.included);
  const comps = found.comps.map((c) => ({ ...c, included: included.has(c.id), ...adjustComp(profile, c) }));
  return {
    scope: found.scope,
    comps,
    condition: settings.condition,
    upgrades: settings.upgrades,
    estimate: compEstimate(profile, comps.filter((c) => c.included), settings),
    options: {
      conditions: Object.entries(CONDITIONS).map(([value, c]) => ({ value, label: c.label, pct: c.pct })),
      upgrades: Object.entries(UPGRADES).map(([value, u]) => ({ value, label: u.label, pct: u.pct })),
    },
    saved_at: profile.meta?.comps?.saved_at || null,
  };
}

function savedSettings(profile, found) {
  const saved = profile.meta?.comps || {};
  const ids = new Set(found.comps.map((c) => c.id));
  const included = Array.isArray(saved.included) ? saved.included.filter((id) => ids.has(id)) : null;
  return {
    included: included?.length ? included : found.comps.slice(0, DEFAULT_INCLUDED).map((c) => c.id),
    condition: CONDITIONS[saved.condition] ? saved.condition : 'average',
    upgrades: Array.isArray(saved.upgrades) ? saved.upgrades.filter((u) => UPGRADES[u]) : [],
  };
}

/** GET /api/home/:id/comps */
export const getComps = async (req, res) => {
  try {
    const { profile } = await ownedProfile(req, res);
    if (!profile) return undefined;
    const found = await findComps(profile);
    res.set('Cache-Control', 'private, no-store');
    return res.json({ success: true, data: view(profile, found, savedSettings(profile, found)) });
  } catch (error) {
    console.error('getComps error:', error);
    return res.status(500).json({ success: false, error: 'Could not load recent sales.' });
  }
};

/** PUT /api/home/:id/comps */
export const saveComps = async (req, res) => {
  try {
    const { user, profile } = await ownedProfile(req, res);
    if (!profile) return undefined;
    const body = req.body || {};
    if (!Array.isArray(body.included) || body.included.length > 50) {
      return res.status(400).json({ success: false, error: 'Pick the sales to include.' });
    }
    if (body.condition != null && !CONDITIONS[body.condition]) {
      return res.status(400).json({ success: false, error: 'Unknown condition.' });
    }
    if (body.upgrades != null && (!Array.isArray(body.upgrades) || body.upgrades.some((u) => !UPGRADES[u]))) {
      return res.status(400).json({ success: false, error: 'Unknown upgrade.' });
    }
    const pool = getPool();
    const found = await findComps(profile, pool);
    const ids = new Set(found.comps.map((c) => c.id));
    const settings = {
      included: [...new Set(body.included.map(String))].filter((id) => ids.has(id)),
      condition: body.condition || 'average',
      upgrades: [...new Set(body.upgrades || [])],
    };
    const result = view(profile, found, settings);
    const prev = profile.meta?.comps || {};
    const notedAt = prev.noted_at ? new Date(prev.noted_at).getTime() : 0;
    const shouldNote = result.estimate && Date.now() - notedAt > NOTE_EVERY_MS;
    const savedAt = new Date().toISOString();
    const comps = {
      ...settings,
      estimate: result.estimate,
      saved_at: savedAt,
      noted_at: shouldNote ? savedAt : prev.noted_at || null,
    };
    await pool.query(
      `UPDATE home_profiles SET meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('comps', $1::jsonb), updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(comps), profile.id]
    );
    result.saved_at = savedAt;

    recordStreamEvent({
      type: 'comps_adjusted',
      userId: user.id,
      meta: { home_id: profile.id, used: result.estimate?.used || 0, mid: result.estimate?.mid || null },
    });
    if (shouldNote) {
      flagSellerHeat(user.id, 'comps_adjusted', { home_id: profile.id, mid: result.estimate.mid }, pool).catch(() => {});
      const picked = result.comps.filter((c) => c.included);
      const address = [profile.address_line, profile.city].filter(Boolean).join(', ');
      const lines = [
        `${user.name || user.email} built their own value for ${address} from ${picked.length} recent sale${picked.length === 1 ? '' : 's'}: ${fmt(result.estimate.mid)} (${fmt(result.estimate.low)} – ${fmt(result.estimate.high)}).`,
        `Condition: ${CONDITIONS[settings.condition].label}.`,
        settings.upgrades.length ? `Upgrades: ${settings.upgrades.map((u) => UPGRADES[u].label).join(', ')}.` : 'No upgrades listed.',
        'Sales they picked:',
        ...picked.map((c) => `- ${c.address}, sold ${fmt(c.sold_price)}${c.closed_date ? ` on ${new Date(c.closed_date).toISOString().slice(0, 10)}` : ''}`),
      ];
      import('../services/followUpBossService.js')
        .then(({ addFollowUpBossNote }) => addFollowUpBossNote(user.id, {
          subject: `Homeowner picked comps: ${address}`,
          body: lines.join('\n'),
        }, { pool }))
        .catch(() => {});
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('saveComps error:', error);
    return res.status(500).json({ success: false, error: 'Could not save your picks.' });
  }
};
