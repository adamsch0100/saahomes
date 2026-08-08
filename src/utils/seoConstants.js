export const SITE_URL = 'https://saahomes.com';
export const SITE_NAME = 'SAA Homes';
export const SITE_TITLE_SUFFIX = 'Schwartz and Associates | Northern Colorado Real Estate';

export const BUSINESS = {
  name: 'Schwartz and Associates',
  legalName: 'Schwartz and Associates, Coldwell Banker Realty',
  url: SITE_URL,
  telephone: '(970) 999-1407',
  email: 'info@saahomes.com',
  logo: `${SITE_URL}/images/White-Logo-AUTOx110.fit.png`,
  googleBusinessProfile: 'https://www.google.com/maps/place/Schwartz+and+Associates,+Coldwell+Banker+Realty/@40.5377165,-105.0741491,17z/data=!3m1!4b1!4m6!3m5!1s0x876eaddc6066cca7:0x835527dd833bac8c!8m2!3d40.5377165!4d-105.0741491!16s%2Fg%2F11h_7vxx81',
  address: {
    streetAddress: '3665 John F Kennedy Parkway, Suite 210',
    addressLocality: 'Fort Collins',
    addressRegion: 'CO',
    postalCode: '80525',
    addressCountry: 'US',
  },
  geo: {
    latitude: '40.5377165',
    longitude: '-105.0741491',
  },
  areaServed: [
    'Fort Collins, CO',
    'Loveland, CO',
    'Windsor, CO',
    'Greeley, CO',
    'Timnath, CO',
    'Wellington, CO',
    'Johnstown, CO',
    'Eaton, CO',
    'Milliken, CO',
    'La Salle, CO',
    'Mead, CO',
    'Longmont, CO',
    'Boulder, CO',
    'Berthoud, CO',
    'Firestone, CO',
    'Frederick, CO',
    'Evans, CO',
    'Severance, CO',
    'Niwot, CO',
    'Erie, CO',
    'Brighton, CO',
    'Estes Park, CO',
    'Red Feather Lakes, CO',
    'Fort Lupton, CO',
    'Lyons, CO',
    'Bellvue, CO',
    'Carbon Valley, CO',
    'Northern Colorado',
    'Colorado',
  ],
  sameAs: [
    'https://www.google.com/maps/place/Schwartz+and+Associates,+Coldwell+Banker+Realty/@40.5377165,-105.0741491,17z/data=!3m1!4b1!4m6!3m5!1s0x876eaddc6066cca7:0x835527dd833bac8c!8m2!3d40.5377165!4d-105.0741491!16s%2Fg%2F11h_7vxx81',
    'https://www.facebook.com/schwartzandassociateshomes',
    'https://www.instagram.com/saa_homes/',
    'https://youtube.com/@SAAHomes',
    'https://twitter.com/saahomes',
  ],
  alternateName: [
    'SAA Homes',
    'Schwartz and Associates, Coldwell Banker Realty',
    'Schwartz And Associates',
  ],
  priceRange: '$$',
};

export const toAbsoluteUrl = (path) => {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

export const formatBusinessAddress = () => {
  const { streetAddress, addressLocality, addressRegion, postalCode } = BUSINESS.address;
  return `${streetAddress}, ${addressLocality}, ${addressRegion} ${postalCode}`;
};

// ---------------------------------------------------------------------------
// ItemList schema helpers (GEO/AEO — machine-enumerable listings & area guides)
// Canonical listing URLs use /homes-for-sale/{slug}/ (live site route).
// ---------------------------------------------------------------------------

/** Street line for a listing card / ListItem name. */
export function formatListingStreet(listing) {
  if (!listing) return '';
  return [listing.street_number, listing.street_name, listing.unit && `#${listing.unit}`]
    .filter(Boolean)
    .join(' ');
}

/** Human-readable ListItem name — address or short description, never fabricated. */
export function formatListingItemName(listing) {
  if (!listing) return 'Home for sale in Northern Colorado';
  const street = formatListingStreet(listing);
  const city = listing.city || '';
  if (street && city) return `${street}, ${city}, CO`;
  if (street) return street;
  if (city) return `Home for sale in ${city}, CO`;
  return 'Home for sale in Northern Colorado';
}

/**
 * Canonical listing detail URL.
 * Uses /homes-for-sale/{slug}/ — the live React route and SEO canonical.
 * Falls back to listing_id (API accepts either for detail lookup).
 */
export function listingCanonicalUrl(listing) {
  if (!listing) return null;
  const key = listing.slug || listing.listing_id;
  if (!key) return null;
  return `${SITE_URL}/homes-for-sale/${key}/`;
}

/**
 * ItemList of real MLS listings for search / area featured grids.
 * @param {Array} listings — rows from /api/listings (must have slug or listing_id)
 * @param {{ name?: string, description?: string, maxItems?: number }} options
 * @returns {object|null} JSON-LD ItemList or null when no valid items
 */
export function buildListingsItemListSchema(listings, options = {}) {
  const {
    name = 'Homes for Sale in Northern Colorado',
    description,
    maxItems = 24,
  } = options;

  if (!Array.isArray(listings) || listings.length === 0) return null;

  const items = listings
    .slice(0, Math.max(0, maxItems))
    .map((listing) => {
      const url = listingCanonicalUrl(listing);
      if (!url) return null;
      return {
        '@type': 'ListItem',
        position: 0, // filled below
        url,
        name: formatListingItemName(listing),
      };
    })
    .filter(Boolean)
    .map((item, i) => ({ ...item, position: i + 1 }));

  if (items.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    ...(description ? { description } : {}),
    numberOfItems: items.length,
    itemListElement: items,
  };
}

/**
 * ItemList of Northern Colorado area guide pages (hub enumeration for AI).
 * @param {Array<{ slug: string, city: string }>} areas — from areaSeoPages
 * @param {{ name?: string, description?: string }} options
 */
export function buildAreaGuidesItemListSchema(areas, options = {}) {
  const {
    name = 'Northern Colorado Area Guides',
    description =
      'Real estate area guides for 27+ Northern Colorado communities served by Schwartz and Associates.',
  } = options;

  if (!Array.isArray(areas) || areas.length === 0) return null;

  const items = areas
    .filter((a) => a && a.slug && a.city)
    .map((area, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/northern-colorado-areas/${area.slug}/`,
      name: `${area.city}, CO Real Estate Guide`,
    }));

  if (items.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    description,
    numberOfItems: items.length,
    itemListElement: items,
  };
}
