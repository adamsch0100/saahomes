/**
 * Parse natural-language home-search intent into saved-search filter params.
 * Field names / values match alertController cleanFilters + ListingSearch.
 * Never invents data — only extracts what the user explicitly said.
 */

export const NCO_CITIES = [
  'Fort Collins', 'Loveland', 'Windsor', 'Greeley', 'Timnath', 'Wellington',
  'Johnstown', 'Eaton', 'Milliken', 'La Salle', 'Mead', 'Longmont', 'Boulder',
  'Berthoud', 'Firestone', 'Frederick', 'Evans', 'Severance', 'Niwot',
];

// Longer names first so "Fort Collins" beats "Collins", "La Salle" beats "Salle"
const CITY_PATTERNS = [...NCO_CITIES]
  .sort((a, b) => b.length - a.length)
  .map((name) => ({
    name,
    re: new RegExp(`\\b${name.replace(/\s+/g, '\\s+')}\\b`, 'i'),
  }));

const TYPE_MAP = [
  { re: /\b(town\s*homes?|townhomes?|townhouses?)\b/i, type: 'attached' },
  { re: /\b(condos?|condominiums?)\b/i, type: 'attached' },
  { re: /\b(multi[-\s]?family|duplex|triplex|fourplex)\b/i, type: 'attached' },
  { re: /\b(single[-\s]?family|detached|houses?|homes?)\b/i, type: 'detached' },
  { re: /\b(land|lots?|acreage)\b/i, type: 'land' },
  { re: /\bcommercial\b/i, type: 'commercial' },
];

/** Parse "$400K", "400,000", "under 400k", "1.2M" → integer dollars or null */
function parseMoneyToken(raw) {
  if (!raw) return null;
  let s = String(raw).trim().toLowerCase().replace(/[$,\s]/g, '');
  if (!s) return null;
  const m = s.match(/^(\d+(?:\.\d+)?)(k|m)?$/i);
  if (!m) return null;
  let n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0) return null;
  const suffix = (m[2] || '').toLowerCase();
  if (suffix === 'k') n *= 1000;
  else if (suffix === 'm') n *= 1_000_000;
  // Bare numbers like "400" in price context usually mean $400K if < 10_000
  if (!suffix && n > 0 && n < 10_000) n *= 1000;
  if (n < 1000 || n > 50_000_000) return null;
  return Math.round(n);
}

