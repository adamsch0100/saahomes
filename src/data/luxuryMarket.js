/**
 * Luxury market data for Northern Colorado — sourced only from verified
 * codebase figures (areaSeo.js, areaFaqs.js, blogPosts.js, neighborhoods.js).
 * Never invent medians, sales comps, or inventory counts.
 *
 * Data notes (as of mid/July 2026 content in repo):
 * - City medians: areaSeo.js + areaFaqs.js
 * - Luxury price tiers: blogPosts luxury-home-buying-guide-northern-colorado
 * - Neighborhood price ranges: neighborhoods.js priceRangeDescription
 * - DOM for premium bands: areaSeo / areaFaqs city market blurbs
 */

/** Page-level $1M+ framing. City thresholds below this stay as published — we do not invent a $1M city median. */
export const MILLION_PLUS_PRICE = 1_000_000;
export const MILLION_PLUS_LABEL = '$1 Million+';
export const MILLION_PLUS_DISPLAY = '$1M+';

/** Featured $1M+ markets on the luxury hub (4 cities max). */
export const MILLION_PLUS_FEATURED_SLUGS = ['boulder', 'fort-collins', 'windsor', 'loveland'];

/**
 * Verified $1M+ NoCO listing photos (IRES, served via /api/photo/{id}/{idx}).
 * Checked live 2026-08-12. Each id is assigned to one page slot — never reuse.
 * 3278 (Longmont $22.5M) returned 502 on every photo index that day — do not use.
 */
export const LUXURY_PHOTO_SLOTS = {
  hero: {
    id: 4777,
    photoIdx: 0,
    slug: '6880-saint-vrain-longmont-co-18500000-061671',
    city: 'Longmont',
    listPrice: 18500000,
    street_number: '6880',
    street_name: 'Saint Vrain',
  },
  boulder: {
    id: 4199,
    photoIdx: 0,
    slug: '1750-sunset-boulder-co-16500000-059258',
    city: 'Boulder',
    listPrice: 16500000,
    street_number: '1750',
    street_name: 'Sunset',
  },
  'fort-collins': {
    id: 15408,
    photoIdx: 0,
    slug: '6558-rookery-fort-collins-co-4450000-064114',
    city: 'Fort Collins',
    listPrice: 4450000,
    street_number: '6558',
    street_name: 'Rookery',
  },
  windsor: {
    id: 34127,
    photoIdx: 0,
    slug: '1813-seashell-windsor-co-2900000-065128',
    city: 'Windsor',
    listPrice: 2900000,
    street_number: '1813',
    street_name: 'Seashell',
  },
  loveland: {
    id: 13206,
    photoIdx: 0,
    slug: '1270-57th-loveland-co-4000000-062758',
    city: 'Loveland',
    listPrice: 4000000,
    street_number: '1270',
    street_name: '57th',
  },
};

/** Distinct $1M+ homes for the gallery when live search is thin. Never overlap photo slots. */
export const LUXURY_GALLERY_FALLBACKS = [
  {
    id: 4998,
    slug: '3621-21st-boulder-co-12000000-051395',
    city: 'Boulder',
    list_price: 12000000,
    street_number: '3621',
    street_name: '21st',
    beds: 4,
  },
  {
    id: 18373,
    slug: '918-cub-fort-collins-co-4190000-059088',
    city: 'Fort Collins',
    list_price: 4190000,
    street_number: '918',
    street_name: 'Cub',
    beds: 7,
  },
  {
    id: 90206,
    slug: '1907-spring-bloom-windsor-co-1999999-062406',
    city: 'Windsor',
    list_price: 1999999,
    street_number: '1907',
    street_name: 'Spring Bloom',
    beds: 5,
  },
  {
    id: 14514,
    slug: '3941-roaring-fork-loveland-co-3995000-063581',
    city: 'Loveland',
    list_price: 3995000,
    street_number: '3941',
    street_name: 'Roaring Fork',
    beds: 6,
  },
  {
    id: 32992,
    slug: '513-59th-greeley-co-3990000-064238',
    city: 'Greeley',
    list_price: 3990000,
    street_number: '513',
    street_name: '59th',
    beds: 6,
  },
  {
    id: 31824,
    slug: '3922-ridgeline-timnath-co-2125000-056274',
    city: 'Timnath',
    list_price: 2125000,
    street_number: '3922',
    street_name: 'Ridgeline',
    beds: 4,
  },
];

