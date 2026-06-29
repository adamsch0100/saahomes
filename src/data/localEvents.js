/**
 * Curated Northern Colorado events — flagship annual happenings only.
 * Hermes updates via local-events-curation skill (monthly check, quarterly refresh).
 * Last reviewed: 2026-06-29
 */

export const LATEST_EVENTS_GUIDE_SLUG = 'northern-colorado-events-guide-2026';
export const EVENTS_DATA_LAST_REVIEWED = '2026-06-29';

/** @typedef {{ name: string; season: string; description: string; officialUrl?: string; typicalMonths?: string }} LocalEvent */

/** @type {LocalEvent[]} */
export const regionalEvents = [
  {
    name: 'Larimer County Fair',
    season: 'Summer',
    typicalMonths: 'August',
    description: 'Rodeo, carnival, livestock shows, and live music at The Ranch in Loveland — a Northern Colorado tradition for families.',
    officialUrl: 'https://www.larimerfair.com/',
  },
  {
    name: 'Colorado Brewers\' Festival',
    season: 'Summer',
    typicalMonths: 'June',
    description: 'Fort Collins celebrates its craft brewing heritage with tastings from Colorado breweries in Civic Center Park.',
    officialUrl: 'https://www.visitftcollins.com/events/',
  },
];

/** @type {Record<string, LocalEvent[]>} */
export const cityEvents = {
  'fort-collins': [
    {
      name: 'FoCo Beer Week',
      season: 'Summer',
      typicalMonths: 'June',
      description: 'A week of brewery events, collaborations, and tastings across Fort Collins — the Craft Beer Capital of Colorado.',
      officialUrl: 'https://www.visitftcollins.com/events/',
    },
    {
      name: 'Taste of Fort Collins',
      season: 'Summer',
      typicalMonths: 'June',
      description: 'Downtown food, music, and community celebration along Mountain Avenue and Civic Center Park.',
      officialUrl: 'https://www.visitftcollins.com/events/',
    },
    {
      name: 'Bohemian Nights at NewWestFest',
      season: 'Summer',
      typicalMonths: 'August',
      description: 'Free downtown festival with national and local acts, local vendors, and Old Town Fort Collins at its liveliest.',
      officialUrl: 'https://www.visitftcollins.com/events/',
    },
    {
      name: 'CSU Lagoon Concert Series',
      season: 'Summer',
      typicalMonths: 'June–July',
      description: 'Free outdoor concerts on the Colorado State University campus — a beloved summer tradition for students and families.',
      officialUrl: 'https://www.visitftcollins.com/events/',
    },
    {
      name: 'Fort Collins Farmers Market',
      season: 'Year-round',
      typicalMonths: 'May–October',
      description: 'Old Town Square and other locations — local produce, artisans, and a Saturday morning community staple.',
      officialUrl: 'https://www.visitftcollins.com/events/',
    },
  ],
  loveland: [
    {
      name: 'Sculpture in the Park',
      season: 'Summer',
      typicalMonths: 'August',
      description: 'One of the largest outdoor sculpture shows in the country, at Benson Sculpture Garden and Chapungu Sculpture Park.',
      officialUrl: 'https://www.lovgov.org/community/events-calendar',
    },
    {
      name: 'Corn Roast Festival',
      season: 'Summer',
      typicalMonths: 'August',
      description: 'Downtown Loveland celebration with corn-themed food, live music, and family activities in the Sweetheart City.',
      officialUrl: 'https://www.lovgov.org/community/events-calendar',
    },
    {
      name: 'Valentine Re-mailing Program',
      season: 'Winter',
      typicalMonths: 'February',
      description: 'Loveland\'s famous Valentine card re-mailing tradition — send cards through Loveland for the special postmark.',
      officialUrl: 'https://www.lovgov.org/community/events-calendar',
    },
    {
      name: 'Rhythm on the River',
      season: 'Summer',
      typicalMonths: 'June–August',
      description: 'Free summer concert series along the Loveland Recreation Trail and lake areas.',
      officialUrl: 'https://www.lovgov.org/community/events-calendar',
    },
  ],
  windsor: [
    {
      name: 'Windsor Harvest Festival',
      season: 'Fall',
      typicalMonths: 'September',
      description: 'Parade, carnival, live music, and community celebration — Windsor\'s signature annual event.',
      officialUrl: 'https://www.windsorgov.com/',
    },
    {
      name: 'Windsor Lake Activities',
      season: 'Summer',
      typicalMonths: 'May–September',
      description: 'Paddleboarding, concerts, and outdoor recreation at Windsor Lake — a hub for families and active residents.',
      officialUrl: 'https://www.windsorgov.com/',
    },
  ],
  greeley: [
    {
      name: 'Greeley Stampede',
      season: 'Summer',
      typicalMonths: 'June–July',
      description: 'Colorado\'s legendary rodeo and entertainment festival at Island Grove Regional Park — concerts, PRCA rodeo, and carnival.',
      officialUrl: 'https://www.greeleystampede.org/',
    },
    {
      name: 'Greeley Arts Picnic',
      season: 'Summer',
      typicalMonths: 'July',
      description: 'Lincoln Park fills with artists, food vendors, and live performances in downtown Greeley.',
      officialUrl: 'https://www.greeleygov.com/',
    },
    {
      name: 'Friday Fest',
      season: 'Summer',
      typicalMonths: 'June–August',
      description: 'Downtown Greeley street festival with food, music, and local vendors on summer Fridays.',
      officialUrl: 'https://www.greeleygov.com/',
    },
    {
      name: 'UNC Campus Events',
      season: 'Year-round',
      typicalMonths: 'Varies',
      description: 'University of Northern Colorado brings concerts, athletics, and cultural events to the Greeley community.',
      officialUrl: 'https://www.unco.edu/',
    },
  ],
  longmont: [
    {
      name: 'Longmont Farmers Market',
      season: 'Summer',
      typicalMonths: 'April–November',
      description: 'One of Colorado\'s largest and longest-running farmers markets — Saturday mornings at the Boulder County Fairgrounds.',
      officialUrl: 'https://www.longmontcolorado.gov/',
    },
    {
      name: 'Rhythm on the River',
      season: 'Summer',
      typicalMonths: 'June–August',
      description: 'Free concerts and community gatherings along the St. Vrain River in Longmont.',
      officialUrl: 'https://www.longmontcolorado.gov/',
    },
    {
      name: 'Longmont Oktoberfest',
      season: 'Fall',
      typicalMonths: 'September',
      description: 'Downtown celebration with beer, food, and live music in Roosevelt Park.',
      officialUrl: 'https://www.longmontcolorado.gov/',
    },
  ],
  boulder: [
    {
      name: 'Boulder Creek Festival',
      season: 'Summer',
      typicalMonths: 'May',
      description: 'Memorial Day weekend festival along Boulder Creek with vendors, performers, and the famous rubber duck race.',
      officialUrl: 'https://bouldercolorado.gov/',
    },
    {
      name: 'Colorado Shakespeare Festival',
      season: 'Summer',
      typicalMonths: 'June–August',
      description: 'Professional theatre under the stars on the CU Boulder campus.',
      officialUrl: 'https://www.colorado.edu/',
    },
    {
      name: 'Boulder Farmers Market',
      season: 'Year-round',
      typicalMonths: 'April–November',
      description: 'Downtown and other locations — local food, artisans, and a Boulder County institution.',
      officialUrl: 'https://boulderfarmers.org/',
    },
  ],
  timnath: [
    {
      name: 'Timnath Community Events',
      season: 'Summer',
      typicalMonths: 'June–August',
      description: 'Concerts, holiday celebrations, and town gatherings at the Timnath Community Park and town center.',
      officialUrl: 'https://timnath.org/',
    },
  ],
  wellington: [
    {
      name: 'Wellington Fall Harvest Festival',
      season: 'Fall',
      typicalMonths: 'September',
      description: 'Small-town parade, vendors, and family activities celebrating Wellington\'s agricultural roots.',
      officialUrl: 'https://www.wellingtoncolorado.gov/',
    },
  ],
  johnstown: [
    {
      name: 'Johnstown BBQ Day',
      season: 'Summer',
      typicalMonths: 'June',
      description: 'Community barbecue, live music, and town celebration — a Johnstown tradition.',
      officialUrl: 'https://www.johnstown.org/',
    },
  ],
  berthoud: [
    {
      name: 'Berthoud Day',
      season: 'Summer',
      typicalMonths: 'June',
      description: 'Parade, carnival, and community festival celebrating Berthoud\'s small-town character.',
      officialUrl: 'https://www.berthoud.org/',
    },
  ],
  firestone: [
    {
      name: 'Carbon Valley Community Events',
      season: 'Summer',
      typicalMonths: 'June–August',
      description: 'Concerts, holiday events, and town celebrations in Firestone and the Carbon Valley corridor.',
      officialUrl: 'https://www.firestoneco.gov/',
    },
  ],
  frederick: [
    {
      name: 'Frederick Community Celebrations',
      season: 'Summer',
      typicalMonths: 'July',
      description: 'Fourth of July festivities, concerts in the park, and town events in Frederick.',
      officialUrl: 'https://www.frederickco.gov/',
    },
  ],
  severance: [
    {
      name: 'Severance Town Events',
      season: 'Summer',
      typicalMonths: 'June–August',
      description: 'Growing town hosts seasonal concerts, holiday events, and community gatherings.',
      officialUrl: 'https://www.severance.org/',
    },
  ],
  evans: [
    {
      name: 'Evans Community Events',
      season: 'Summer',
      typicalMonths: 'Varies',
      description: 'Seasonal town celebrations and access to Greeley Stampede and Weld County events nearby.',
      officialUrl: 'https://www.evanscolorado.gov/',
    },
  ],
  eaton: [
    {
      name: 'Eaton Days',
      season: 'Summer',
      typicalMonths: 'July',
      description: 'Parade, rodeo, and community festival — Eaton\'s signature annual celebration.',
      officialUrl: 'https://www.eatoncolorado.gov/',
    },
  ],
  milliken: [
    {
      name: 'Milliken Community Events',
      season: 'Summer',
      typicalMonths: 'July',
      description: 'Town celebrations and Weld County fair season access for Milliken residents.',
      officialUrl: 'https://www.milliken.org/',
    },
  ],
  'la-salle': [
    {
      name: 'La Salle Community Gatherings',
      season: 'Summer',
      typicalMonths: 'Varies',
      description: 'Small-town events and easy access to Greeley Stampede and Weld County activities.',
      officialUrl: 'https://www.lasallecolorado.gov/',
    },
  ],
  mead: [
    {
      name: 'Mead Community Events',
      season: 'Summer',
      typicalMonths: 'Varies',
      description: 'Town holiday events and proximity to Longmont and Weld County festivals.',
      officialUrl: 'https://www.townofmead.org/',
    },
  ],
  niwot: [
    {
      name: 'Niwot Jazz Festival',
      season: 'Summer',
      typicalMonths: 'August',
      description: 'Historic Niwot hosts jazz performances, art, and downtown celebration.',
      officialUrl: 'https://www.niwot.com/',
    },
    {
      name: 'Niwot Farmers Market',
      season: 'Summer',
      typicalMonths: 'May–October',
      description: 'Sunday market in downtown Niwot — local food and artisans in Boulder County.',
      officialUrl: 'https://www.niwot.com/',
    },
  ],
};