function parseIntToken(raw, min = 0, max = 20) {
  const n = Number(String(raw).replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return Math.round(n);
}

/**
 * Extract filter object from free-text. Returns null if no usable criteria.
 * @param {string} text
 * @returns {{ filters: object, summary: string, confidence: 'high'|'medium'|'low' } | null}
 */
export function parseSearchIntent(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 4) return null;

  const filters = {};

  // --- City (multi allowed as comma-joined, matching ListingSearch) ---
  const cities = [];
  for (const { name, re } of CITY_PATTERNS) {
    if (re.test(t) && !cities.some((c) => c.toLowerCase() === name.toLowerCase())) {
      cities.push(name);
    }
  }
  if (cities.length) filters.city = cities.join(',');

  // ZIP
  const zipMatch = t.match(/\b(\d{5})\b/);
  if (zipMatch && !filters.city) {
    // Store as q when no city — digest/search still works via q in some paths;
    // also keep city empty and put zip in q for keyword-ish match.
    filters.q = zipMatch[1];
  }

  // --- Price ---
  // under/below/less than / max / up to
  const maxPricePatterns = [
    /(?:under|below|less\s+than|up\s+to|max(?:imum)?(?:\s+of)?|no\s+more\s+than)\s*\$?\s*([\d,.]+\s*[kKmM]?)/i,
    /\$\s*([\d,.]+\s*[kKmM]?)\s*(?:or\s+less|and\s+under|max)/i,
    /(?:budget|price)\s*(?:of|is|under|below)?\s*\$?\s*([\d,.]+\s*[kKmM]?)/i,
  ];
  for (const re of maxPricePatterns) {
    const m = t.match(re);
    if (m) {
      const n = parseMoneyToken(m[1]);
      if (n) { filters.maxPrice = String(n); break; }
    }
  }
  // over/above/at least / min / starting at
  const minPricePatterns = [
    /(?:over|above|at\s+least|minimum|starting\s+(?:at|from)|more\s+than)\s*\$?\s*([\d,.]+\s*[kKmM]?)/i,
    /\$\s*([\d,.]+\s*[kKmM]?)\s*(?:\+|or\s+more|and\s+up|min)/i,
  ];
  for (const re of minPricePatterns) {
    const m = t.match(re);
    if (m) {
      const n = parseMoneyToken(m[1]);
      if (n) { filters.minPrice = String(n); break; }
    }
  }
  // Range: $300k-$450k or between $300k and $450k
  const rangeM = t.match(/(?:between\s+)?\$?\s*([\d,.]+\s*[kKmM]?)\s*(?:-|–|to|and)\s*\$?\s*([\d,.]+\s*[kKmM]?)/i);
  if (rangeM && !filters.minPrice && !filters.maxPrice) {
    const a = parseMoneyToken(rangeM[1]);
    const b = parseMoneyToken(rangeM[2]);
    if (a && b) {
      filters.minPrice = String(Math.min(a, b));
      filters.maxPrice = String(Math.max(a, b));
    }
  }
  // Bare "$400k homes" → max if no min/max yet (common buyer phrasing)
  if (!filters.minPrice && !filters.maxPrice) {
    const bare = t.match(/\$\s*([\d,.]+\s*[kKmM]?)/i);
    if (bare) {
      const n = parseMoneyToken(bare[1]);
      if (n) filters.maxPrice = String(n);
    }
  }

  // --- Beds ---
  const bedsM = t.match(/(\d+)\s*(?:\+)?\s*(?:bed(?:room)?s?|br\b)/i)
    || t.match(/(?:bed(?:room)?s?|br)\s*[:=]?\s*(\d+)/i);
  if (bedsM) {
    const n = parseIntToken(bedsM[1], 1, 12);
    if (n) filters.beds = String(n);
  }

  // --- Baths ---
  const bathsM = t.match(/(\d+(?:\.\d)?)\s*(?:\+)?\s*(?:bath(?:room)?s?|ba\b)/i)
    || t.match(/(?:bath(?:room)?s?|ba)\s*[:=]?\s*(\d+(?:\.\d)?)/i);
  if (bathsM) {
    const n = Number(bathsM[1]);
    if (Number.isFinite(n) && n >= 1 && n <= 12) filters.baths = String(Math.round(n));
  }

  // Combined "3/2" or "3 bed 2 bath" already handled; also "3bd/2ba"
  const combo = t.match(/(\d+)\s*(?:bd|br|bed)\s*[\/,]\s*(\d+(?:\.\d)?)\s*(?:ba|bath)?/i);
  if (combo) {
    if (!filters.beds) {
      const n = parseIntToken(combo[1], 1, 12);
      if (n) filters.beds = String(n);
    }
    if (!filters.baths) {
      const n = Number(combo[2]);
      if (Number.isFinite(n) && n >= 1 && n <= 12) filters.baths = String(Math.round(n));
    }
  }

  // --- Sqft ---
  const sqftM = t.match(/(\d{3,5})\s*(?:\+)?\s*(?:sq\.?\s*ft\.?|sqft|square\s+feet)/i)
    || t.match(/(?:at\s+least|min(?:imum)?)\s*(\d{3,5})\s*(?:sq\.?\s*ft\.?|sqft)/i);
  if (sqftM) {
    const n = Number(sqftM[1]);
    if (n >= 200 && n <= 20000) filters.minSqft = String(n);
  }

  // --- Year ---
  const yearM = t.match(/(?:built\s+)?(?:after|since|newer\s+than|from)\s*(19\d{2}|20[0-2]\d)/i)
    || t.match(/(19\d{2}|20[0-2]\d)\s+or\s+newer/i);
  if (yearM) filters.minYear = yearM[1];

  // --- Boolean features ---
  if (/\b(with\s+a\s+)?pool\b|\bswimming\s+pool\b/i.test(t)) filters.pool = 'true';
  if (/\b(waterfront|lake\s*front|on\s+the\s+(?:lake|river|water))\b/i.test(t)) filters.waterfront = 'true';
  if (/\b(new\s+construction|brand\s+new|newly\s+built)\b/i.test(t)) filters.newConstruction = 'true';
  if (/\bassumable\b|\bassume\s+(?:the\s+)?(?:loan|mortgage|va|fha)\b|\bloan\s+assumption\b/i.test(t)) {
    filters.assumable = 'true';
  }
  if (/\bbasement\b/i.test(t)) filters.basement = 'true';
  if (/\b(garage|2[\s-]?car|3[\s-]?car)\b/i.test(t)) filters.garage = 'true';
  if (/\bfireplace\b/i.test(t)) filters.fireplace = 'true';

  // --- HOA ---
  if (/\bno\s+hoa\b/i.test(t)) filters.maxHoa = '0';
  const hoaM = t.match(/(?:hoa|dues)\s*(?:under|below|max|≤|<=)?\s*\$?\s*(\d{2,4})/i);
  if (hoaM && !filters.maxHoa) filters.maxHoa = hoaM[1];

  // --- Home type ---
  for (const { re, type } of TYPE_MAP) {
    if (re.test(t)) {
      // Only set type for specific non-generic matches; bare "homes" is too weak alone
      if (type === 'detached' && !/\b(single[-\s]?family|detached|houses?)\b/i.test(t)) {
        // "homes under $400k" shouldn't force detached — skip
        continue;
      }
      filters.type = type;
      break;
    }
  }

  // --- Keywords for features not in bool filters ---
  const keywordBits = [];
  if (/\brv\s*(garage|parking|pad)?\b/i.test(t)) keywordBits.push('RV');
  if (/\b(mountain\s+view|city\s+view|views?)\b/i.test(t) && !filters.waterfront) keywordBits.push('view');
  if (/\b(ranch|craftsman|modern|victorian|farmhouse)\b/i.test(t)) {
    const style = t.match(/\b(ranch|craftsman|modern|victorian|farmhouse)\b/i);
    if (style) keywordBits.push(style[1]);
  }
  if (keywordBits.length) filters.q = [filters.q, ...keywordBits].filter(Boolean).join(' ');

  const keys = Object.keys(filters);
  if (keys.length === 0) return null;

  // Intent confidence: needs location OR price OR beds-ish to be a real "search"
  const hasLocation = !!(filters.city || (filters.q && /^\d{5}$/.test(String(filters.q))));
  const hasCriteria = !!(filters.minPrice || filters.maxPrice || filters.beds || filters.baths
    || filters.pool || filters.type || filters.minSqft || filters.waterfront
    || filters.newConstruction || filters.assumable);
  if (!hasLocation && !hasCriteria) return null;

  // Soft gate: phrases that look like search intent (browsing / criteria)
  const intentish = /\b(homes?|houses?|listings?|properties|condo|townhome|looking\s+for|show\s+me|find|search|under\s+\$|bedroom|bath|alerts?|notify|save\s+(this\s+)?search)\b/i.test(t)
    || hasLocation
    || !!(filters.minPrice || filters.maxPrice);
  if (!intentish) return null;

  let confidence = 'medium';
  if ((hasLocation && hasCriteria) || (hasCriteria && keys.length >= 2)) confidence = 'high';
  else if (!hasCriteria && hasLocation) confidence = 'low';

  return {
    filters,
    summary: summarizeFilters(filters),
    confidence,
  };
}