export function luxuryPhotoSrc(slotKey) {
  const row = LUXURY_PHOTO_SLOTS[slotKey];
  if (!row) return '';
  return `/api/photo/${row.id}/${row.photoIdx || 0}`;
}

export function slotToListing(slot) {
  if (!slot) return null;
  return {
    id: slot.id,
    slug: slot.slug,
    city: slot.city,
    list_price: slot.listPrice ?? slot.list_price,
    street_number: slot.street_number,
    street_name: slot.street_name,
    beds: slot.beds,
  };
}

/** Luxury price thresholds by city (blog luxury guide + area FAQs). */
export const LUXURY_THRESHOLDS = {
  boulder: {
    label: '$900K–$2M+',
    threshold: 900000,
    thresholdDisplay: '$900K+',
    note: 'Boulder single-family homes typically range from $900,000 to well over $2 million (area FAQs). Many Flatirons, Mapleton Hill, and Chautauqua properties list well above $2M.',
    millionPlus: true,
    tier: '$1M+',
    millionPlusReality:
      'True luxury in Boulder sits $2M and above — Flatirons, Mapleton Hill, Chautauqua, Pine Brook Hills. Single-family typically ranges $900K to well over $2M; $1M+ is the working floor, not the ceiling.',
  },
  'fort-collins': {
    label: '$750K+',
    threshold: 750000,
    thresholdDisplay: '$750K+',
    note: 'Fort Collins luxury segment generally begins at approximately $750,000 for single-family homes and extends past $2 million for estate properties (luxury home buying guide).',
    millionPlus: true,
    tier: '$1M+',
    millionPlusReality:
      'Citywide median is about $610K (July 2026). $1M+ concentrates in Horsetooth and northwest estates, the Foothills ($800K–$3M+), and Prospector’s Ridge ($900K–$2.5M+). Homes above $750K typically 55–70 days on market.',
  },
  loveland: {
    label: '$600K+',
    threshold: 600000,
    thresholdDisplay: '$600K+',
    note: 'Loveland luxury tier starts around $600,000, with lakefront and golf-course properties commanding the highest prices (luxury home buying guide). Homes above $675,000 average about 55 days on market (area FAQs).',
    millionPlus: true,
    tier: '$1M+',
    millionPlusReality:
      'Citywide median is about $510K (July 2026). $1M+ is lakefront and golf — Centerra to $1.5M+, Lake Loveland, Eagle Crest. The broader published luxury tier starts around $600K; homes above $675K average about 55 days on market.',
  },
  windsor: {
    label: '$700K+',
    threshold: 700000,
    thresholdDisplay: '$700K+',
    note: 'Windsor luxury threshold is approximately $700,000-plus, driven by Pelican Lakes, Water Valley, and RainDance premium inventory (luxury home buying guide + Windsor market FAQs). Properties above $750,000 routinely take 65+ days on market.',
    millionPlus: true,
    tier: '$1M+',
    millionPlusReality:
      'Highest citywide median among major NoCO cities (~$588K, July 2026). $1M+ concentrates in Water Valley lakefront, Pelican Lakes, and RainDance custom homes. Properties above $750K routinely take 65+ days on market.',
  },
  greeley: {
    label: '$550K+',
    threshold: 550000,
    thresholdDisplay: '$550K+',
    note: 'Greeley luxury territory starts around $550,000–$600,000, where buyers can expect more square footage and land than comparably priced Larimer County homes (luxury home buying guide).',
    millionPlus: true,
    tier: '$1M+',
    millionPlusReality:
      'Citywide median is about $432K (July 2026). The published luxury tier starts around $550K–$600K; $1M+ is acreage and custom — Pine Ridge Estates to $1.2M+ and west Greeley executive homes.',
  },
  timnath: {
    label: '$700K+',
    threshold: 700000,
    thresholdDisplay: '$700K+',
    note: 'Timnath premium inventory is concentrated in communities like Bridle Ridge ($700K–$1.5M+) and Timnath Ranch executive homes ($550K–$1.2M+) per neighborhoods.js price ranges.',
    millionPlus: true,
    tier: '$1M+',
    millionPlusReality:
      'No static citywide median is published. $1M+ lives in Bridle Ridge ($700K–$1.5M+) and Timnath Ranch executive homes ($550K–$1.2M+). Pricing on the Timnath area page reflects the current market.',
  },
};

