/**
 * School ratings API — GreatSchools Rating cache (1–10).
 * Ratings are never fabricated; empty cache → empty list / null ratings.
 */
import {
  getSchoolsByCity,
  matchRatingsForListing,
  syncSchoolRatings,
  CORE_CITIES,
} from '../services/greatSchoolsSync.js';

/**
 * GET /api/schools?city=fort-collins&limit=20
 * Returns top-rated schools for a city from the local cache.
 */
export const listSchools = async (req, res) => {
  try {
    const city = String(req.query.city || req.query.slug || '').trim();
    if (!city) {
      return res.status(400).json({
        success: false,
        error: 'city query param required (e.g. fort-collins or Fort Collins)',
        cities: CORE_CITIES.map((c) => c.slug),
      });
    }
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const schools = await getSchoolsByCity(city, { limit });
    res.json({
      success: true,
      city,
      count: schools.length,
      data: schools.map((s) => ({
        name: s.name,
        city: s.city,
        citySlug: s.city_slug,
        rating: s.rating,
        url: s.url,
        level: s.level,
        reviewRating: s.review_rating,
        reviewCount: s.review_count,
        fetchedAt: s.fetched_at,
      })),
      attribution: {
        label: 'GreatSchools Rating',
        source: 'GreatSchools.org',
        sourceUrl: 'https://www.greatschools.org/',
      },
    });
  } catch (error) {
    console.error('listSchools failed:', error);
    res.status(500).json({ success: false, error: 'Failed to load school ratings' });
  }
};

/**
 * Cron: weekly GreatSchools sync.
 * POST /api/cron/school-ratings?key=CRON_SECRET&city=fort-collins (optional)
 */
export const runCronSchoolRatings = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.query.key !== secret) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const onlySlug = req.query.city ? String(req.query.city).trim() : null;
    const summary = await syncSchoolRatings({ onlySlug });
    return res.json({ success: true, ...summary });
  } catch (error) {
    console.error('cron school-ratings error:', error);
    return res.status(500).json({ error: 'school ratings sync failed' });
  }
};

/** Helper used by listingController to attach schools[] to detail payload. */
export { matchRatingsForListing };