/** Human-readable filter summary (matches SaveSearchModal tone). */
export function summarizeFilters(filters = {}) {
  const parts = [];
  if (filters.city) parts.push(filters.city);
  if (filters.minPrice || filters.maxPrice) {
    const f = (n) => (n ? `$${Number(n).toLocaleString()}` : 'Any');
    if (filters.minPrice && filters.maxPrice) {
      parts.push(`${f(filters.minPrice)} – ${f(filters.maxPrice)}`);
    } else if (filters.maxPrice) {
      parts.push(`under ${f(filters.maxPrice)}`);
    } else {
      parts.push(`${f(filters.minPrice)}+`);
    }
  }
  if (filters.beds) parts.push(`${filters.beds}+ beds`);
  if (filters.baths) parts.push(`${filters.baths}+ baths`);
  if (filters.type === 'detached') parts.push('Detached home');
  else if (filters.type === 'attached') parts.push('Condo / townhome');
  else if (filters.type === 'land') parts.push('Land');
  else if (filters.type === 'commercial') parts.push('Commercial');
  if (filters.minSqft) parts.push(`${Number(filters.minSqft).toLocaleString()}+ sqft`);
  if (filters.minYear) parts.push(`built ${filters.minYear}+`);
  if (filters.pool === 'true' || filters.pool === true) parts.push('Pool');
  if (filters.waterfront === 'true' || filters.waterfront === true) parts.push('Waterfront');
  if (filters.newConstruction === 'true' || filters.newConstruction === true) parts.push('New construction');
  if (filters.assumable === 'true' || filters.assumable === true) parts.push('Assumable loan');
  if (filters.basement === 'true' || filters.basement === true) parts.push('Basement');
  if (filters.garage === 'true' || filters.garage === true) parts.push('Garage');
  if (filters.fireplace === 'true' || filters.fireplace === true) parts.push('Fireplace');
  if (filters.maxHoa === '0' || filters.maxHoa === 0) parts.push('No HOA');
  else if (filters.maxHoa) parts.push(`HOA ≤ $${filters.maxHoa}`);
  if (filters.q) parts.push(`“${filters.q}”`);
  return parts.length ? parts.join(' · ') : 'All Northern Colorado';
}

