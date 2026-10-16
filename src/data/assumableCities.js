// Assumable-mortgages-by-city pattern data (pattern assimable-homes-by-city,
// board pat-06896-06). One entry per city page under /assumable-mortgages/{slug}/.
//
// Every figure here comes from a named source with a date. The live Fort Collins
// assumable count and examples are pulled from the site's own API at render time;
// the `snapshot` and `examples` below are the verified fallback captured when the
// page was built (IRES data via GET /api/listings?assumable=true, 2026-10-15) so
// the prerendered HTML is never a shell. Do not invent a count — re-fetch.
//
// House rules (seo-pattern-drip): a city with zero assumable listings gets no
// page; a page is unique per city (its own live inventory, places, price context);
// never the reference with the name swapped.

export const ASSUMABLE_CITIES_UPDATED = '2026-10-15';

export const assumableCities = [
  {
    slug: 'fort-collins',
    city: 'Fort Collins',
    county: 'Larimer County',
    state: 'Colorado',
    path: '/assumable-mortgages/fort-collins/',
    areaPath: '/northern-colorado-areas/fort-collins/',
    searchLocation: 'Fort Collins',
    title:
      'Assumable Mortgages in Fort Collins, CO | 2026 Listings & Rates | SAA Homes',
    description:
      'Fort Collins homes with assumable VA or FHA loans, the rates in the live listings, and the cash gap to close. Updated from IRES MLS by Schwartz and Associates. Call (970) 999-1407.',
    keywords:
      'assumable homes Fort Collins, assumable mortgage Fort Collins, assumable VA loan Fort Collins, assumable FHA loan Fort Collins, Fort Collins homes with assumable loan, assumable mortgage Larimer County, buy a home with assumable loan Fort Collins',
    h1: 'Assumable Mortgages in Fort Collins, Colorado',
    heroImage: '/images/Fort-Collins-CO-Area-Guide.jpg',
    ogTitle: 'Assumable Mortgages in Fort Collins, CO — Listings & Rates',
    ogDescription:
      'Live Fort Collins listings whose MLS remarks mention an assumable VA or FHA loan, with the rate each one carries and the cash gap to close. Schwartz and Associates.',
    snapshot: {
      date: '2026-10-15',
      fortCollinsActive: 7,
      coloradoActive: 453,
      nearby: [
        { city: 'Greeley', count: 12 },
        { city: 'Johnstown', count: 9 },
        { city: 'Windsor', count: 8 },
        { city: 'Fort Collins', count: 7 },
      ],
    },
    // Verified examples captured 2026-10-15. Price/beds/baths/size/year from IRES;
    // the rate is quoted from the listing's own public remarks (not recomputed).
    examples: [
      {
        address: '829 Smith St',
        zip: '80524',
        price: '$775,000',
        beds: '2 bed',
        baths: '3 bath',
        size: '1,814 sq ft',
        year: 1925,
        loanType: 'Assumable VA',
        rate: '2.25%',
        note: 'Remarks state the current loan balance is just over $300,000 at 2.25%, near Old Town and CSU.',
      },
      {
        address: '350 Bannock St',
        zip: '80524',
        price: '$525,000',
        beds: '4 bed',
        baths: '3 bath',
        size: '1,883 sq ft',
        year: 2012,
        loanType: 'Assumable FHA',
        rate: '2.75%',
        note: 'Remarks cite an FHA assumable loan at 2.75% plus an owned 7.7KW solar system the listing values at $23,000.',
      },
      {
        address: '6720 N County Road 15',
        zip: '80524',
        price: '$1,000,000',
        beds: '4 bed',
        baths: '3 bath',
        size: '3,111 sq ft',
        year: 1985,
        loanType: 'Assumable VA',
        rate: '2.85%',
        note: 'Ranch home on 8.25 acres northwest of town; remarks lead with a 2.85% assumable VA loan.',
      },
      {
        address: '6087 Holstein Dr',
        zip: '80528',
        price: '$554,900',
        beds: '5 bed',
        baths: '3 bath',
        size: '2,730 sq ft',
        year: 2022,
        loanType: 'Assumable loan',
        rate: '4.99%',
        note: 'Built 2022 in Fossil Creek Ranch; remarks offer an assumable loan at 4.99% to any qualified buyer.',
      },
      {
        address: '1562 Faraday Cir',
        zip: '80525',
        price: '$625,000',
        beds: '4 bed',
        baths: '4 bath',
        size: '2,778 sq ft',
        year: 1989,
        loanType: 'Assumable FHA',
        rate: '5.56%',
        note: 'Collindale-area home near the Power Trail; remarks advertise an FHA assumable loan at 5.56% for qualified buyers.',
      },
      {
        address: '7356 New Raymer Ct',
        zip: '80525',
        price: '$575,000',
        beds: '4 bed',
        baths: '4 bath',
        size: '2,360 sq ft',
        year: 2005,
        loanType: 'Assumable FHA',
        rate: null,
        note: 'Ridgewood Hills home near Coyote Ridge Elementary; remarks state an FHA assumable loan is available.',
      },
    ],
    sections: [
      {
        heading: 'What an assumable mortgage is in Fort Collins',
        paragraphs: [
          'An assumable mortgage lets a qualified buyer take over the seller\u2019s existing home loan \u2014 its interest rate, remaining balance, and remaining term \u2014 instead of starting a new mortgage at today\u2019s rate. That is the whole product. It is not a discount SAA Homes can hand out, and it is not a guaranteed monthly savings.',
          'VA-backed loans are assumable by any qualified buyer, veteran or not, because the VA guarantee stays with the loan. FHA loans are assumable with lender approval. USDA loans can be assumable in some cases. Most conventional loans carry a due-on-sale clause and cannot be assumed. In every case the buyer still qualifies with the lender that holds the loan, and that lender has to approve the transfer.',
        ],
      },
      {
        heading: 'How a Fort Collins assumption actually works',
        paragraphs: [
          'First, the buyer is underwritten by the servicer, the same way a new loan would be reviewed \u2014 credit, income, and the property. Second, the buyer funds the gap between the purchase price and the remaining loan balance. On the current 829 Smith St listing, that math is real: a $775,000 asking price against a loan balance the remarks put just over $300,000 leaves roughly $475,000 to bring in cash or a second lien. That gap is the part the \u201clow rate\u201d headlines skip.',
          'Third, the timeline is set by the servicer, not by a 21-day conventional close. Assumption approvals often take longer, so we write the financing contingency and closing date around the assumption. Inspection, title, and any appraisal the lender requires still happen. VA assumptions carry a one-time funding fee (0.5% of the remaining balance for most buyers \u2014 confirm the current rate with the VA or the servicer), and FHA assumptions may carry a processing fee.',
        ],
      },
      {
        heading: 'Where the Fort Collins flags show up',
        paragraphs: [
          'The IRES MLS feed has no structured \u201cassumable loan\u201d field. The only signal is the public remarks, so a listing enters our filter when its description contains assumption language (assum, assume, assumption). The same rule runs the Assumable filter on the listing search. It is a screening tool, not a lender confirmation \u2014 a genuine VA assumption and a solar-lease \u201cbuyer to assume\u201d sentence both match, and we tell you which is which before you tour.',
          'In Fort Collins the current flags cluster where older and early-2020s financing sit together: Old Town and the 80524 ZIP, the Collindale and Ridgewood Hills pockets in 80525, Fossil Creek Ranch in 80528, and a northwest acreage listing on County Road 15. Those are different products at different price points, so the right first move is to read the remarks on each one rather than treat \u201cFort Collins\u201d as a single market.',
        ],
      },
      {
        heading: 'Fort Collins price context for 2026',
        paragraphs: [
          'Fort Collins is Northern Colorado\u2019s largest market. The median single-family home price held at roughly $610,000 in July 2026, with condos and townhomes near $385,000, inventory up about 15% year over year, and single-family homes averaging about 40 days on market, per our Fort Collins area guide. Well-priced homes in the $500,000\u2013$650,000 range still drew offers within about three weeks; homes above $750,000 typically took longer.',
          'That matters for an assumption because the equity gap scales with price. A lower-priced assumable home can leave a smaller gap to fund than a high-end one, even when both carry a below-market rate. We run the remaining balance, remaining term, and your cash-to-close with a VA-approved or FHA-experienced lender before you write.',
        ],
      },
      {
        heading: 'Veterans buying in Fort Collins',
        paragraphs: [
          'VA loans are the most common assumable loan in Fort Collins, and veteran buyers here have a second lever. Schwartz and Associates gives 0.5% of the purchase price back to veterans who buy with us \u2014 on a $500,000 purchase that is $2,500, applied as a home warranty, a closing-cost credit, or a price reduction, disclosed in writing at closing. It is not an \u201cup to\u201d figure and not a lender credit. See the veterans page for how it works.',
        ],
      },
    ],
    faqs: [
      {
        q: 'How many assumable homes are for sale in Fort Collins right now?',
        a: 'On October 15, 2026, the site\u2019s live search returned 7 active Fort Collins listings whose public remarks mention an assumable loan, out of 453 statewide. The count moves as homes go pending or new remarks hit the feed, so the number on this page is a dated reading, not a standing inventory. Use the Assumable filter on the listing search for the current set.',
      },
      {
        q: 'What rates do Fort Collins assumable listings carry?',
        a: 'The rates live in the listing remarks, not in a structured MLS field. In the current Fort Collins set they range from 2.25% on a VA loan near Old Town to 5.56% on an FHA loan in the Collindale area, with several between. We quote each listing\u2019s own remarks and never compute a savings figure the listing does not support.',
      },
      {
        q: 'Do I have to be a veteran to assume a VA loan in Fort Collins?',
        a: 'No. A VA-backed loan can be assumed by any qualified buyer, because the VA guarantee stays with the loan. A non-veteran typically pays the VA assumption funding fee, and the buyer still qualifies with the servicer. Veteran status is not a requirement to assume; it is a requirement to originate a new VA loan.',
      },
      {
        q: 'How much cash do I need to assume a Fort Collins home?',
        a: 'You fund the gap between the purchase price and the seller\u2019s remaining loan balance, plus closing costs. On a current $775,000 Fort Collins listing with a balance just over $300,000, that gap is roughly $475,000. On a lower-priced home the gap is smaller. We pull the remaining balance and term with the lender before you write, so the number is real rather than a listing\u2019s estimate.',
      },
      {
        q: 'Can I assume a loan on a Fort Collins home I find on my own?',
        a: 'Yes. The flag is in the public remarks on the listing itself, so any buyer can spot it. What we add is the work after the flag: confirming the loan type and balance with the servicer, connecting you with a VA-approved or FHA-experienced lender, and writing the contract around the assumption timeline so the closing date holds.',
      },
    ],
    relatedLinks: [
      {
        title: 'Assumable mortgages hub',
        href: '/assumable-mortgages/',
        description: 'How VA and FHA assumption works in Colorado, and the lead form',
      },
      {
        title: 'Search Fort Collins assumable homes',
        href: '/properties/?city=Fort%20Collins&assumable=true',
        description: 'Live IRES listings with the Assumable filter and Fort Collins selected',
      },
      {
        title: 'Fort Collins area guide',
        href: '/northern-colorado-areas/fort-collins/',
        description: 'Neighborhoods, schools, and current market data',
      },
      {
        title: 'Assumable homes in Fort Collins — the guide',
        href: '/blog/assumable-homes-fort-collins/',
        description: 'How to read an assumable flag and what to verify',
      },
      {
        title: 'Veterans hub — 0.5% back',
        href: '/veterans/',
        description: 'VA loans, military relocation, and the Schwartz veteran benefit',
      },
    ],
  },
];

export function getAssumableCity(slug) {
  return assumableCities.find((c) => c.slug === slug) || null;
}

/** Live search path for a city's assumable listings. */
export function getAssumableSearchPath(city) {
  return `/properties/?city=${encodeURIComponent(city)}&assumable=true`;
}