/**
 * Overall market context — citywide medians (NOT luxury medians).
 * Always label these as citywide medians so we never imply a luxury average.
 */
export const CITY_MARKET_CONTEXT = {
  boulder: {
    city: 'Boulder',
    slug: 'boulder',
    county: 'Boulder County',
    medianDisplay: '$900K–$2M+',
    medianSource: 'areaFaqs (typical single-family range; Boulder is the region’s premium market)',
    premiumDom: 'Varies widely — thin inventory and $2M+ estates often take longer',
    image: '/api/photo/4199/0',
    shortDesc:
      'Highest-end inventory in the region: Flatirons estates, Mapleton Hill, Chautauqua, Wonderland Lake, and Pine Brook Hills. Many properties list well above $2M.',
    millionPlusReality:
      'True luxury sits $2M+. $1M+ is the working floor across Chautauqua, Mapleton Hill, Flatirons, and Pine Brook Hills.',
  },
  'fort-collins': {
    city: 'Fort Collins',
    slug: 'fort-collins',
    county: 'Larimer County',
    medianDisplay: '~$610K–$636K',
    medianSource: 'areaSeo.js (July 2026 median ~$610K SFH) / areaFaqs (~$636K average mid-2026)',
    premiumDom: 'Homes above $750K typically 55–70 days on market (areaSeo)',
    image: '/api/photo/15408/0',
    shortDesc:
      'Widest luxury range in Northern Colorado: Horsetooth / northwest estates, Old Town historic prestige, and executive golf-course homes.',
    millionPlusReality:
      'Citywide median ~$610K. $1M+ concentrates in Horsetooth, northwest estates, Foothills, and Prospector’s Ridge.',
  },
  loveland: {
    city: 'Loveland',
    slug: 'loveland',
    county: 'Larimer County',
    medianDisplay: '~$510K',
    medianSource: 'areaSeo.js / areaFaqs (July 2026 median sale ~$510K, +3.6% YoY)',
    premiumDom: 'Homes above $675K average ~55 days on market (areaFaqs)',
    image: '/api/photo/13206/0',
    shortDesc:
      'Lakefront and golf-course luxury: Lake Loveland, Centerra, Mariana Butte, and Eagle Crest executive homes.',
    millionPlusReality:
      'Citywide median ~$510K. $1M+ is lakefront and golf — Centerra, Lake Loveland, Eagle Crest.',
  },
  windsor: {
    city: 'Windsor',
    slug: 'windsor',
    county: 'Weld / Larimer',
    medianDisplay: '~$588K',
    medianSource: 'areaSeo.js / areaFaqs (July 2026 median sale ~$588K — highest among major NoCO cities)',
    premiumDom: 'Properties above $750K routinely 65+ days on market (areaFaqs)',
    image: '/api/photo/34127/0',
    shortDesc:
      'Premier master-planned luxury: Water Valley lakefront, Pelican Lakes golf, and RainDance corridor custom homes.',
    millionPlusReality:
      'Highest major-city median (~$588K). $1M+ concentrates in Water Valley, Pelican Lakes, and RainDance custom.',
  },
  greeley: {
    city: 'Greeley',
    slug: 'greeley',
    county: 'Weld County',
    medianDisplay: '~$432K',
    medianSource: 'areaSeo.js (July 2026 median sale ~$432K)',
    premiumDom: 'Luxury acreage inventory moves slower than the $350K–$500K sweet spot',
    image: '/api/photo/32992/0',
    shortDesc:
      'Best value per square foot in the luxury band: Pine Ridge Estates, west Greeley acreage, and executive custom homes.',
    millionPlusReality:
      'Citywide median ~$432K. $1M+ is acreage and custom — Pine Ridge Estates and west Greeley executive homes.',
  },
  timnath: {
    city: 'Timnath',
    slug: 'timnath',
    county: 'Larimer County',
    medianDisplay: 'See current market stats',
    medianSource: 'Live listing stats on Timnath area page (no static luxury median fabricated)',
    premiumDom: 'New-build luxury and Bridle Ridge custom homes — timelines vary by product',
    image: '/api/photo/31824/0',
    shortDesc:
      'New-construction luxury corridor: Bridle Ridge, Timnath Ranch executive homes, and lakeside communities near I-25.',
    millionPlusReality:
      'No static citywide median published. $1M+ lives in Bridle Ridge and Timnath Ranch executive homes.',
  },
};