/** Nearby cities whose events are relevant for cross-promotion */
const nearbyEventsMap = {
  evans: ['greeley'],
  'la-salle': ['greeley'],
  milliken: ['greeley'],
  mead: ['longmont'],
  niwot: ['boulder', 'longmont'],
  severance: ['windsor', 'fort-collins'],
  timnath: ['fort-collins', 'windsor'],
  wellington: ['fort-collins'],
  johnstown: ['loveland', 'milliken'],
  firestone: ['longmont'],
  frederick: ['firestone', 'longmont'],
  berthoud: ['loveland'],
  eaton: ['greeley'],
};

/**
 * @param {string} slug - area slug
 * @param {{ max?: number; includeRegional?: boolean }} [options]
 * @returns {LocalEvent[]}
 */
export function getCityEvents(slug, options = {}) {
  const { max = 6, includeRegional = true } = options;
  const primary = cityEvents[slug] || [];
  const nearbySlugs = nearbyEventsMap[slug] || [];
  const nearby = nearbySlugs.flatMap((s) => cityEvents[s] || []).slice(0, 2);
  const regional = includeRegional && primary.length < 3
    ? regionalEvents.slice(0, 2)
    : [];

  const seen = new Set();
  const combined = [...primary, ...nearby, ...regional].filter((event) => {
    if (seen.has(event.name)) return false;
    seen.add(event.name);
    return true;
  });

  return combined.slice(0, max);
}

export function hasCityEvents(slug) {
  return getCityEvents(slug, { max: 1 }).length > 0;
}

export function getEventsGuidePath() {
  return `/blog/${LATEST_EVENTS_GUIDE_SLUG}/`;
}
