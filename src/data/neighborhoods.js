/**
 * Northern Colorado Neighborhood Data
 *
 * Each entry represents a specific neighborhood, subdivision, or district.
 * Fields marked REQUIRED must have values; RECOMMENDED should be populated
 * from verified sources; OPTIONAL shown only when present.
 *
 * ALL data must be accurate — verify via public records, city websites,
 * school district boundaries, and MLS data. No fabricated numbers.
 */

export const neighborhoods = [
  // ═══════════════════════════════════════════════════════════════
  // FORT COLLINS
  // ═══════════════════════════════════════════════════════════════

  // ── Old Town ──
  {
    slug: 'old-town',
    citySlug: 'fort-collins',
    cityDisplay: 'Fort Collins',
    county: 'Larimer County',
    type: 'neighborhood',
    name: 'Old Town',
    alsoKnownAs: ['Downtown Fort Collins', 'Old Town Fort Collins'],
    description:
      'Old Town Fort Collins is the historic heart of the city, centered around a vibrant pedestrian-friendly square with locally owned shops, restaurants, and breweries. Known for its late-1800s Victorian architecture, tree-lined streets, and the iconic Old Town Square, this is one of Northern Colorado\'s most desirable live-work-play neighborhoods.',
    longDescription:
      'Old Town Fort Collins combines historic character with modern urban living. The neighborhood centers on Mountain Avenue and College Avenue, anchored by Old Town Square with its cobblestone walkways and the historic Northern Hotel. Side streets are lined with Victorian and early-1900s homes, many restored and mixed with contemporary infill townhomes and apartments. The Poudre River Trail runs along the northern edge, providing immediate access to miles of paved pathways. Residents enjoy walkability to over 100 restaurants, multiple craft breweries (including the original New Belgium Brewery), boutique shopping, art galleries, and year-round events like the Fort Collins Farmers Market and NewWestFest.',
    homeStyles: ['Victorian', 'Queen Anne', 'Craftsman Bungalow', 'Modern Townhome', 'Contemporary Loft'],
    yearBuiltRange: { min: 1880, max: 2025 },
    priceRangeDescription: '$350K (condos) to $1.5M+ (single-family)',
    schoolDistrict: 'Poudre School District',
    schools: [
      { name: 'Putnam Elementary', type: 'elementary', level: 'K–5', rating: 8 },
      { name: 'Lincoln Middle School', type: 'middle', level: '6–8', rating: 7 },
      { name: 'Fort Collins High School', type: 'high', level: '9–12', rating: 8 },
    ],
    hoaDescription: 'No HOA in most of Old Town; select newer condo buildings have HOA fees',
    features: [
      'Walk Score 92 — "Walker\'s Paradise"',
      '100+ restaurants and cafés within walking distance',
      '10+ craft breweries including New Belgium, Odell, and Jessup Farm',
      'Fort Collins Farmers Market (April–November)',
      'Old Town Square with seasonal events and concerts',
      'Adjacent to Poudre River Trail system',
    ],
    parks: ['Library Park', 'Old Town Square Plaza', 'Poudre River Trail', 'Lee Martinez Park'],
    boundaries: 'Mountain Avenue to Willow Street, Riverside Avenue to Lemay Avenue',
    coordinates: { latitude: '40.5553', longitude: '-105.0844' },
    walkScore: 92,
    metaDescription:
      'Old Town Fort Collins real estate guide — historic Victorians, modern condos, and townhomes for sale in Fort Collins\' most walkable neighborhood. Expert buyer and seller representation from SAA Homes.',
    keywords:
      'Old Town Fort Collins homes, Old Town Fort Collins real estate, downtown Fort Collins condos, historic homes Fort Collins, Old Town Fort Collins HOA, walkable neighborhoods Fort Collins',
    neighborhoodHighlights: [
      { title: 'Walk to everything', description: 'Old Town has a Walk Score of 92 — errands, dining, and entertainment are within walking distance.' },
      { title: 'Historic architecture', description: 'Victorian and Queen Anne homes from the 1880s–1920s, many on the National Register of Historic Places.' },
      { title: 'Brewery epicenter', description: 'Fort Collins is "The Napa Valley of Beer," and Old Town is home to the original New Belgium Brewery and a dozen more.' },
    ],
  },

  // ── Midtown ──
  {
    slug: 'midtown',
    citySlug: 'fort-collins',
    cityDisplay: 'Fort Collins',
    county: 'Larimer County',
    type: 'neighborhood',
    name: 'Midtown',
    alsoKnownAs: ['South College Avenue Corridor', 'Midtown Fort Collins'],
    description:
      'Midtown Fort Collins is the city\'s central commercial and residential corridor stretching south of Old Town along College Avenue. It combines mid-century neighborhoods, newer infill developments, and the primary shopping and dining district outside of downtown. Midtown offers convenient access to everything Fort Collins has to offer.',
    longDescription:
      'Midtown encompasses the area roughly from Drake Road south to Harmony Road, centered on College Avenue (US 287). The neighborhood includes some of Fort Collins\' most established residential areas, with ranch-style homes from the 1950s–1970s alongside newer townhome and apartment developments. The Foothills Mall redevelopment has brought new retail, dining, and a movie theater. Midtown is popular with families due to its central location, access to top-rated schools, and proximity to both Old Town and south Fort Collins employment centers. The Spring Creek Trail runs through Midtown, providing a paved path connecting to the broader trail network.',
    homeStyles: ['Ranch', 'Mid-Century Modern', 'Split-Level', 'Contemporary Townhome', 'Custom Patio Home'],
    yearBuiltRange: { min: 1950, max: 2025 },
    priceRangeDescription: '$350K (townhomes) to $900K (single-family)',
    schoolDistrict: 'Poudre School District',
    schools: [
      { name: 'Olander Elementary', type: 'elementary', level: 'K–5', rating: 8 },
      { name: 'Blevins Middle School', type: 'middle', level: '6–8', rating: 7 },
      { name: 'Rocky Mountain High School', type: 'high', level: '9–12', rating: 9 },
    ],
    hoaDescription: 'Varies by subdivision; many neighborhoods have voluntary or mandatory HOAs ($50–$200/month)',
    features: [
      'Central location between Old Town and South Fort Collins',
      'Foothills Mall — shopping, dining, movie theater',
      'Spring Creek Trail access for biking and walking',
      'Proximity to Colorado State University (2–3 miles)',
      'Multiple grocery stores and services along College Avenue',
      'Diverse housing stock from 1950s ranches to new construction',
    ],
    parks: ['Spring Creek Park', 'Rolland Moore Park', 'Edora Pool and Ice Center'],
    boundaries: 'Prospect Road to Harmony Road, Taft Hill Road to Lemay Avenue',
    coordinates: { latitude: '40.5450', longitude: '-105.0740' },
    walkScore: 58,
    metaDescription:
      'Midtown Fort Collins real estate guide — centrally located homes near shopping, dining, and top-rated schools. Ranch-style homes, townhomes, and new construction from SAA Homes.',
    keywords:
      'Midtown Fort Collins real estate, Midtown Fort Collins homes for sale, South College Avenue Fort Collins, Fort Collins Midtown living, central Fort Collins neighborhoods',
    neighborhoodHighlights: [
      { title: 'Central location', description: 'Minutes from Old Town, CSU, and Harmony Road — the most convenient commute in Fort Collins.' },
      { title: 'Diverse housing', description: '1950s ranches, mid-century homes, and new infill townhomes at varied price points.' },
      { title: 'Top-rated schools', description: 'Rocky Mountain High School (rated 9/10) and Olander Elementary serve most of Midtown.' },
    ],
  },

  // ── South Fort Collins ──
  {
    slug: 'south-fort-collins',
    citySlug: 'fort-collins',
    cityDisplay: 'Fort Collins',
    county: 'Larimer County',
    type: 'neighborhood',
    name: 'South Fort Collins',
    alsoKnownAs: ['SE Fort Collins', 'Harmony Corridor', 'South Fort Collins'],
    description:
      'South Fort Collins is the city\'s fastest-growing area, featuring master-planned communities, new construction homes, excellent schools, and convenient access to Harmony Road\'s shopping corridor. This area extends from Harmony Road south to the Loveland border.',
    longDescription:
      'South Fort Collins has experienced the most residential development in the city over the past decade, with master-planned communities like Ridgewood Hills, Collindale, and the new developments along Trilby Road. Harmony Road serves as the primary commercial corridor, lined with major retailers, restaurants, and medical facilities. The area is particularly popular with families due to top-rated schools, newer housing stock, and proximity to the Harmony Technology Park employment hub. The Fossil Creek Trail provides connectivity to the citywide trail system.',
    homeStyles: ['Contemporary', 'Farmhouse Modern', 'Ranch', 'Two-Story Traditional', 'Patio Home', 'Townhome'],
    yearBuiltRange: { min: 1990, max: 2025 },
    priceRangeDescription: '$400K (townhomes) to $1.2M+ (executive homes)',
    schoolDistrict: 'Poudre School District',
    schools: [
      { name: 'Ridgeview Elementary', type: 'elementary', level: 'K–5', rating: 9 },
      { name: 'Preston Middle School', type: 'middle', level: '6–8', rating: 8 },
      { name: 'Fossil Ridge High School', type: 'high', level: '9–12', rating: 9 },
    ],
    hoaDescription: 'Most subdivisions have mandatory HOAs ($100–$300/month); many include landscaping, snow removal, and community pool',
    features: [
      'Newer housing stock — most built 2000–present',
      'Highly rated Fossil Ridge High School (9/10)',
      'Harmony Road shopping corridor with major retailers',
      'Proximity to Harmony Technology Park employers',
      'Fossil Creek Trail access',
      'Family-friendly parks and community pools',
    ],
    parks: ['Fossil Creek Park', 'Ridgeview Park', 'Spring Canyon Park & Community Center'],
    boundaries: 'Harmony Road to Larimer County Road, Taft Hill Road to Lemay Avenue',
    coordinates: { latitude: '40.5170', longitude: '-105.0740' },
    walkScore: 35,
    metaDescription:
      'South Fort Collins real estate guide — new construction homes, master-planned communities, and excellent schools near Fossil Ridge High. Expert local agents from SAA Homes.',
    keywords:
      'South Fort Collins homes, South Fort Collins new construction, Fossil Creek Fort Collins, Ridgewood Hills Fort Collins, Harmony Road Fort Collins real estate, SE Fort Collins subdivisions',
    neighborhoodHighlights: [
      { title: 'Top schools', description: 'Fossil Ridge High School (9/10) and Ridgeview Elementary (9/10) make this a magnet for families.' },
      { title: 'New construction', description: 'Most homes built after 2000 — modern floor plans, energy-efficient construction, and contemporary finishes.' },
      { title: 'Employment hub', description: 'Minutes from Harmony Technology Park and major employers like Broadcom, Woodward, and Otter Products.' },
    ],
  },

  // ── Northwest Fort Collins ──
  {
    slug: 'northwest-fort-collins',
    citySlug: 'fort-collins',
    cityDisplay: 'Fort Collins',
    county: 'Larimer County',
    type: 'neighborhood',
    name: 'Northwest Fort Collins',
    alsoKnownAs: ['NW Fort Collins', 'West Fort Collins', 'Horsetooth area'],
    description:
      'Northwest Fort Collins offers some of the city\'s most desirable executive neighborhoods with mountain views, larger lots, and immediate access to Horsetooth Reservoir and the foothills. This area stretches from Taft Hill Road west to the foothills and from Horsetooth Road north to Michaud Lane.',
    longDescription:
      'Northwest Fort Collins is prized for its scenic location along the foothills, with many homes offering panoramic views of Horsetooth Rock and the Front Range. The area features large custom homes on generous lots, established golf course communities, and several newer luxury subdivisions. Horsetooth Reservoir and Lory State Park are minutes away, providing world-class outdoor recreation. The area is quieter and less dense than other parts of Fort Collins, appealing to buyers seeking space, privacy, and natural beauty while still being 10–15 minutes from Old Town.',
    homeStyles: ['Custom Executive', 'Ranch', 'Mountain Contemporary', 'Craftsman', 'Spanish Revival'],
    yearBuiltRange: { min: 1980, max: 2025 },
    priceRangeDescription: '$600K (patio homes) to $2M+ (estate properties)',
    schoolDistrict: 'Poudre School District',
    schools: [
      { name: 'Bailey Elementary', type: 'elementary', level: 'K–5', rating: 9 },
      { name: 'Webber Middle School', type: 'middle', level: '6–8', rating: 8 },
      { name: 'Poudre High School', type: 'high', level: '9–12', rating: 8 },
    ],
    hoaDescription: 'Many subdivisions have mandatory HOAs ($100–$400/month); some custom-home areas have no HOA',
    features: [
      'Mountain views and foothills access',
      'Close to Horsetooth Reservoir and Lory State Park',
      'Larger lots — many 0.5–2 acres',
      'Established golf course communities',
      'Quiet, low-traffic streets',
      '10–15 minutes to Old Town and CSU',
    ],
    parks: ['Horsetooth Mountain Open Space', 'Lory State Park', 'Grandview Cemetery Open Space'],
    boundaries: 'Taft Hill Road to Centennial Drive, Horsetooth Road to Michaud Lane',
    coordinates: { latitude: '40.5650', longitude: '-105.1200' },
    walkScore: 25,
    metaDescription:
      'Northwest Fort Collins executive homes with mountain views — custom estates, golf course properties, and Horsetooth-area luxury real estate. SAA Homes — your local experts.',
    keywords:
      'Northwest Fort Collins homes, NW Fort Collins luxury real estate, Horsetooth Reservoir homes, Fort Collins executive homes, custom homes Fort Collins, mountain view homes Fort Collins',
    neighborhoodHighlights: [
      { title: 'Mountain lifestyle', description: 'Minutes from Horsetooth Reservoir, Lory State Park, and miles of hiking and biking trails at your doorstep.' },
      { title: 'Executive homes', description: 'Custom-built homes on 0.5–2 acre lots with premium finishes, many with mountain and city views.' },
      { title: 'Top schools', description: 'Bailey Elementary (9/10) and Webber Middle School serve Northwest Fort Collins families.' },
    ],
  },

  // ── University / CSU Area ──
  {
    slug: 'university-area',
    citySlug: 'fort-collins',
    cityDisplay: 'Fort Collins',
    county: 'Larimer County',
    type: 'neighborhood',
    name: 'University Area / CSU',
    alsoKnownAs: ['CSU campus area', 'University Park', 'College Hill'],
    description:
      'Surrounding Colorado State University\'s main campus, this area is a mix of historic homes, student housing, and investment properties. It offers the most affordable entry point into Fort Collins real estate and is in high demand for rental income.',
    longDescription:
      'The University Area encompasses the neighborhoods immediately surrounding the CSU main campus, roughly bounded by Prospect Road, Lemay Avenue, Elizabeth Street, and Shields Street. The area is dominated by older homes — many converted to duplexes or triplexes — along with newer student apartment complexes and pockets of well-preserved single-family neighborhoods like University Park. Properties in this area offer strong rental demand due to CSU\'s 33,000+ student enrollment, making it a popular area for investment buyers. Recent years have seen significant redevelopment with modern student housing complexes replacing older homes. The area is walkable to campus, Old Town, and the CSU Transit Center.',
    homeStyles: ['Victorian', 'Craftsman', 'Mid-Century', 'Multi-Unit', 'Student Housing Complex', 'Modern Apartment'],
    yearBuiltRange: { min: 1900, max: 2025 },
    priceRangeDescription: '$325K (condos) to $850K (single-family duplex)',
    schoolDistrict: 'Poudre School District',
    schools: [
      { name: 'Putnam Elementary', type: 'elementary', level: 'K–5', rating: 8 },
      { name: 'Lincoln Middle School', type: 'middle', level: '6–8', rating: 7 },
      { name: 'Poudre High School', type: 'high', level: '9–12', rating: 8 },
    ],
    hoaDescription: 'No HOA in most single-family areas; newer apartment/condo complexes have HOAs',
    features: [
      'Walkable to CSU campus and Old Town',
      'Strong rental demand — 33,000+ CSU students',
      'Mix of single-family and multi-unit properties',
      'CSU Transit Center with bus connections citywide',
      'Proximity to CSU athletic facilities and events',
      'Active redevelopment with modern student housing',
    ],
    parks: ['CSU Oval', 'City Park', 'Spring Creek Trail'],
    boundaries: 'Prospect Road to Elizabeth Street, Shields Street to Lemay Avenue',
    coordinates: { latitude: '40.5750', longitude: '-105.0740' },
    walkScore: 65,
    metaDescription:
      'CSU area Fort Collins real estate — investment properties, student housing, and historic homes near Colorado State University. Buy, sell, or invest with SAA Homes.',
    keywords:
      'CSU area real estate, Fort Collins student housing, University Park Fort Collins, CSU rental property, investment properties Fort Collins, Colorado State University homes',
    neighborhoodHighlights: [
      { title: 'Investment opportunity', description: '33,000+ CSU students create year-round rental demand. Duplexes and triplexes offer strong ROI.' },
      { title: 'Walk to campus', description: 'Walk or bike to CSU in under 10 minutes from most properties in the University Area.' },
      { title: 'Historic charm', description: 'Tree-lined streets with Victorian and Craftsman homes — some of Fort Collins\' oldest architecture.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // LOVELAND
  // ═══════════════════════════════════════════════════════════════

  // ── Downtown Loveland ──
  {
    slug: 'downtown-loveland',
    citySlug: 'loveland',
    cityDisplay: 'Loveland',
    county: 'Larimer County',
    type: 'neighborhood',
    name: 'Downtown Loveland',
    alsoKnownAs: ['Historic Downtown Loveland', 'Loveland Downtown District'],
    description:
      'Downtown Loveland is the cultural and commercial heart of the "Gateway to the Rockies," featuring a vibrant arts scene, locally owned businesses, and a mix of historic and modern homes. Fourth Street and Cleveland Avenue anchor a walkable downtown with galleries, restaurants, and the iconic Chapungu Sculpture Park.',
    longDescription:
      'Downtown Loveland has undergone a renaissance, emerging as a thriving arts and dining destination. Fourth Street is lined with galleries, boutiques, and restaurants, while the nearby Loveland Museum and the Rialto Theater provide cultural attractions. The downtown residential area features bungalows and Victorians from the early 1900s, mixed with newer townhome developments and loft-style condos in converted historic buildings. The Thompson River runs along the southern edge, and the Loveland Recreation Trail connects downtown to parks and Lake Loveland. The annual Sculpture in the Park event and Art in the Park draw visitors from across the region.',
    homeStyles: ['Bungalow', 'Victorian', 'Craftsman', 'Townhome', 'Loft Condo', 'New Urbanist'],
    yearBuiltRange: { min: 1900, max: 2025 },
    priceRangeDescription: '$300K (condos) to $1M+ (single-family)',
    schoolDistrict: 'Thompson School District',
    schools: [
      { name: 'Lincoln Elementary', type: 'elementary', level: 'K–5', rating: 7 },
      { name: 'Bill Reed Middle School', type: 'middle', level: '6–8', rating: 7 },
      { name: 'Loveland High School', type: 'high', level: '9–12', rating: 7 },
    ],
    hoaDescription: 'No HOA in most of downtown; select new developments and condo buildings have HOAs',
    features: [
      'Walkable arts district with galleries and studios',
      'Fourth Street dining and shopping',
      'Chapungu Sculpture Park — 82 stone sculptures on display',
      'Rialto Theater and Loveland Museum',
      'Loveland Recreation Trail access',
      'Seasonal events: Sculpture in the Park, Corn Roast Festival',
    ],
    parks: ['Fairgrounds Park', 'North Lake Park', 'Loveland Recreation Trail'],
    boundaries: 'Eisenhower Boulevard to First Street, Taft Avenue to Cleveland Avenue',
    coordinates: { latitude: '40.3968', longitude: '-105.0746' },
    walkScore: 78,
    metaDescription:
      'Downtown Loveland real estate guide — historic bungalows, artist lofts, and townhomes in the heart of Loveland\'s vibrant arts district. Expert local agents from SAA Homes.',
    keywords:
      'Downtown Loveland real estate, Downtown Loveland homes, Loveland arts district, Fourth Street Loveland, historic Loveland homes, Loveland bungalows, walkable Loveland neighborhoods',
    neighborhoodHighlights: [
      { title: 'Arts & culture', description: 'Home to Chapungu Sculpture Park, the Loveland Museum, and over a dozen art galleries within walking distance.' },
      { title: 'Walkable lifestyle', description: 'Walk Score of 78 — errands, dining, and entertainment accessible without a car.' },
      { title: 'Historic charm', description: 'Well-preserved early-1900s bungalows and Victorians in a neighborhood setting steps from downtown.' },
    ],
  },

  // ── Centerra / Southwest Loveland ──
  {
    slug: 'centerra',
    citySlug: 'loveland',
    cityDisplay: 'Loveland',
    county: 'Larimer County',
    type: 'neighborhood',
    name: 'Centerra / Southwest Loveland',
    alsoKnownAs: ['Centerra', 'Southwest Loveland', 'The Lakes at Centerra'],
    description:
      'Centerra is Loveland\'s premier master-planned community, combining upscale neighborhoods with the region\'s top shopping destination. This southwest Loveland area offers new homes, lakefront properties, golf course living, and the Promenade Shops — Northern Colorado\'s premier outdoor retail center.',
    longDescription:
      'Centerra is a 3,500-acre master-planned community that has transformed southwest Loveland since the early 2000s. It encompasses upscale residential subdivisions — including The Lakes at Centerra, Mariana Butte Golf Course neighborhood, and High Plains — along with the Promenade Shops at Centerra (Northern Colorado\'s largest open-air lifestyle center), medical facilities, office parks, and hotel districts. The area offers a mix of single-family homes, patio homes, and luxury townhomes, many situated on lakes or golf courses. Centerra\'s location at the crossroads of I-25 and Highway 34 makes it one of the most convenient bases for commuting throughout Northern Colorado.',
    homeStyles: ['Contemporary', 'Farmhouse Modern', 'Ranch', 'Mediterranean', 'Luxury Townhome'],
    yearBuiltRange: { min: 2000, max: 2025 },
    priceRangeDescription: '$425K (townhomes) to $1.5M+ (lakefront)',
    schoolDistrict: 'Thompson School District',
    schools: [
      { name: 'Centennial Elementary', type: 'elementary', level: 'K–5', rating: 8 },
      { name: 'Conrad Ball Middle School', type: 'middle', level: '6–8', rating: 7 },
      { name: 'Mountain View High School', type: 'high', level: '9–12', rating: 8 },
    ],
    hoaDescription: 'Mandatory HOAs in all subdivisions ($150–$400/month); many include lawn care, snow removal, community pool, lake access',
    features: [
      'Master-planned community with lake and golf course homes',
      'Promenade Shops at Centerra — 60+ retailers and restaurants',
      'Mariana Butte Golf Course — public 18-hole course',
      'Medical Center of the Rockies and UCHealth facilities nearby',
      'Convenient I-25/HWY 34 access',
      'Lakes, trails, and community parks throughout',
    ],
    parks: ['Centerra Community Park', 'Mariana Butte Golf Course', 'High Plains Park', 'Lake at Centerra'],
    boundaries: 'I-25 to Denver Avenue, Highway 34 to 43rd Street',
    coordinates: { latitude: '40.4160', longitude: '-105.0040' },
    walkScore: 32,
    metaDescription:
      'Centerra Loveland real estate guide — master-planned lakefront and golf course homes near the Promenade Shops. New construction, patio homes, and luxury properties from SAA Homes.',
    keywords:
      'Centerra Loveland homes, Centerra real estate, Promenade Shops at Centerra, Mariana Butte Loveland, The Lakes at Centerra, Southwest Loveland homes, master-planned community Loveland',
    neighborhoodHighlights: [
      { title: 'Shopping destination', description: 'The Promenade Shops at Centerra features 60+ retailers, restaurants, and entertainment venues.' },
      { title: 'Lake & golf living', description: 'Choose from lakefront homes with private docks, golf course lots at Mariana Butte, or low-maintenance patio homes.' },
      { title: 'I-25 access', description: 'Located at the crossroads of I-25 and HWY 34 — commute to Fort Collins in 15 minutes or Denver in 45.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // WINDSOR
  // ═══════════════════════════════════════════════════════════════

  // ── Water Valley ──
  {
    slug: 'water-valley',
    citySlug: 'windsor',
    cityDisplay: 'Windsor',
    county: 'Weld County',
    type: 'subdivision',
    name: 'Water Valley',
    alsoKnownAs: ['Water Valley Windsor', 'Water Valley Community'],
    description:
      'Water Valley is Windsor\'s premier master-planned community, centered around a 100-acre recreational lake with beaches, walking trails, and a private swim club. This amenity-rich neighborhood offers new homes, lakefront properties, and an active lifestyle community.',
    longDescription:
      'Water Valley is a 320-acre master-planned community built around Windsor Lake, offering residents a rare lakefront lifestyle in Northern Colorado. The community features a private beach, swim club, catch-and-release fishing, walking trails, community gardens, and year-round events. The neighborhood is divided into distinct villages, each with its own architectural guidelines and HOA. Home styles range from low-maintenance patio homes and townhomes to executive lakefront estates. Water Valley\'s location near the Windsor/Greeley border provides easy access to both cities\' amenities while maintaining a peaceful, resort-like atmosphere.',
    homeStyles: ['Contemporary', 'Mediterranean', 'Farmhouse', 'Ranch', 'Patio Home', 'Townhome'],
    yearBuiltRange: { min: 2008, max: 2025 },
    priceRangeDescription: '$400K (townhomes) to $1.2M+ (lakefront)',
    schoolDistrict: 'Windsor School District RE-4',
    schools: [
      { name: 'Grand View Elementary', type: 'elementary', level: 'K–5', rating: 8 },
      { name: 'Windsor Middle School', type: 'middle', level: '6–8', rating: 7 },
      { name: 'Windsor High School', type: 'high', level: '9–12', rating: 8 },
    ],
    hoaDescription: 'Mandatory HOA ($175–$275/month) covers lake access, beach, trails, swim club, common area maintenance',
    features: [
      '100-acre private lake with beach and swim club',
      'Walking trails and community gardens',
      'Catch-and-release fishing',
      'Year-round community events',
      'Private lake access for residents only',
      'Close to downtown Windsor and Eastman Park',
    ],
    parks: ['Water Valley Beach & Swim Club', 'Windsor Lake', 'Eastman Park'],
    boundaries: 'Crossroads Boulevard to Eastman Park Drive, Weld County Road 74 to 76',
    coordinates: { latitude: '40.4710', longitude: '-104.8850' },
    walkScore: 25,
    metaDescription:
      'Water Valley Windsor real estate guide — lakefront and lake-community homes in Windsor\'s premier master-planned community. Beach, swim club, trails, and new construction from SAA Homes.',
    keywords:
      'Water Valley Windsor, Water Valley real estate, Windsor lake homes, Windsor master-planned community, lakefront Windsor Colorado, Water Valley HOA, Windsor new construction',
    neighborhoodHighlights: [
      { title: 'Lake lifestyle', description: '100-acre private lake with sandy beach, swim club, fishing, and walking trails — resort living every day.' },
      { title: 'Community amenities', description: 'Homeowners enjoy access to a private beach, community garden, pavilion, and year-round events.' },
      { title: 'New construction', description: 'Active new-home construction by multiple builders — choose your floor plan and finishes.' },
    ],
  },

  // ── RainDance ──
  {
    slug: 'raindance',
    citySlug: 'windsor',
    cityDisplay: 'Windsor',
    county: 'Weld County',
    type: 'subdivision',
    name: 'RainDance',
    alsoKnownAs: ['RainDance Windsor', 'RainDance Community'],
    description:
      'RainDance is one of Windsor\'s most exciting new communities, featuring Northern Colorado\'s first indoor surf park and a planned resort-style amenity center. This growing master-planned community offers new homes with future plans for retail, dining, and entertainment.',
    longDescription:
      'RainDance is a large-scale master-planned community on Windsor\'s east side that is redefining suburban living in Northern Colorado. The centerpiece of the community is the planned RainDance Surf Park — an indoor surf facility that will be the first of its kind in the region. The community also plans a resort-style amenity center with pools, fitness facilities, and event spaces. Current home construction includes single-family homes, townhomes, and patio homes from multiple builders. As the community grows, plans include retail village centers, restaurants, office space, and additional parks.',
    homeStyles: ['Contemporary', 'Farmhouse', 'Ranch', 'Townhome', 'Patio Home'],
    yearBuiltRange: { min: 2020, max: 2025 },
    priceRangeDescription: '$375K (townhomes) to $700K+ (single-family)',
    schoolDistrict: 'Windsor School District RE-4',
    schools: [
      { name: 'Mountain View Elementary', type: 'elementary', level: 'K–5', rating: 'New school' },
      { name: 'Windsor Middle School', type: 'middle', level: '6–8', rating: 7 },
      { name: 'Windsor High School', type: 'high', level: '9–12', rating: 8 },
    ],
    hoaDescription: 'Mandatory HOA ($120–$200/month) covers amenity center, parks, common areas',
    features: [
      'Planned indoor surf park — first in Northern Colorado',
      'Resort-style amenity center with pools and fitness',
      'New construction with multiple builders',
      'Future retail and dining village',
      'Community parks and trail system',
      'Adjacent to Windsor Lake and Eastman Park',
    ],
    parks: ['RainDance Community Park', 'Eastman Park', 'Windsor Lake Recreation Area'],
    boundaries: 'East of Weld County Road 17, north of Crossroads Boulevard',
    coordinates: { latitude: '40.4820', longitude: '-104.8720' },
    walkScore: 10,
    metaDescription:
      'RainDance Windsor real estate — new construction homes in Windsor\'s master-planned community with Northern Colorado\'s first indoor surf park. Explore floor plans and pricing from SAA Homes.',
    keywords:
      'RainDance Windsor, RainDance community, Windsor new construction, RainDance surf park, new homes Windsor Colorado, master-planned community Windsor CO',
    neighborhoodHighlights: [
      { title: 'Surf park centerpiece', description: 'RainDance will feature Northern Colorado\'s first indoor surf park — a game-changing amenity for the region.' },
      { title: 'Master-planned living', description: 'Future plans include retail, dining, and entertainment — walkable from your front door.' },
      { title: 'New construction', description: 'Active building with multiple homebuilders offering single-family, townhome, and patio home options.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // GREELEY
  // ═══════════════════════════════════════════════════════════════

  // ── West Greeley ──
  {
    slug: 'west-greeley',
    citySlug: 'greeley',
    cityDisplay: 'Greeley',
    county: 'Weld County',
    type: 'neighborhood',
    name: 'West Greeley',
    alsoKnownAs: ['West Greeley neighborhoods', 'Greeley west side'],
    description:
      'West Greeley is the city\'s most desirable residential area, featuring newer subdivisions, top-rated schools, and convenient access to shopping along 47th Avenue. The area has seen significant growth and offers a range of housing options from entry-level to executive.',
    longDescription:
      'West Greeley has emerged as the premier residential corridor in Greeley, stretching from 47th Avenue west toward Windsor. The area features master-planned communities like Westridge and Buckstone Ranch alongside established subdivisions with mature landscaping. West Greeley is home to the city\'s best schools, including the highly regarded University Schools (K–12), and Denver-based commuters appreciate the proximity to Highway 34 for the drive to Denver. The 47th Avenue shopping corridor provides access to major retailers, grocery stores, and dining. The Poudre River Trail system extends into West Greeley, connecting residents to the broader regional trail network.',
    homeStyles: ['Contemporary', 'Ranch', 'Two-Story Traditional', 'Patio Home', 'Townhome'],
    yearBuiltRange: { min: 1995, max: 2025 },
    priceRangeDescription: '$300K (townhomes) to $800K+ (executive homes)',
    schoolDistrict: 'Greeley-Evans School District 6',
    schools: [
      { name: 'West Ridge Elementary', type: 'elementary', level: 'K–5', rating: 8 },
      { name: 'Heath Middle School', type: 'middle', level: '6–8', rating: 7 },
      { name: 'University Schools (K–12)', type: 'charter', level: 'K–12', rating: 9 },
    ],
    hoaDescription: 'Most subdivisions have mandatory HOAs ($75–$200/month)',
    features: [
      'Newer subdivisions with modern floor plans',
      'Close to 47th Avenue shopping corridor',
      'University Schools — top-rated K–12 charter',
      'Highway 34 access for Denver commute',
      'Poudre River Trail connectivity',
      'Variety of price points from starter to executive',
    ],
    parks: ['Sanborn Park', 'Bittersweet Park', 'Poudre River Trail'],
    boundaries: '47th Avenue to 65th Avenue, US 34 to O Street',
    coordinates: { latitude: '40.4230', longitude: '-104.7650' },
    walkScore: 30,
    metaDescription:
      'West Greeley real estate guide — new homes, top-rated schools, and master-planned communities in Greeley\'s most desirable corridor. Expert buyer and seller agents from SAA Homes.',
    keywords:
      'West Greeley homes, West Greeley new construction, Greeley west side real estate, Westridge Greeley, Buckstone Ranch, University Schools Greeley, 47th Avenue Greeley',
    neighborhoodHighlights: [
      { title: 'Top schools', description: 'University Schools (9/10 K–12 charter), West Ridge Elementary, and close to UNC make this a family magnet.' },
      { title: 'Newer housing', description: 'Most homes built after 1995 with modern open floor plans and energy-efficient features.' },
      { title: 'Denver access', description: 'Convenient Highway 34 commute — downtown Denver in under an hour, Denver airport in 50 minutes.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // TIMNATH
  // ═══════════════════════════════════════════════════════════════
  {
    slug: 'timnath-ranch',
    citySlug: 'timnath',
    type: 'subdivision',
    name: 'Timnath Ranch',
    county: 'Larimer County',
    alsoKnownAs: ['Timnath Ranch Community', 'Timnath Ranch HOA'],
    description:
      'Timnath Ranch is a master-planned community in the heart of Timnath, offering new construction homes on larger lots with mountain views. The neighborhood features a mix of estate homes, ranch-style residences, and planned community amenities.',
    homeStyles: ['Contemporary Farmhouse', 'Ranch', 'Two-Story Traditional', 'Estate Home'],
    yearBuiltRange: { min: 2015, max: 2025 },
    priceRangeDescription: '$550K to $1.2M+',
    schoolDistrict: 'Poudre School District',
    schools: [
      { name: 'Timnath Elementary', type: 'elementary', level: 'K–5', rating: 9 },
      { name: 'Preston Middle School', type: 'middle', level: '6–8', rating: 8 },
      { name: 'Fossil Ridge High School', type: 'high', level: '9–12', rating: 9 },
    ],
    hoaDescription: 'Mandatory HOA ($150–$250/month) covers common areas, landscaping, snow removal',
    features: ['Newer homes with mountain views', 'Larger lots — many 0.25–0.5 acres', 'Close to I-25 for Denver commute', 'Top-rated Fossil Ridge schools', 'Minutes to Windsor and Fort Collins', 'Quiet, rural feel with city amenities nearby'],
    parks: ['Timnath Community Park', 'Timnath Reservoir', 'Poudre River Trail'],
    boundaries: 'I-25 to Larimer County Road 5, Harmony Road to Timnath Road',
    coordinates: { latitude: '40.5300', longitude: '-104.9700' },
    metaDescription: 'Timnath Ranch homes for sale in Timnath, CO — new construction, mountain views, larger lots, top-rated Fossil Ridge schools. Expert local agents from SAA Homes.',
    keywords: 'Timnath Ranch real estate, Timnath Colorado homes, Timnath Ranch HOA, new construction Timnath, Fossil Ridge homes, Timnath Ranch subdivision',
    neighborhoodHighlights: [
      { title: 'Mountain views', description: 'Many homes offer panoramic views of Longs Peak and the Front Range from elevated lots.' },
      { title: 'Top schools', description: 'Timnath Elementary (9/10) and Fossil Ridge High School (9/10) serve the community.' },
      { title: 'Rural-feel location', description: 'Larger lots with space between homes while still being minutes from Fort Collins and I-25.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // BERTHOUD
  // ═══════════════════════════════════════════════════════════════
  {
    slug: 'downtown-berthoud',
    citySlug: 'berthoud',
    type: 'neighborhood',
    name: 'Downtown Berthoud',
    county: 'Larimer County',
    alsoKnownAs: ['Historic Berthoud', 'Berthoud Downtown District'],
    description:
      'Downtown Berthoud is the historic heart of this growing Northern Colorado community, centered around Mountain Avenue and Massachusetts Street. The area offers small-town charm with tree-lined streets, early-1900s homes, and a walkable main street with locally owned shops and restaurants.',
    homeStyles: ['Victorian', 'Craftsman Bungalow', 'Mid-Century Ranch', 'Modern Townhome'],
    yearBuiltRange: { min: 1900, max: 2025 },
    priceRangeDescription: '$350K to $700K',
    schoolDistrict: 'Thompson School District',
    schools: [
      { name: 'Berthoud Elementary', type: 'elementary', level: 'K–5', rating: 7 },
      { name: 'Turner Middle School', type: 'middle', level: '6–8', rating: 7 },
      { name: 'Berthoud High School', type: 'high', level: '9–12', rating: 7 },
    ],
    hoaDescription: 'No HOA in most of downtown; select newer developments may have HOAs',
    features: ['Walkable main street with local dining and shopping', 'Historic homes with character', 'Berthoud Recreation Trail access', 'Close to Carter Lake for boating and fishing', 'Annual Berthoud Day celebration', 'Growing restaurant and brewery scene'],
    parks: ['Fickel Park', 'Berthoud Recreation Trail', 'Carter Lake'],
    boundaries: 'Mountain Avenue to Bunyan Avenue, 1st Street to 8th Street',
    coordinates: { latitude: '40.3083', longitude: '-105.0800' },
    metaDescription: 'Downtown Berthoud real estate guide — historic homes, small-town charm, and walkable main street. Buy or sell with SAA Homes, your Northern Colorado real estate experts.',
    keywords: 'Downtown Berthoud real estate, Berthoud Colorado homes, historic Berthoud, Berthoud main street, Berthoud bungalows, Berthoud walkable neighborhoods',
    neighborhoodHighlights: [
      { title: 'Small-town charm', description: 'Tree-lined streets, historic architecture, and a welcoming main street with local businesses.' },
      { title: 'Growing community', description: 'Berthoud is one of Northern Colorado\'s fastest-growing towns with new amenities arriving regularly.' },
      { title: 'Outdoor access', description: 'Minutes from Carter Lake for boating, fishing, and hiking — and the Berthoud Recreation Trail connects the town.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // SEVERANCE
  // ═══════════════════════════════════════════════════════════════
  {
    slug: 'severance-commons',
    citySlug: 'severance',
    type: 'neighborhood',
    name: 'Severance Commons',
    county: 'Weld County',
    alsoKnownAs: ['Severance Town Center', 'Severance'],
    description:
      'Severance has emerged as one of Northern Colorado\'s fastest-growing communities, with Severance Commons serving as the town\'s central residential and commercial core. New construction homes, an expanding town center, and easy access to Windsor and Greeley make this an attractive option for buyers seeking newer homes at more accessible price points.',
    homeStyles: ['Contemporary', 'Farmhouse Modern', 'Ranch', 'Townhome', 'Patio Home'],
    yearBuiltRange: { min: 2018, max: 2025 },
    priceRangeDescription: '$350K (townhomes) to $650K+ (single-family)',
    schoolDistrict: 'Weld RE-4 School District',
    schools: [
      { name: 'Range View Elementary', type: 'elementary', level: 'K–5', rating: 8 },
      { name: 'Severance Middle School', type: 'middle', level: '6–8', rating: 'New school' },
      { name: 'Severance High School', type: 'high', level: '9–12', rating: 'New school' },
    ],
    hoaDescription: 'Mandatory HOAs in most subdivisions ($75–$175/month)',
    features: ['Newer construction — most homes built after 2018', 'More affordable than Fort Collins and Loveland', 'New Severance High School and Middle School', 'Rapidly expanding retail and dining', 'Close to Windsor Lake and Eastman Park', 'Growing community with new amenities'],
    parks: ['Severance Community Park', 'Hidden Lake Park', 'Eastman Park (Windsor)'],
    boundaries: 'Weld County Road 23 to 27, Highway 392 to County Road 74',
    coordinates: { latitude: '40.5500', longitude: '-104.8550' },
    metaDescription: 'Severance Colorado real estate guide — new construction homes in one of Northern Colorado\'s fastest-growing towns. Affordable pricing, new schools, and expert guidance from SAA Homes.',
    keywords: 'Severance Colorado homes, Severance new construction, Severance Commons, Severance real estate, fastest growing Northern Colorado towns, Severance CO subdivisions',
    neighborhoodHighlights: [
      { title: 'Best value', description: 'Among the most affordable new construction in Northern Colorado — more square footage for your dollar.' },
      { title: 'Brand-new schools', description: 'New Severance High School and Middle School serve the community with modern facilities.' },
      { title: 'Fastest-growing', description: 'Severance is consistently ranked among Colorado\'s fastest-growing towns — new amenities arriving with every phase.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // JOHNSTOWN
  // ═══════════════════════════════════════════════════════════════
  {
    slug: 'johnstown-commons',
    citySlug: 'johnstown',
    type: 'neighborhood',
    name: 'Johnstown Commons',
    county: 'Weld County',
    alsoKnownAs: ['Johnstown Town Center', 'Johnstown'],
    description:
      'Johnstown Commons is the heart of this growing Weld County community, featuring newer subdivisions, a walkable town center with retail and dining, and convenient access to I-25. Johnstown offers a small-town feel with big-city connectivity — located midway between Fort Collins and Denver.',
    homeStyles: ['Contemporary', 'Ranch', 'Two-Story', 'Townhome', 'Patio Home'],
    yearBuiltRange: { min: 2000, max: 2025 },
    priceRangeDescription: '$325K (townhomes) to $700K (single-family)',
    schoolDistrict: 'Weld RE-5J School District',
    schools: [
      { name: 'Johnstown Elementary', type: 'elementary', level: 'K–5', rating: 7 },
      { name: 'Milliken Middle School', type: 'middle', level: '6–8', rating: 6 },
      { name: 'Roosevelt High School', type: 'high', level: '9–12', rating: 7 },
    ],
    hoaDescription: 'Most subdivisions have HOAs ($50–$150/month)',
    features: ['I-25 frontage — easy Denver commute (45 min)', 'Johnstown Town Center with retail and dining', 'Newer housing stock', 'Thompson River recreation access', 'Growing commercial corridor', 'More affordable than Larimer County alternatives'],
    parks: ['Johnstown Community Park', 'Thompson River Recreation Area', 'Boomtown Park'],
    boundaries: 'I-25 to Weld County Road 19, Highway 60 to Highway 119',
    coordinates: { latitude: '40.3450', longitude: '-104.9100' },
    metaDescription: 'Johnstown Colorado real estate guide — affordable homes near I-25, growing town center, and small-town community feel. Expert agents from SAA Homes.',
    keywords: 'Johnstown Colorado homes, Johnstown real estate, Johnstown Commons, Johnstown town center, I-25 homes Colorado, Weld County real estate',
    neighborhoodHighlights: [
      { title: 'I-25 access', description: 'Located right on I-25 — 45 minutes to downtown Denver, 15 minutes to Fort Collins.' },
      { title: 'Affordable entry', description: 'One of Northern Colorado\'s most affordable markets — get more home for your budget.' },
      { title: 'Growing community', description: 'New retail, dining, and parks arriving with every new phase of development.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // WELLINGTON
  // ═══════════════════════════════════════════════════════════════
  {
    slug: 'wellington-commons',
    citySlug: 'wellington',
    type: 'neighborhood',
    name: 'Wellington Commons',
    county: 'Larimer County',
    alsoKnownAs: ['Wellington Town Center', 'Wellington'],
    description:
      'Wellington is a growing community just north of Fort Collins along I-25, offering a small-town atmosphere with convenient access to Larimer County\'s largest city. Wellington Commons represents the town\'s central residential and commercial core, with newer subdivisions and an expanding retail scene.',
    homeStyles: ['Contemporary', 'Ranch', 'Two-Story', 'Townhome', 'Patio Home'],
    yearBuiltRange: { min: 2005, max: 2025 },
    priceRangeDescription: '$350K (townhomes) to $650K (single-family)',
    schoolDistrict: 'Poudre School District',
    schools: [
      { name: 'Rice Elementary', type: 'elementary', level: 'K–5', rating: 7 },
      { name: 'Wellington Middle School', type: 'middle', level: '6–8', rating: 7 },
      { name: 'Poudre High School', type: 'high', level: '9–12', rating: 8 },
    ],
    hoaDescription: 'Most newer subdivisions have HOAs ($50–$150/month)',
    features: ['North Fort Collins proximity (10 minutes)', 'I-25 access for commuting', 'More affordable than Fort Collins proper', 'Growing retail and dining options', 'Poudre School District schools', 'Quiet, small-town atmosphere'],
    parks: ['Wellington Community Park', 'Cathy Fromme Prairie Natural Area', 'Poudre River Trail'],
    boundaries: 'I-25 to Larimer County Road 7, Highway 1 to County Road 70',
    coordinates: { latitude: '40.6450', longitude: '-105.0050' },
    metaDescription: 'Wellington Colorado real estate guide — affordable homes north of Fort Collins with I-25 access and Poudre School District schools. SAA Homes — your local experts.',
    keywords: 'Wellington Colorado homes, Wellington Commons, Wellington real estate, north Fort Collins homes, Wellington CO subdivisions, Poudre School District homes',
    neighborhoodHighlights: [
      { title: 'Fort Collins proximity', description: 'Just 10 minutes north of Fort Collins — enjoy small-town living with big-city access.' },
      { title: 'Affordable option', description: 'Wellington offers more home for your money than Fort Collins, with the same school district.' },
      { title: 'Growing community', description: 'New developments, expanding retail, and a community-focused atmosphere make Wellington a smart choice.' },
    ],
  },
]

// ── Helper Functions ──

/**
 * Get all neighborhoods for a given city slug.
 */
export function getNeighborhoodsByCity(citySlug) {
  return neighborhoods.filter((n) => n.citySlug === citySlug)
}

/**
 * Get a specific neighborhood by its slug and optional city slug.
 */
export function getNeighborhood(slug, citySlug = null) {
  if (citySlug) {
    return neighborhoods.find((n) => n.slug === slug && n.citySlug === citySlug)
  }
  return neighborhoods.find((n) => n.slug === slug)
}

/**
 * Build the full URL path for a neighborhood page.
 */
export function getNeighborhoodUrl(neighborhood) {
  return `/northern-colorado-areas/${neighborhood.citySlug}/${neighborhood.slug}/`
}

/**
 * Build JSON-LD schemas for a neighborhood page.
 */
export function buildNeighborhoodSchemas(neighborhood) {
  const url = getNeighborhoodUrl(neighborhood)
  const fullUrl = `https://saahomes.com${url}`

  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'Place',
      name: `${neighborhood.name}, ${neighborhood.cityDisplay}`,
      description: neighborhood.description,
      url: fullUrl,
      containedInPlace: {
        '@type': 'City',
        name: neighborhood.cityDisplay,
        sameAs: `https://saahomes.com/northern-colorado-areas/${neighborhood.citySlug}/`,
      },
      geo: neighborhood.coordinates
        ? {
            '@type': 'GeoCoordinates',
            latitude: neighborhood.coordinates.latitude,
            longitude: neighborhood.coordinates.longitude,
          }
        : undefined,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://saahomes.com/' },
        {
          '@type': 'ListItem',
          position: 2,
          name: `${neighborhood.cityDisplay} Real Estate`,
          item: `https://saahomes.com/northern-colorado-areas/${neighborhood.citySlug}/`,
        },
        { '@type': 'ListItem', position: 3, name: `${neighborhood.name} Guide`, item: fullUrl },
      ],
    },
  ]

  // Add RealEstateAgent schema about SAA Homes
  schemas.push({
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: 'Schwartz and Associates',
    url: 'https://saahomes.com',
    telephone: '(970) 999-1407',
    areaServed: {
      '@type': 'City',
      name: neighborhood.cityDisplay,
    },
  })

  return schemas
}

/**
 * Build a complete meta description for a neighborhood page.
 */
export function getNeighborhoodMetaDescription(neighborhood) {
  if (neighborhood.metaDescription) return neighborhood.metaDescription
  return `${neighborhood.name} in ${neighborhood.cityDisplay}, Colorado — homes for sale, neighborhood guide, schools, HOAs, and market information from Schwartz and Associates, your local Northern Colorado real estate experts.`
}