/**
 * Curated luxury neighborhood slugs per city (must exist in neighborhoods.js).
 * priceHint is the neighborhoods.js priceRangeDescription for that slug.
 */
export const LUXURY_NEIGHBORHOOD_SLUGS = {
  boulder: [
    { slug: 'boulder-chautauqua', name: 'Chautauqua Park', priceHint: '$1.2M to $4M+' },
    { slug: 'mapleton-hill-boulder', name: 'Mapleton Hill', priceHint: '$1.2M to $4M+' },
    { slug: 'wonderland-lake', name: 'Wonderland Lake Area', priceHint: '$800K to $2.5M+' },
    { slug: 'pine-brook-hills', name: 'Pine Brook Hills', priceHint: '$1.5M to $5M+' },
    { slug: 'boulder-flatirons', name: 'Flatirons Area', priceHint: '$2M to $6M+' },
    { slug: 'newlands', name: 'Newlands', priceHint: '$1.2M to $3.5M+' },
    { slug: 'table-mesa', name: 'Table Mesa', priceHint: '$1M to $2.5M+' },
    { slug: 'devils-thumb-boulder', name: "Devil's Thumb", priceHint: '$1M to $3M+' },
  ],
  'fort-collins': [
    { slug: 'northwest-fort-collins', name: 'Northwest Fort Collins', priceHint: '$600K (patio homes) to $2M+ (estate properties)' },
    { slug: 'horsetooth-west', name: 'Horsetooth / West Fort Collins', priceHint: '$500K to $2M+' },
    { slug: 'foothills-fc', name: 'Foothills Area', priceHint: '$800K to $3M+' },
    { slug: 'prospectors-ridge', name: "Prospector's Ridge", priceHint: '$900K to $2.5M+' },
    { slug: 'red-fox-hills', name: 'Red Fox Hills', priceHint: '$700K to $2M+' },
    { slug: 'old-town', name: 'Old Town', priceHint: '$350K (condos) to $1.5M+ (single-family)' },
    { slug: 'collindale-fc', name: 'Collindale', priceHint: '$550K to $1.2M+' },
    { slug: 'stuart-place', name: 'Stuart Place', priceHint: '$600K to $1.5M+' },
  ],
  loveland: [
    { slug: 'centerra', name: 'Centerra / Southwest Loveland', priceHint: '$425K (townhomes) to $1.5M+ (lakefront)' },
    { slug: 'lake-loveland', name: 'Lake Loveland Area', priceHint: '$350K to $1.2M+' },
    { slug: 'eagle-crest-loveland', name: 'Eagle Crest', priceHint: '$550K to $1.5M+' },
    { slug: 'mariana-butte', name: 'Mariana Butte', priceHint: '$400K to $900K+' },
    { slug: 'west-loveland', name: 'West Loveland / Foothills', priceHint: '$400K to $1M+' },
    { slug: 'airpark-loveland', name: 'Loveland Airpark', priceHint: '$500K to $1.2M+' },
  ],
  windsor: [
    { slug: 'water-valley', name: 'Water Valley', priceHint: '$400K (townhomes) to $1.2M+ (lakefront)' },
    { slug: 'pelican-lakes', name: 'Pelican Lakes', priceHint: '$500K to $1.5M+' },
    { slug: 'windsor-lake-estates', name: 'Windsor Lake Estates', priceHint: '$550K to $1.2M+' },
    { slug: 'reserve-windsor', name: 'The Reserve at Windsor', priceHint: '$550K to $1M+' },
    { slug: 'raindance', name: 'RainDance', priceHint: '$400K (townhomes) to $750K+ (single-family)' },
  ],
  greeley: [
    { slug: 'pine-ridge-estates', name: 'Pine Ridge Estates', priceHint: '$600K to $1.2M+' },
    { slug: 'glenmere', name: 'Glenmere', priceHint: '$275K (fixer) to $700K+ (restored historic)' },
    { slug: 'westwood-greeley', name: 'Westwood', priceHint: '$375K to $600K' },
    { slug: 'tamarac-greeley', name: 'Tamarac', priceHint: '$375K to $650K' },
  ],
  timnath: [
    { slug: 'bridle-ridge-timnath', name: 'Bridle Ridge at Timnath', priceHint: '$700K to $1.5M+' },
    { slug: 'timnath-ranch', name: 'Timnath Ranch', priceHint: '$550K to $1.2M+' },
    { slug: 'timnath-lakeside', name: 'Timnath Lakeside', priceHint: '$550K to $1M+' },
    { slug: 'fields-at-timnath', name: 'The Fields at Timnath', priceHint: '$550K to $900K+' },
  ],
};

