/**
 * Search in plain words:
 *   POST /api/search/understand  { text, city? }  → what we understood, as chips, plus a live count
 *   POST /api/search/understand  { filters }      → same, after the buyer removes a chip
 *
 * Only what the buyer actually said becomes a filter. Asks the search can't
 * filter on (schools, commute, yard size, "quiet") come back as notes so the
 * page can say so instead of silently dropping them.
 */
import getPool from '../config/database.js';
import {
  buildSavedSearchWhere,
  sanitizeSavedFilters,
  savedSearchPath,
} from '../services/listingFilters.js';
import { parseSearchIntent, unsupportedAsks } from '../services/searchIntentParser.js';
import { listingScope } from '../services/feeds.js';
import { VISITOR_COOKIE, isValidVisitorId, recordEvent, sessionUserId } from '../services/events.js';

const MAX_TEXT = 300;
const money = (v) => {
  const n = Number(v);
  if (n >= 1_000_000) return `$${Math.round(n / 100_000) / 10}M`;
  return `$${Math.round(n / 1000)}K`;
};
const TYPE_LABELS = { detached: 'Houses', attached: 'Condos & townhomes', land: 'Land', commercial: 'Commercial' };
const BASEMENT_LABELS = { true: 'Basement', finished: 'Finished basement', walkout: 'Walkout basement', unfinished: 'Unfinished basement' };

/** One removable chip per filter, in the order a buyer reads them. */
export function chipsFor(filters = {}) {
  const f = filters;
  const chips = [];
  const add = (keys, label) => chips.push({ keys, label });
  if (f.city) add(['city'], f.city.split(',').join(', '));
  if (f.postal_code) add(['postal_code'], `ZIP ${f.postal_code.split(',').join(', ')}`);
  if (f.minPrice && f.maxPrice) add(['minPrice', 'maxPrice'], `${money(f.minPrice)}–${money(f.maxPrice)}`);
  else if (f.maxPrice) add(['maxPrice'], `Under ${money(f.maxPrice)}`);
  else if (f.minPrice) add(['minPrice'], `${money(f.minPrice)}+`);
  if (f.beds) add(['beds'], `${f.beds}+ beds`);
  if (f.baths) add(['baths'], `${f.baths}+ baths`);
  if (f.type && TYPE_LABELS[f.type]) add(['type'], TYPE_LABELS[f.type]);
  if (f.minSqft) add(['minSqft'], `${Number(f.minSqft).toLocaleString('en-US')}+ sq ft`);
  if (f.minLotAcres) {
    const acres = { 0.25: '¼', 0.5: '½', 1: '1' }[Number(f.minLotAcres)];
    add(['minLotAcres'], acres ? `${acres}+ acre lot` : `${f.minLotAcres}+ acre lot`);
  }
  if (f.minYear) add(['minYear'], `Built ${f.minYear} or later`);
  if (f.garage) add(['garage'], f.garage === 'true' ? 'Garage' : `${f.garage}+ car garage`);
  if (f.basement && BASEMENT_LABELS[f.basement]) add(['basement'], BASEMENT_LABELS[f.basement]);
  if (f.maxHoa === '0') add(['maxHoa'], 'No HOA');
  else if (f.maxHoa) add(['maxHoa'], `HOA under $${f.maxHoa}/mo`);
  if (f.pool) add(['pool'], 'Pool');
  if (f.waterfront) add(['waterfront'], 'Waterfront');
  if (f.newConstruction) add(['newConstruction'], 'New construction');
  if (f.assumable) add(['assumable'], 'Assumable loan');
  if (f.fireplace) add(['fireplace'], 'Fireplace');
  if (f.q) add(['q'], `Mentions “${f.q}”`);
  return chips;
}

export const understandSearch = async (req, res) => {
  try {
    const body = req.body || {};
    const text = typeof body.text === 'string' ? body.text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT) : '';
    let raw;
    if (text) {
      raw = parseSearchIntent(text, { lenient: true })?.filters || {};
      // On a town's page, "3 beds under 500" means in that town.
      const hubCity = typeof body.city === 'string' ? body.city.trim() : '';
      if (hubCity && !raw.city && !raw.postal_code) raw.city = hubCity;
    } else if (body.filters && typeof body.filters === 'object' && !Array.isArray(body.filters)) {
      raw = body.filters;
    } else {
      return res.status(400).json({ success: false, error: 'Tell us what you are looking for.' });
    }

    const filters = sanitizeSavedFilters(raw);
    delete filters.polygon;
    const pool = getPool();
    const { whereSql, params } = buildSavedSearchWhere(filters, await listingScope(req.tenant, { pool }));
    const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*)::int AS count FROM listings WHERE ${whereSql}`, params);

    if (text) {
      const userId = await sessionUserId(req, pool).catch(() => null);
      const visitorId = req.cookies?.[VISITOR_COOKIE];
      if (userId || isValidVisitorId(visitorId)) {
        recordEvent({ type: 'search', userId, visitorId, meta: { asked: text, filters, results: count, via: 'ask' } }, pool)
          .then((row) => (row?.user_id
            ? import('../services/followUpBossService.js').then(({ pushAskedSearchToFollowUpBoss }) => pushAskedSearchToFollowUpBoss(row, { pool }))
            : null))
          .catch((e) => console.warn('asked search → FUB failed:', e.message));
      }
    }

    return res.json({
      success: true,
      data: {
        filters,
        chips: chipsFor(filters),
        unsupported: text ? unsupportedAsks(text) : [],
        understood: Object.keys(filters).some((k) => k !== 'city'),
        count,
        path: savedSearchPath(filters),
      },
    });
  } catch (error) {
    console.error('understandSearch error:', error);
    return res.status(500).json({ success: false, error: 'Could not run that search.' });
  }
};
