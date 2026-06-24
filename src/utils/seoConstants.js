export const SITE_URL = 'https://saahomes.com';
export const SITE_NAME = 'SAA Homes';
export const SITE_TITLE_SUFFIX = 'SAA Homes | Northern Colorado Real Estate';

export const BUSINESS = {
  name: 'Schwartz And Associates',
  legalName: 'Schwartz and Associates',
  url: SITE_URL,
  telephone: '(970) 999-1407',
  email: 'info@saahomes.com',
  logo: `${SITE_URL}/images/White-Logo-AUTOx110.fit.png`,
  address: {
    streetAddress: '3665 John F Kennedy Parkway, Suite 210',
    addressLocality: 'Fort Collins',
    addressRegion: 'CO',
    postalCode: '80525',
    addressCountry: 'US',
  },
  geo: {
    latitude: '40.5853',
    longitude: '-105.0844',
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
    'Northern Colorado',
    'Colorado',
  ],
  sameAs: [
    'https://www.facebook.com/schwartzandassociateshomes',
    'https://www.instagram.com/saa_homes/',
    'https://youtube.com/@SAAHomes',
    'https://twitter.com/saahomes',
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
