/**
 * Curated Northern Colorado events — flagship annual happenings only.
 * Hermes updates via local-events-curation skill (monthly check, quarterly refresh).
 * Last reviewed: 2026-08-01 — verified against official city/visitor sources.
 * Research pass 2026-08-01: 36 events verified from official gov/visitor sites.
 * Unverified flags (kept from research): Loveland city calendar 403-blocked
 * (Rhythm on the River, Art in the Park unconfirmed), Firestone/Frederick/Evans/
 * Severance events not yet confirmed, Windsor Harvest Festival no 2026 page.
 */

export const LATEST_EVENTS_GUIDE_SLUG = 'northern-colorado-events-guide-2026';
export const EVENTS_DATA_LAST_REVIEWED = '2026-08-01';

/** @typedef {{ name: string; season: string; description: string; officialUrl?: string; typicalMonths?: string; dates?: string }} LocalEvent */

/** @type {LocalEvent[]} */
export const regionalEvents = [
  {
    name: 'Larimer County Fair & PRCA Rodeo',
    season: 'Summer',
    typicalMonths: 'August',
    dates: 'Jul 31 – Aug 4, 2026',
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
      name: 'First Friday Art Walk',
      season: 'Year-round',
      typicalMonths: 'January–December',
      description: 'Monthly self-guided art walk through Downtown Fort Collins galleries, studios and shops on the first Friday of each month.',
      officialUrl: 'https://www.downtownfortcollins.com/first-friday',
    },
    {
      name: 'FoCo Food Truck Rally',
      season: 'Summer',
      typicalMonths: 'May–September',
      description: 'City of Fort Collins weekly food truck gathering in City Park — recurring 2026 season (May 12 – Sept 16).',
      officialUrl: 'https://www.visitftcollins.com/event/foco-food-truck-rally/41399/',
    },
    {
      name: 'Larimer County Farmers\' Market',
      season: 'Spring–Fall',
      typicalMonths: 'May–November',
      description: 'Weekly farmers market downtown Fort Collins — confirmed 2026 season May 16 – Nov 1.',
      officialUrl: 'https://www.visitftcollins.com/event/larimer-county-farmers-market/40472/',
    },
    {
      name: 'Poudre RiverFest',
      season: 'Summer',
      typicalMonths: 'August',
      dates: 'Aug 8–9, 2026',
      description: 'Annual river celebration hosted at New Belgium Brewing with live music, community booths and Poudre River activities.',
      officialUrl: 'https://www.visitftcollins.com/event/poudre-riverfest/41251/',
    },
    {
      name: 'Fort Collins Foodie Walk',
      season: 'Summer',
      typicalMonths: 'July–August',
      dates: 'Aug 21, 2026',
      description: 'Downtown Fort Collins tasting walk sampling bites from local restaurants.',
      officialUrl: 'https://www.visitftcollins.com/event/fort-collins-foodie-walk-%e2%84%a2/17064/',
    },
    {
      name: 'Taste of Fort Collins',
      season: 'Fall',
      typicalMonths: 'September',
      dates: 'Sept 26–27, 2026',
      description: 'Music and food festival at Washington Park with national headliners, food and business vendors.',
      officialUrl: 'https://www.tasteoffortcollins.com/',
    },
    {
      name: 'Tour de Fat',
      season: 'Summer',
      typicalMonths: 'August',
      dates: 'Aug 29–30, 2026',
      description: 'New Belgium Brewing\'s bike festival and fundraiser with costumed bike parade, music and local nonprofits.',
      officialUrl: 'https://www.visitftcollins.com/event/tour-de-fat/40660/',
    },
    {
      name: 'Bohemian Nights at NewWestFest',
      season: 'Summer',
      typicalMonths: 'August',
      description: 'Free downtown festival with national and local acts, local vendors, and Old Town Fort Collins at its liveliest.',
      officialUrl: 'https://www.visitftcollins.com/events/',
    },
  ],
  loveland: [
    {
      name: 'Sculpture in the Park Show and Sale',
      season: 'Summer',
      typicalMonths: 'August',
      dates: 'Aug 7–9, 2026',
      description: '42nd annual juried outdoor sculpture show and sale at Benson Sculpture Garden — one of the largest in the country.',
      officialUrl: 'https://www.sculptureinthepark.org/',
    },
    {
      name: 'Old Fashioned Corn Roast Festival',
      season: 'Summer',
      typicalMonths: 'August',
      dates: 'Aug 21–22, 2026',
      description: '130th annual community festival with parade, corn roast, food vendors and live entertainment in downtown Loveland.',
      officialUrl: 'https://loveland.org/events-2/corn-roast-festival/',
    },
    {
      name: 'Valentine Re-mailing Program',
      season: 'Winter',
      typicalMonths: 'February',
      description: 'Send a Valentine postmarked from Loveland, the Sweetheart City. 2026 deadlines: Feb 2 (international), Feb 4 (US), Feb 9 (Colorado).',
      officialUrl: 'https://loveland.org/programs/valentine-re-mailing-program/',
    },
  ],
  windsor: [
    {
      name: 'Summer Concert Series',
      season: 'Summer',
      typicalMonths: 'June–August',
      description: 'Free Thursday evening concerts at Boardwalk Community Park featuring local bands and national acts — 2026 season on the town calendar.',
      officialUrl: 'https://www.windsorco.gov/calendar.aspx?CID=32',
    },
    {
      name: 'Movies in the Park',
      season: 'Summer',
      typicalMonths: 'June–August',
      description: 'Free family movies at dusk in Windsor parks (Boardwalk Community Park), including a National Night Out edition Aug 4.',
      officialUrl: 'https://www.windsorco.gov/calendar.aspx?CID=32',
    },
    {
      name: 'Windsor Farmers Market',
      season: 'Summer',
      typicalMonths: 'June–August',
      description: 'Outdoor market at Boardwalk Community Park with seasonal foods, baked goods, local vendors and live entertainment, including Art LIVE! demos.',
      officialUrl: 'https://www.windsorco.gov/calendar.aspx?CID=32',
    },
    {
      name: 'Windsor Harvest Festival',
      season: 'Fall',
      typicalMonths: 'September',
      description: 'Windsor\'s signature autumn celebration with parade, carnival, live music and community events.',
      officialUrl: 'https://www.windsorgov.com/',
    },
  ],
  greeley: [
    {
      name: 'Greeley Stampede',
      season: 'Summer',
      typicalMonths: 'June–July',
      dates: 'Jun 24 – Jul 5, 2026',
      description: 'Signature summer festival at Island Grove Regional Park: PRCA ProRodeo series, SuperStars concerts, carnival, demolition derby and 4th of July events.',
      officialUrl: 'https://www.greeleystampede.org/p/rodeos1/day-sheets',
    },
    {
      name: 'Greeley Arts Picnic',
      season: 'Summer',
      typicalMonths: 'July',
      dates: 'Jul 25–26, 2026',
      description: '47th annual Arts Picnic weekend in Lincoln Park, Downtown Greeley — artists, musicians, performers, kids\' crafts and more.',
      officialUrl: 'https://greeleygov.com/events/arts-picnic',
    },
    {
      name: 'Greeley Farmers\' Market',
      season: 'Summer',
      typicalMonths: 'May–October',
      description: 'Every Saturday, 8am–12noon, May–October on 7th Street north of Lincoln Park — fresh produce, local growers, handmade crafts.',
      officialUrl: 'https://greeleygov.com/events/farmers-market',
    },
    {
      name: 'Festival of Trees',
      season: 'Winter',
      typicalMonths: 'November–December',
      dates: 'Nov 27 – Dec 5, 2026',
      description: '37th annual winter holiday event with decorated trees at the Union Colony Civic Center.',
      officialUrl: 'https://greeleygov.com/events/festival-of-trees',
    },
  ],
  longmont: [
    {
      name: 'Longmont Farmers Market',
      season: 'Spring–Fall',
      typicalMonths: 'April–November',
      description: 'Weekly Saturday farmers market at the Boulder County Fairgrounds, 9595 Nelson Rd — 2026 market runs May 9 – Nov 21.',
      officialUrl: 'https://longmontcolorado.gov/venue/longmont-farmers-market/',
    },
    {
      name: 'Independence Day Festival at Roosevelt Park',
      season: 'Summer',
      typicalMonths: 'July',
      dates: 'Jul 3–4, 2026',
      description: 'Longmont\'s signature summer music festival transitions in 2026 to a two-day Independence Day festival with live music, food, fireworks and a drone show.',
      officialUrl: 'https://longmontcolorado.gov/news/rhythm-at-roosevelt-to-transition-into-two-day-festival-on-july-3-and-4-2026/',
    },
    {
      name: 'ArtWalk',
      season: 'Multiple seasonal editions',
      typicalMonths: 'Varies',
      description: 'Downtown Longmont gallery art walk promoted by the City of Longmont, with free Callahan House tours during ArtWalk.',
      officialUrl: 'https://longmontcolorado.gov/news/free-callahan-house-tours-during-artwalk/',
    },
  ],
  boulder: [
    {
      name: 'Boulder Creek Festival',
      season: 'Summer',
      typicalMonths: 'May',
      dates: 'May 22–25, 2026',
      description: 'Annual three-day free family festival at Boulder Creek with live music, a marketplace of 150+ Colorado artists, children\'s activities, food and beer tasting.',
      officialUrl: 'https://bouldercolorado.gov/events/boulder-creek-festival',
    },
    {
      name: 'Boulder County Farmers Market',
      season: 'Spring–Fall',
      typicalMonths: 'April–November',
      description: 'Downtown Boulder farmers market on 13th Street — Wednesdays through Oct 7 and Saturdays through Nov 21.',
      officialUrl: 'https://bouldercolorado.gov/news/city-boulder-celebrates-boulder-county-farmers-markets-40th-anniversary',
    },
    {
      name: 'Bands on the Bricks',
      season: 'Summer',
      typicalMonths: 'June–July',
      description: 'Free weekly outdoor concert series on the Pearl Street Mall — Wednesdays, June 10 – July 29.',
      officialUrl: 'https://bouldercolorado.gov/guide/guide-summer-boulder',
    },
    {
      name: 'Colorado Shakespeare Festival',
      season: 'Summer',
      typicalMonths: 'June–August',
      description: 'Professional Shakespeare festival presented by CU Presents at the Mary Rippon Theatre — 2026 season features Twelfth Night, Julius Caesar and Shakespeare in Love.',
      officialUrl: 'https://www.coloradoshakes.org/',
    },
  ],
  timnath: [
    {
      name: 'Timnath 4th of July Celebration',
      season: 'Summer',
      typicalMonths: 'July',
      dates: 'Jul 4, 2026',
      description: 'One of Colorado\'s most spectacular fireworks shows, 6–10pm July 4 at Timnath Reservoir.',
      officialUrl: 'https://timnath.org/community-events/',
    },
    {
      name: 'Ice Cream Social',
      season: 'Summer',
      typicalMonths: 'May',
      dates: 'May 16, 2026',
      description: 'Community ice cream social at Timnath Community Park.',
      officialUrl: 'https://timnath.org/community-events/',
    },
    {
      name: 'Movie Night in the Park',
      season: 'Summer',
      typicalMonths: 'August',
      dates: 'Aug 7, 2026',
      description: 'Outdoor movie at WildWing Park, starting at sundown — Zootopia 2 in 2026.',
      officialUrl: 'https://timnath.org/community-events/',
    },
    {
      name: 'Fall Festival',
      season: 'Fall',
      typicalMonths: 'September',
      dates: 'Sep 26, 2026',
      description: 'Town of Timnath Fall Festival at Timnath Community Park.',
      officialUrl: 'https://timnath.org/community-events/',
    },
    {
      name: 'Holiday Festival',
      season: 'Winter',
      typicalMonths: 'December',
      dates: 'Dec 5, 2026',
      description: 'Annual holiday festival at Timnath Community Park.',
      officialUrl: 'https://timnath.org/community-events/',
    },
  ],
  wellington: [
    {
      name: 'St. Paddy\'s Festival',
      season: 'Spring',
      typicalMonths: 'March',
      dates: 'Mar 14, 2026',
      description: 'Annual St. Patrick\'s Day festival on the town\'s official events calendar.',
      officialUrl: 'https://www.wellingtoncolorado.gov/166/Events',
    },
    {
      name: 'Town Yard Sale',
      season: 'Summer',
      typicalMonths: 'June',
      dates: 'Jun 6, 2026',
      description: 'Annual town-wide yard sale on the official town events calendar.',
      officialUrl: 'https://www.wellingtoncolorado.gov/166/Events',
    },
    {
      name: 'Fourth of July Celebration',
      season: 'Summer',
      typicalMonths: 'July',
      dates: 'Jul 4, 2026',
      description: 'Annual town Fourth of July celebration — one of the town\'s official volunteer-run special events.',
      officialUrl: 'https://www.wellingtoncolorado.gov/166/Events',
    },
    {
      name: 'Trick or Treat on Main Street',
      season: 'Fall',
      typicalMonths: 'October',
      dates: 'Oct 31, 2026',
      description: 'Downtown trick-or-treating on Main Street in support of Main Street Wellington.',
      officialUrl: 'https://www.wellingtoncolorado.gov/166/Events',
    },
    {
      name: 'Wellington Lights: Parade of Lights',
      season: 'Winter',
      typicalMonths: 'December',
      dates: 'Dec 5, 2026',
      description: 'Holiday lights celebration series with Small Business Saturday (Nov 28) and Parade of Lights (December 5).',
      officialUrl: 'https://www.wellingtoncolorado.gov/166/Events',
    },
  ],
  johnstown: [
    {
      name: 'BBQ Day',
      season: 'Summer',
      typicalMonths: 'June',
      dates: 'Jun 6, 2026',
      description: 'Johnstown\'s biggest annual celebration: pancake breakfast, 5K, parade, car show, food, music and fireworks.',
      officialUrl: 'https://www.johnstownco.gov/610/BBQ-Day',
    },
    {
      name: 'Johnstown Jingle Tree Lighting',
      season: 'Winter',
      typicalMonths: 'December',
      description: 'Annual tree lighting ceremony during Johnstown Jingle in downtown Johnstown.',
      officialUrl: 'https://www.johnstownco.gov/381/Johnstown-Jingle-Tree-Lighting',
    },
  ],
  eaton: [
    {
      name: 'Eaton Days',
      season: 'Summer',
      typicalMonths: 'July',
      description: 'Annual full weekend of family fun including a talent show — recurring mid-July event.',
      officialUrl: 'https://www.eatonco.org/',
    },
    {
      name: 'Holiday Splendor at the A.J. Eaton Home',
      season: 'Winter',
      typicalMonths: 'December',
      description: 'Holiday-season event at Eaton\'s historic A.J. Eaton Home and Carriage House Museum.',
      officialUrl: 'https://www.eatonco.org/news',
    },
  ],
  milliken: [
    {
      name: 'Beef \'N Bean Day',
      season: 'Summer',
      typicalMonths: 'August',
      dates: 'Aug 8, 2026',
      description: 'Milliken\'s signature tradition celebrating agricultural heritage since 1923: parade through downtown, food vendors, artisan vendors, DJ glow party and family contests.',
      officialUrl: 'https://www.millikenco.gov/311/Beef-N-Bean-Day',
    },
  ],
  'la-salle': [
    {
      name: 'LaSalle Days',
      season: 'Summer',
      typicalMonths: 'July',
      dates: 'Jul 17–18, 2026',
      description: '45th annual LaSalle Days — "American Heart, Hometown Soul." Parade, vendor booths, horseshoe and cornhole tournaments and Toni\'s Trot.',
      officialUrl: 'https://www.lasalletown.com/2209/LaSalle-Days',
    },
  ],
  mead: [
    {
      name: 'Town-Wide Garage Sale',
      season: 'Spring',
      typicalMonths: 'May',
      description: 'Annual town-wide garage sale — recurring spring event.',
      officialUrl: 'https://www.townofmead.org/',
    },
    {
      name: 'Free Shredding Event',
      season: 'Summer',
      typicalMonths: 'June',
      description: 'Free document shredding event hosted by the Mead Police Department with TBK Bank.',
      officialUrl: 'https://www.townofmead.org/police/page/free-shredding-event-mead-police-and-tbk-bank',
    },
  ],
  berthoud: [
    {
      name: 'The Berthoud Market at Town Park',
      season: 'Summer',
      typicalMonths: 'June–September',
      description: 'Weekly Saturday market with local produce, handmade goods, artisan crafts, live music and kids\' crafts — 9am–1pm, June 13 – Sept 26, 2026.',
      officialUrl: 'https://berthoud.org/1430/The-Berthoud-Market-At-Town-Park',
    },
    {
      name: 'Berthoud Chocolate Walk',
      season: 'Winter',
      typicalMonths: 'February',
      dates: 'Feb 7, 2026',
      description: 'Annual winter stroll through downtown Berthoud receiving chocolate treats from participating merchants.',
      officialUrl: 'https://berthoud.org/calendar.aspx?EID=4258',
    },
    {
      name: 'Berthoud Day',
      season: 'Summer',
      typicalMonths: 'June',
      description: 'Annual town celebration with parade and community events.',
      officialUrl: 'https://berthoud.org/DocumentCenter/View/7765',
    },
  ],
  niwot: [
    {
      name: '2nd Avenue Summer Concert Series',
      season: 'Summer',
      typicalMonths: 'June–August',
      description: 'The House Blend Band and more perform in Niwot\'s 2nd Avenue Summer Concert Series — free outdoor concerts.',
      officialUrl: 'https://niwot.com/',
    },
    {
      name: 'Honeybee Harvest Festival',
      season: 'Fall',
      typicalMonths: 'September',
      description: 'Niwot\'s annual harvest festival with local food, crafts, music and community celebration.',
      officialUrl: 'https://niwot.com/',
    },
    {
      name: 'Holiday Magic',
      season: 'Winter',
      typicalMonths: 'December',
      description: 'Annual holiday celebration in historic downtown Niwot.',
      officialUrl: 'https://niwot.com/',
    },
    {
      name: 'Niwot Market',
      season: 'Summer',
      typicalMonths: 'May–October',
      description: 'Sunday market in downtown Niwot — local food and artisans in Boulder County.',
      officialUrl: 'https://niwot.com/',
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

/**
 * City display names keyed by area slug — mirrors areaSeo.js city names.
 */
const CITY_DISPLAY = {
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
};

export function getCityDisplayName(slug) {
  return CITY_DISPLAY[slug] || slug;
}

const MONTH_ALIASES = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Parse a typicalMonths string like "June–July", "May–October", "August",
 * "June–August", "Varies", "Year-round" into an array of month indexes.
 * Returns [] when the string can't be mapped (Varies/Year-round).
 */
export function parseTypicalMonths(typicalMonths) {
  if (!typicalMonths) return [];
  const normalized = typicalMonths.toLowerCase().replace(/\s+/g, '');
  // "Varies" or "Year-round" → all 12 months (they recur all year)
  if (normalized.includes('varies') || normalized.includes('year-round') || normalized.includes('yearround')) {
    return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  }
  // Split on en-dash / hyphen / slash
  const parts = normalized.split(/[–\-/]/);
  const months = [];
  for (const part of parts) {
    const idx = MONTH_ALIASES[part.replace(/[^a-z]/g, '')];
    if (idx !== undefined) months.push(idx);
  }
  if (months.length === 2 && parts.length === 2) {
    // Range like June–August → all months in between (inclusive)
    const [a, b] = months.sort((x, y) => x - y);
    const range = [];
    for (let i = a; i <= b; i++) range.push(i);
    return range;
  }
  return months;
}

/**
 * Flatten every curated event (city + regional) into a single list with
 * city slug/name and parsed month indexes for filtering.
 */
export function getAllEvents() {
  const all = [];
  for (const [slug, events] of Object.entries(cityEvents)) {
    for (const event of events) {
      all.push({
        ...event,
        citySlug: slug,
        cityName: getCityDisplayName(slug),
        months: parseTypicalMonths(event.typicalMonths),
        isRegional: false,
      });
    }
  }
  for (const event of regionalEvents) {
    all.push({
      ...event,
      citySlug: 'regional',
      cityName: 'Northern Colorado',
      months: parseTypicalMonths(event.typicalMonths),
      isRegional: true,
    });
  }
  return all;
}

export function getMonthNames() {
  return MONTH_NAMES;
}
