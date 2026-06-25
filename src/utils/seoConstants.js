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