/** Buyer personas for the luxury hub (mirror proven structure; SAA copy). */
export const LUXURY_BUYER_PERSONAS = [
  {
    title: 'Trading up from metro Denver',
    description:
      'Principals leaving Cherry Creek, Highlands, or Boulder County congestion who want more land, mountain views, and a quieter rhythm — without conceding finishes or school options. Northern Colorado often delivers more square footage and outdoor access at a lower entry than comparable Denver-metro luxury.',
  },
  {
    title: 'Confidential relocation',
    description:
      'Executives relocating for CSU, UCHealth, aerospace, or fully remote roles. They want privacy, a home that works as a compound, and a search that never becomes a broadcast. Adam and Mandi handle the file directly.',
  },
  {
    title: 'Selling a significant home',
    description:
      'Owners of $1M+ properties who need the listing priced correctly, shown to the right buyers, and — when desired — kept off the open market. Presentation and who sees it matter more than volume.',
  },
];

/** Private-client promise — editorial, not feature-grid marketing. */
export const LUXURY_CLIENT_PROMISES = [
  {
    title: 'Discretion',
    desc: 'Quiet listings, limited showing lists, and off-market conversations when the property and the seller warrant it. Your name does not become a lead.',
  },
  {
    title: 'Market mastery',
    desc: 'Verified $1M+ comps, neighborhood-level depth, and honest pricing. We do not invent a luxury median or dress a $600K market as a $2M one.',
  },
  {
    title: 'White-glove execution',
    desc: 'Inspection teams, vendors, timing, and the small details that keep a seven-figure file moving. You are not managing the process. We are.',
  },
  {
    title: 'Direct access',
    desc: 'Adam and Mandi Schwartz. One call. No teams of bots, no junior handoff after the first meeting. (970) 999-1407.',
  },
];

/**
 * Hub FAQs written for the $1M+ buyer and seller.
 * Answers use only verified codebase figures; when a precise $1M median
 * is not published, we say so honestly.
 */