/** Default name for a search created from chat. */
export function nameFromFilters(filters = {}) {
  const bits = [];
  if (filters.city) bits.push(String(filters.city).split(',')[0]);
  if (filters.beds) bits.push(`${filters.beds}+ bed`);
  if (filters.maxPrice) bits.push(`under $${Number(filters.maxPrice).toLocaleString()}`);
  else if (filters.minPrice) bits.push(`from $${Number(filters.minPrice).toLocaleString()}`);
  if (filters.pool === 'true') bits.push('pool');
  if (filters.assumable === 'true') bits.push('assumable');
  if (filters.type === 'attached') bits.push('condo/TH');
  if (filters.type === 'land') bits.push('land');
  return bits.length ? bits.join(' · ').slice(0, 80) : 'Nadia chat search';
}

/**
 * Scan recent user messages for the best search intent (most recent first).
 * @param {Array<{role:string,content:string}>} messages
 */
export function extractSearchFromMessages(messages = []) {
  const userMsgs = (messages || [])
    .filter((m) => m && m.role === 'user' && m.content)
    .map((m) => String(m.content));
  // Prefer the latest user message; if low confidence, try combining last 2
  for (let i = userMsgs.length - 1; i >= 0; i--) {
    const parsed = parseSearchIntent(userMsgs[i]);
    if (parsed && parsed.confidence !== 'low') return { ...parsed, sourceText: userMsgs[i] };
  }
  if (userMsgs.length >= 2) {
    const combined = userMsgs.slice(-2).join(' · ');
    const parsed = parseSearchIntent(combined);
    if (parsed) return { ...parsed, sourceText: combined };
  }
  // Last resort: accept low-confidence from latest
  if (userMsgs.length) {
    const parsed = parseSearchIntent(userMsgs[userMsgs.length - 1]);
    if (parsed) return { ...parsed, sourceText: userMsgs[userMsgs.length - 1] };
  }
  return null;
}

/**
 * Heuristic: does this message look like search/browse intent (not just CHFA Q&A)?
 */
export function hasSearchIntent(text) {
  if (!text) return false;
  const t = String(text);
  if (/\b(homes?\s+for\s+sale|show\s+me|find\s+me|looking\s+for|search\s+for|under\s+\$|in\s+\w+\s+with|bed(?:room)?s?|set\s+up\s+alerts?|notify\s+me|save\s+(this\s+)?search|email\s+me\s+when)\b/i.test(t)) {
    return true;
  }
  return parseSearchIntent(t) != null;
}
