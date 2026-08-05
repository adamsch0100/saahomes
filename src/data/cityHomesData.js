/**
 * City "homes for sale" SEO pages — /{slug}-homes-for-sale/
 * One entry per Northern Colorado city we serve. Static SEO content here;
 * live listing counts + median prices come from the /api/listings/stats
 * endpoint (real IRES data — never hardcode market numbers in copy).
 */

export const CITY_HOMES = [
  {
    slug: "fort-collins",
    city: "Fort Collins",
    county: "Larimer County",
    search: "Fort Collins",
    areaPath: "/northern-colorado-areas/fort-collins/",
    intro:
      "Fort Collins is Northern Colorado's largest city — home to Colorado State University, a thriving craft brewery scene, and some of the region's most desirable neighborhoods. Browse every active home for sale in Fort Collins below, from mid-century ranch homes in historic Old Town districts to new construction in master-planned communities along the I-25 corridor. Listings update daily from IRES MLS.",
  },
  {
    slug: "loveland",
    city: "Loveland",
    county: "Larimer County",
    search: "Loveland",
    areaPath: "/northern-colorado-areas/loveland/",
    intro:
      "Loveland blends lakefront living, a celebrated arts community, and easy I-25 access between Fort Collins and Denver. Explore every active Loveland home for sale — from waterfront properties on Lake Loveland and Boyd Lake to family neighborhoods near Thompson School District. All listings come straight from IRES MLS and update daily.",
  },
  {
    slug: "windsor",
    city: "Windsor",
    county: "Weld County",
    search: "Windsor",
    areaPath: "/northern-colorado-areas/windsor/",
    intro:
      "Windsor consistently ranks among Northern Colorado's most family-friendly communities, with top-rated Weld RE-4 schools, Windsor Lake recreation, and an award-winning historic downtown. See every active home for sale in Windsor — including new construction in Water Valley, RainDance, and surrounding master-planned neighborhoods — updated daily from IRES MLS.",
  },
  {
    slug: "greeley",
    city: "Greeley",
    county: "Weld County",
    search: "Greeley",
    areaPath: "/northern-colorado-areas/greeley/",
    intro:
      "Greeley offers the most affordable entry point into Northern Colorado's housing market, with a growing job base in agriculture, healthcare, and education anchored by UNC. Browse every active home for sale in Greeley — from first-time buyer starter homes to acreage properties on the city's edges — with live IRES MLS data refreshed daily.",
  },
  {
    slug: "timnath",
    city: "Timnath",
    county: "Larimer County",
    search: "Timnath",
    areaPath: "/northern-colorado-areas/timnath/",
    intro:
      "Timnath is one of the fastest-growing communities on the I-25 corridor, defined by brand-new master-planned neighborhoods, the Timnath Ranch resort community, and quick commutes to Fort Collins and Windsor. Explore every active Timnath home for sale — almost entirely new construction with modern floor plans — updated daily from IRES MLS.",
  },
  {
    slug: "severance",
    city: "Severance",
    county: "Weld County",
    search: "Severance",
    areaPath: "/northern-colorado-areas/severance/",
    intro:
      "Severance offers small-town living minutes from Windsor and Fort Collins, with newer construction neighborhoods and room to breathe. Browse every active home for sale in Severance, from entry-level new builds to larger family homes on bigger lots — all listed directly from IRES MLS and updated daily.",
  },
  {
    slug: "wellington",
    city: "Wellington",
    county: "Larimer County",
    search: "Wellington",
    areaPath: "/northern-colorado-areas/wellington/",
    intro:
      "Wellington sits at the northern edge of Larimer County — a quiet, growing town with easy access to Fort Collins and a strong sense of community. See every active home for sale in Wellington, including affordable newer construction and acreage properties, with live IRES MLS data updated daily.",
  },
  {
    slug: "johnstown",
    city: "Johnstown",
    county: "Weld County",
    search: "Johnstown",
    areaPath: "/northern-colorado-areas/johnstown/",
    intro:
      "Johnstown delivers affordable I-25 corridor access with growing master-planned communities and a charming historic Main Street. Explore every active home for sale in Johnstown — from move-in-ready new construction to established family neighborhoods — updated daily from IRES MLS.",
  },
  {
    slug: "eaton",
    city: "Eaton",
    county: "Weld County",
    search: "Eaton",
    areaPath: "/northern-colorado-areas/eaton/",
    intro:
      "Eaton is a classic Weld County small town with strong schools, quiet streets, and easy access to Greeley and Fort Collins. Browse every active home for sale in Eaton, where affordability meets small-town character — with live IRES MLS listings updated daily.",
  },
  {
    slug: "milliken",
    city: "Milliken",
    county: "Weld County",
    search: "Milliken",
    areaPath: "/northern-colorado-areas/milliken/",
    intro:
      "Milliken is an up-and-coming Weld County community minutes from Johnstown and Greeley, with newer neighborhoods and room to grow. See every active home for sale in Milliken — from affordable starter homes to new construction — updated daily from IRES MLS.",
  },
  {
    slug: "la-salle",
    city: "La Salle",
    county: "Weld County",
    search: "La Salle",
    areaPath: "/northern-colorado-areas/la-salle/",
    intro:
      "La Salle offers one of Northern Colorado's most affordable entry points, minutes from Greeley with quick access to the I-25 corridor. Explore every active home for sale in La Salle — including homes on larger lots and agricultural acreage — with live IRES MLS data updated daily.",
  },
  {
    slug: "mead",
    city: "Mead",
    county: "Weld County",
    search: "Mead",
    areaPath: "/northern-colorado-areas/mead/",
    intro:
      "Mead is a rapidly growing Weld County town with excellent schools, newer construction, and an easy commute to Boulder and Longmont. Browse every active home for sale in Mead — from first-time buyer homes to estate properties — updated daily from IRES MLS.",
  },
  {
    slug: "longmont",
    city: "Longmont",
    county: "Boulder County",
    search: "Longmont",
    areaPath: "/northern-colorado-areas/longmont/",
    intro:
      "Longmont combines Boulder County's outdoor lifestyle with a more attainable price point, a vibrant downtown, and quick access to both Boulder and Denver. Explore every active home for sale in Longmont — from historic homes near Main Street to new construction in the city's expanding neighborhoods — with live IRES MLS data updated daily.",
  },
  {
    slug: "boulder",
    city: "Boulder",
    county: "Boulder County",
    search: "Boulder",
    areaPath: "/northern-colorado-areas/boulder/",
    intro:
      "Boulder is Northern Colorado's most iconic mountain-meets-city market, home to the University of Colorado, the Flatirons, and a deeply competitive housing market. See every active home for sale in Boulder — from mid-century foothills properties to modern downtown condos — updated daily from IRES MLS.",
  },
  {
    slug: "berthoud",
    city: "Berthoud",
    county: "Larimer County",
    search: "Berthoud",
    areaPath: "/northern-colorado-areas/berthoud/",
    intro:
      "Berthoud offers historic foothills charm with a growing selection of new neighborhoods, sitting right on the Larimer-Boulder county line. Browse every active home for sale in Berthoud — from renovated historic homes to brand-new construction — updated daily from IRES MLS.",
  },
  {
    slug: "firestone",
    city: "Firestone",
    county: "Weld County",
    search: "Firestone",
    areaPath: "/northern-colorado-areas/firestone/",
    intro:
      "Firestone is part of the Carbon Valley — one of Northern Colorado's most affordable, fastest-growing corridors with new construction and easy I-25 access. Explore every active home for sale in Firestone, from entry-level new builds to spacious family homes, with live IRES MLS data updated daily.",
  },
  {
    slug: "frederick",
    city: "Frederick",
    county: "Weld County",
    search: "Frederick",
    areaPath: "/northern-colorado-areas/frederick/",
    intro:
      "Frederick anchors the Carbon Valley with a mix of established neighborhoods, newer construction, and quick commutes to Denver, Boulder, and Fort Collins. See every active home for sale in Frederick — updated daily from IRES MLS — from affordable starter homes to modern family residences.",
  },
  {
    slug: "evans",
    city: "Evans",
    county: "Weld County",
    search: "Evans",
    areaPath: "/northern-colorado-areas/evans/",
    intro:
      "Evans sits next to Greeley with the Poudre River running through it, offering affordable homes and convenient access to the entire Northern Colorado region. Browse every active home for sale in Evans — with live IRES MLS listings updated daily.",
  },
  {
    slug: "niwot",
    city: "Niwot",
    county: "Boulder County",
    search: "Niwot",
    areaPath: "/northern-colorado-areas/niwot/",
    intro:
      "Niwot is a beloved Boulder County village with tree-lined streets, a historic downtown, and some of the area's most charming homes. Explore every active home for sale in Niwot — from cottages near the train depot to larger foothills properties — updated daily from IRES MLS.",
  },
];

export const getCityHomes = (slug) => CITY_HOMES.find((c) => c.slug === slug);
export const getCityHomesPath = (slug) => `/${slug}-homes-for-sale/`;