export const LUXURY_HUB_FAQS = [
  {
    q: 'What’s actually happening in the $1M+ Northern Colorado market right now?',
    a: 'The $1M+ tier is a distinct market from citywide medians. Fort Collins citywide median single-family sat near $610,000 in July 2026 (averages near $636,000 mid-2026); Loveland about $510,000; Windsor about $588,000 — the highest among major NoCO cities; Greeley about $432,000. Boulder single-family typically ranges $900,000 to well over $2 million. We do not publish a fabricated “$1M median.” What we can say: homes above $750,000 in Fort Collins typically take 55–70 days on market; Windsor properties above $750,000 routinely take 65+ days; Loveland homes above $675,000 average about 55 days. Our Fort Collins luxury neighborhoods guide notes homes above $1 million often 90–120 days. Inventory at this level is thin, neighborhood-specific, and priced by comps — not by city averages. Current asking prices on our site always reflect the latest market.',
  },
  {
    q: 'How do you sell a $1M+ home discreetly?',
    a: 'Quietly, and to the right people. A discreet sale can mean a coming-soon period with a short, named buyer list; a pocket or off-market conversation through our local network; or a public listing with no open houses, no yard sign, and showings by appointment only. We agree the exposure level with you first. Premium presentation still matters — professional photography, measured pricing, and a file that is ready — but the audience is curated. Email and phone are required on every inquiry so we can confirm identity before we discuss a property.',
  },
  {
    q: 'Do you have access to off-market properties?',
    a: 'Yes, where they exist. Off-market and quiet listings in this corridor come through relationships with other agents, sellers who prefer not to go fully public, and coming-soon inventory we hear about before it hits the market. We do not pretend every $1M+ home is hidden, and we will not invent an off-market catalog. What we do is work both the current listings and the private network, then show you only what fits. Call (970) 999-1407 if you want that search run confidentially.',
  },
  {
    q: 'How is a $1M+ property priced correctly?',
    a: 'With neighborhood comps — not a Zestimate, not a citywide median, and not last year’s peak. Overpricing is how $1M+ listings go stale. In a band already taking 55–70 days above $750,000 (and often 90–120 days above $1 million in Fort Collins), an inflated ask is not a negotiating cushion; it is how a significant home becomes shopworn. We price against recent, relevant sales in the same micro-location — Horsetooth is not Old Town; Water Valley is not RainDance — and we adjust when the market tells us to.',
  },
  {
    q: 'What sets Schwartz and Associates apart at this level?',
    a: 'Adam and Mandi Schwartz work the file themselves. Over 20 years in Northern Colorado, Coldwell Banker Realty affiliation, and neighborhood depth across Boulder, Fort Collins, Loveland, Windsor, Greeley, Timnath, and the 19-city corridor we publish. We do not farm $1M+ clients to a team or an ISA. You get market command, discretion, and a single point of contact. Call (970) 999-1407.',
  },
  {
    q: 'Should I work with a specialist or a generalist agent?',
    a: 'A $1M+ home is not a $450,000 listing with a nicer kitchen. The buyer pool is smaller, the comps are thinner, days on market are longer, and a pricing miss is expensive. A generalist who sells volume in the $400K–$600K band will treat your property like inventory. A specialist prices against the right sales, knows which neighborhoods actually clear at $1M+, and has a network that can see a quiet listing. That is the work we do. If your home is not in this tier, we will say so — we would rather send you to the right representation than dress a mid-market sale as luxury.',
  },
  {
    q: 'How does the buying process differ at $1M+?',
    a: 'Pace and certainty, not theatrics. Inspections are more thorough (systems, roofs, wells, septic, acreage, historic fabric). Contingencies are negotiated with more precision; some sellers want a shorter option period, some will not accept a home-sale contingency. Appraisals on unique properties can lag the contract price — we plan for that instead of discovering it at week five. Because premium bands often sit 55–120 days on market, you usually have time to underwrite the house properly. When the right property appears off-market, the opposite is true: you need to be ready to move. We keep both postures available.',
  },
  {
    q: 'Where can I see current $1M+ listings in Northern Colorado?',
    a: 'On this page — current $1M+ inventory — and through our full search, which filters at $1,000,000. Each city card links to that city’s premium homes and to individual listings on the market. Pricing shown reflects each home’s current asking price and changes as the market moves. Ask Nadia on this page if you would like a private short list pulled for a specific city or neighborhood.',
  },
];

