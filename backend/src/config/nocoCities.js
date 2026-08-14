/**
 * Northern Colorado cities we own (core 19 + corridor).
 * Keep in sync with listingController NOCO_CITIES / src/data/areaSeo.js.
 */
export const NOCO_CITIES = [
  'Fort Collins', 'Loveland', 'Windsor', 'Greeley', 'Timnath', 'Wellington',
  'Johnstown', 'Eaton', 'Milliken', 'La Salle', 'Mead', 'Longmont', 'Boulder',
  'Berthoud', 'Firestone', 'Frederick', 'Evans', 'Severance', 'Niwot',
  'Erie', 'Brighton', 'Estes Park', 'Red Feather Lakes', 'Fort Lupton',
  'Lyons', 'Bellvue', 'Carbon Valley',
];

export const CITY_BY_SLUG = {
  'fort-collins': 'Fort Collins',
  loveland: 'Loveland',
  windsor: 'Windsor',
  greeley: 'Greeley',
  timnath: 'Timnath',
  wellington: 'Wellington',
  johnstown: 'Johnstown',
  eaton: 'Eaton',
  milliken: 'Milliken',
  'la-salle': 'La Salle',
  mead: 'Mead',
  longmont: 'Longmont',
  boulder: 'Boulder',
  berthoud: 'Berthoud',
  firestone: 'Firestone',
  frederick: 'Frederick',
  evans: 'Evans',
  severance: 'Severance',
  niwot: 'Niwot',
  erie: 'Erie',
  brighton: 'Brighton',
  'estes-park': 'Estes Park',
  'red-feather-lakes': 'Red Feather Lakes',
  'fort-lupton': 'Fort Lupton',
  lyons: 'Lyons',
  bellvue: 'Bellvue',
  'carbon-valley': 'Carbon Valley',
};

const NOCO_LOWER = new Set(NOCO_CITIES.map((c) => c.toLowerCase()));

export function isNocoCity(city) {
  return NOCO_LOWER.has(String(city || '').trim().toLowerCase());
}

/** slug or display name → canonical city, or null for the all-NoCO scope. */
export function resolveSoldCity(raw) {
  if (raw == null || raw === '') return { city: null, slug: '', label: 'Northern Colorado' };
  const s = String(raw).trim();
  if (!s) return { city: null, slug: '', label: 'Northern Colorado' };
  const lower = s.toLowerCase();
  if (lower === 'northern-colorado' || lower === 'noco' || lower === '__noco__' || lower === 'northern colorado') {
    return { city: null, slug: '', label: 'Northern Colorado' };
  }
  if (CITY_BY_SLUG[lower]) {
    return { city: CITY_BY_SLUG[lower], slug: lower, label: CITY_BY_SLUG[lower] };
  }
  const match = NOCO_CITIES.find((c) => c.toLowerCase() === lower);
  if (match) {
    const slug = Object.keys(CITY_BY_SLUG).find((k) => CITY_BY_SLUG[k] === match) || '';
    return { city: match, slug, label: match };
  }
  return { city: null, slug: '', label: 'Northern Colorado', unknown: true };
}