/** Per-city luxury FAQ snippets to append to areaFaqs. */
export const CITY_LUXURY_FAQS = {
  boulder: [
    {
      q: 'What defines luxury homes in Boulder, CO?',
      a: 'Boulder is Northern Colorado’s highest-end market. Single-family homes typically range from $900,000 to well over $2 million. Premier pockets include Chautauqua Park ($1.2M–$4M+), Mapleton Hill ($1.2M–$4M+), Wonderland Lake ($800K–$2.5M+), Pine Brook Hills ($1.5M–$5M+), and Flatirons-area estates ($2M–$6M+) per our neighborhood guides. Luxury here often means Flatirons views, open-space adjacency, historic character, or contemporary mountain architecture. Explore our luxury real estate hub or search live Boulder listings with SAA Homes.',
    },
    {
      q: 'How much do luxury homes cost in Boulder compared to Fort Collins?',
      a: 'Boulder commands a substantial premium. Boulder single-family homes often start near $900K and frequently exceed $2M, while Fort Collins citywide medians sit near $610K–$636K with a luxury tier generally from about $750K. Many buyers who want Front Range lifestyle without Boulder pricing look at Fort Collins northwest estates, Windsor Water Valley / Pelican Lakes, or Loveland lakefront — we help compare total cost of ownership across counties.',
    },
  ],
  'fort-collins': [
    {
      q: 'What are the best luxury neighborhoods in Fort Collins?',
      a: 'Premier Fort Collins luxury areas include Northwest / Horsetooth foothills estates ($600K–$2M+ and $500K–$2M+ ranges in our neighborhood guides), Foothills Area ($800K–$3M+), Prospector’s Ridge ($900K–$2.5M+), Red Fox Hills ($700K–$2M+), Old Town historic single-family up to $1.5M+, Collindale golf-course homes ($550K–$1.2M+), and Stuart Place custom homes ($600K–$1.5M+). Citywide, luxury generally begins around $750K. See our Fort Collins luxury neighborhoods blog and the Northern Colorado luxury hub for deeper guidance.',
    },
    {
      q: 'How long do luxury homes take to sell in Fort Collins?',
      a: 'Homes above $750,000 in Fort Collins typically take about 55–70 days on market (area market notes, summer 2026), longer than well-priced homes in the $500K–$650K band. Pricing strategy, presentation, and off-market networking matter more in this tier. SAA Homes provides premium marketing and a confidential consultation for luxury sellers — call (970) 999-1407.',
    },
  ],
  loveland: [
    {
      q: 'Where can I find luxury homes in Loveland, CO?',
      a: 'Loveland luxury focuses on lakefront and executive communities: Centerra / southwest Loveland (up to $1.5M+ lakefront), Lake Loveland Area (to $1.2M+), Eagle Crest ($550K–$1.5M+), Mariana Butte near the golf course ($400K–$900K+), West Loveland / foothills (to $1M+), and Loveland Airpark ($500K–$1.2M+). Regional luxury guidance places Loveland’s premium tier around $600K+. Homes above $675K average about 55 days on market. Browse our luxury hub or live Loveland listings filtered at the premium band.',
    },
  ],
  windsor: [
    {
      q: 'What are the luxury neighborhoods in Windsor, CO?',
      a: 'Windsor’s luxury concentration is among the strongest in Northern Colorado: Water Valley lakefront (to $1.2M+), Pelican Lakes ($500K–$1.5M+), Windsor Lake Estates ($550K–$1.2M+), The Reserve at Windsor ($550K–$1M+), and RainDance premium single-family (to $750K+). Citywide median was about $588,000 in July 2026 — highest among major NoCO cities — with properties above $750K often taking 65+ days. Our luxury real estate page covers private search and concierge service for these communities.',
    },
  ],
  greeley: [
    {
      q: 'Are there luxury homes in Greeley, CO?',
      a: 'Yes. Greeley’s luxury segment offers strong value: Pine Ridge Estates ($600K–$1.2M+), restored historic Glenmere properties (to $700K+), and west Greeley custom / acreage homes. Luxury guidance places Greeley premium roughly from $550K–$600K, often with more land and square footage than similar budgets in Fort Collins or Windsor. Citywide median was about $432,000 in July 2026. Contact SAA Homes for a discreet search of executive and acreage inventory.',
    },
  ],
  timnath: [
    {
      q: 'What luxury options exist in Timnath, CO?',
      a: 'Timnath’s premium inventory includes Bridle Ridge at Timnath ($700K–$1.5M+), Timnath Ranch executive homes ($550K–$1.2M+), Timnath Lakeside ($550K–$1M+), and The Fields at Timnath ($550K–$900K+). The town’s new-construction corridor near I-25 appeals to buyers wanting modern finishes and Fort Collins proximity. See current pricing on our Timnath guide and the Northern Colorado luxury hub for private consultation options.',
    },
  ],
};

export function luxurySearchHref(cityName, minPrice) {
  const params = new URLSearchParams();
  if (cityName) params.set('location', `${cityName}, CO`);
  if (minPrice) params.set('minPrice', String(minPrice));
  return `/properties/?${params.toString()}`;
}

export function millionPlusSearchHref(cityName) {
  return luxurySearchHref(cityName, MILLION_PLUS_PRICE);
}

export function getLuxuryNeighborhoods(citySlug) {
  return LUXURY_NEIGHBORHOOD_SLUGS[citySlug] || [];
}

/** Neighborhoods whose published range reaches $1M+ (from priceHint, never invented). */
export function isMillionPlusNeighborhood(n) {
  return /\$1(\.\d+)?M|\$[2-9](\.\d+)?M/.test(n?.priceHint || '');
}

export function getMillionPlusNeighborhoods(citySlug) {
  return getLuxuryNeighborhoods(citySlug).filter(isMillionPlusNeighborhood);
}

export function getFeaturedMillionPlusCities() {
  return MILLION_PLUS_FEATURED_SLUGS.map((slug) => ({
    slug,
    context: CITY_MARKET_CONTEXT[slug],
    threshold: LUXURY_THRESHOLDS[slug],
  })).filter((row) => row.context && row.threshold);
}
