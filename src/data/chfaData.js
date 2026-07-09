/**
 * CHFA program data for prerender body content injection.
 * Source of truth mirrors ChfaDownPaymentAssistancePage.jsx constants.
 */
export const CHFA_STATS = [
  { value: '$25K', label: 'Maximum down payment assistance' },
  { value: '620+', label: 'Minimum credit score' },
  { value: '$1,000', label: 'Minimum borrower contribution' },
  { value: 'Statewide', label: 'Available through CHFA lenders' },
];

export const CHFA_PROGRAMS = [
  {
    name: 'CHFA SmartStep & SmartStep Plus',
    loanType: 'FHA, VA, or USDA-RD',
    dpa: 'Grant or second mortgage',
    bestFor: 'General homebuyers needing FHA/VA/USDA financing with flexible DPA options',
    highlight: 'Grant available',
  },
  {
    name: 'CHFA Preferred & Preferred Plus',
    loanType: 'Conventional (HFA Preferred / HFA Advantage)',
    dpa: 'Second mortgage only',
    bestFor: 'Buyers who qualify for conventional financing at up to 97% LTV',
    highlight: 'Conventional',
  },
  {
    name: 'CHFA FirstStep & FirstStep Plus',
    loanType: 'FHA only',
    dpa: 'Second mortgage only',
    bestFor: 'First-time homebuyers, qualified veterans, or buyers in targeted areas',
    highlight: 'First-time buyers',
  },
  {
    name: 'CHFA FirstGeneration & FirstGeneration Plus',
    loanType: 'FHA only',
    dpa: 'Up to $25,000 second mortgage',
    bestFor: 'First-generation homebuyers whose parents/guardians never owned a home',
    highlight: 'Up to $25K DPA',
  },
  {
    name: 'Colorado HFA1 & HFA1 Plus',
    loanType: 'FHA, VA, USDA, or Conventional',
    dpa: 'Second mortgage only',
    bestFor: 'Flexible loan type options with CHFA down payment assistance',
    highlight: 'Multi-loan type',
  },
];

export const CHFA_DPA_OPTIONS = [
  {
    title: 'CHFA DPA Grant',
    highlight: 'No repayment',
    amount: 'Up to $25,000 or 3% of your first mortgage',
    detail: 'Available with eligible CHFA first mortgage programs (such as SmartStep Plus). Does not require repayment. Higher interest rates may apply when using DPA.',
    programs: 'SmartStep Plus and other eligible programs',
  },
  {
    title: 'CHFA DPA Second Mortgage',
    highlight: 'Up to 4% assistance',
    amount: 'Up to $25,000 or 4% of your first mortgage',
    detail: 'Zero monthly payments. Full repayment deferred until you pay off, sell, refinance, or move out of the home as your primary residence. Can cover down payment, closing costs, prepaids, and principal reduction.',
    programs: 'Preferred Plus, SmartStep Plus, FirstStep Plus, FirstGeneration Plus, HFA1 Plus',
  },
];

export const CHFA_REQUIREMENTS = [
  { label: 'Credit score', value: 'Minimum mid-score of 620 (some programs allow no credit score)' },
  { label: 'Borrower contribution', value: 'At least $1,000 toward the home purchase' },
  { label: 'Homebuyer education', value: 'Complete a CHFA-approved class before closing' },
  { label: 'Income limits', value: 'Household income must not exceed county-specific CHFA limits' },
  { label: 'Purchase price limits', value: 'Home price must fall within program limits for your county' },
  { label: 'Debt-to-income', value: '50% DTI max (620–659 FICO) or 55% max (660+ FICO)' },
  { label: 'Participating lender', value: 'All CHFA loans are originated through approved lenders — not directly from CHFA' },
];

export const CHFA_FAQS = [
  {
    q: 'What is CHFA down payment assistance in Colorado?',
    a: 'CHFA (Colorado Housing and Finance Authority) offers grants and deferred second mortgage loans to help eligible homebuyers with down payment and closing costs. Assistance is paired with a CHFA first mortgage through a participating lender — up to $25,000 or 3–4% of the loan amount depending on the program.',
  },
  {
    q: 'Do I have to be a first-time homebuyer for CHFA?',
    a: 'Not always. CHFA SmartStep and Preferred programs are available to repeat buyers. FirstStep requires first-time buyer status (or qualified veteran status) unless you purchase in a CHFA targeted area, where repeat buyers may also qualify with higher income limits.',
  },
  {
    q: 'How much down payment assistance can I get from CHFA?',
    a: 'Most programs offer up to the lesser of $25,000 or 3% (grant) or 4% (second mortgage) of your first mortgage. First-generation and certain disability programs may access up to $25,000 regardless of loan size. Your lender confirms exact amounts.',
  },
  {
    q: 'What credit score do I need for CHFA in Colorado?',
    a: 'A minimum mid-credit score of 620 is required for most CHFA programs. Some FHA-based programs allow borrowers with no credit score. Lenders may have additional overlays.',
  },
  {
    q: 'Is CHFA down payment assistance a grant or a loan?',
    a: 'CHFA offers both. Grants (up to 3% or $25,000) require no repayment but are limited to certain programs like SmartStep Plus. Second mortgage assistance (up to 4% or $25,000) has no monthly payments but must be repaid when you sell, refinance, pay off the first mortgage, or move out.',
  },
  {
    q: 'Can I use CHFA to buy a home in Fort Collins or Greeley?',
    a: 'Yes. CHFA programs are available statewide, including Larimer County (Fort Collins, Loveland) and Weld County (Greeley, Windsor). Income and purchase price limits vary by county, household size, and whether the property is in a targeted area.',
  },
  {
    q: 'Does CHFA down payment assistance cover closing costs?',
    a: 'Yes. CHFA DPA funds can be used toward down payment, closing costs, prepaids, and in some cases principal reduction — depending on the program and lender approval.',
  },
  {
    q: 'How do I apply for CHFA down payment assistance?',
    a: 'Start by contacting a CHFA Participating Lender — not CHFA directly. Complete homebuyer education, get pre-approved, then work with a REALTOR® to find a home within program limits. SAA Homes can guide your Northern Colorado search while your lender handles CHFA program details.',
  },
];

export const CHFA_COUNTY_LIMITS = [
  {
    county: 'Larimer County',
    cities: 'Fort Collins, Loveland, Wellington, Timnath',
    incomeRange: '~$130,000 – $156,000+',
    priceRange: 'Up to ~$664,000 – $812,000',
    areaSlug: 'fort-collins',
  },
  {
    county: 'Weld County',
    cities: 'Greeley, Windsor, Eaton, Milliken, La Salle, Mead',
    incomeRange: '~$153,600 – $179,200',
    priceRange: 'Up to ~$735,000',
    areaSlug: 'greeley',
  },
];

export const CHFA_SPECIALTY_PROGRAMS = [
  {
    title: 'G-HOPE Greeley (City Employees)',
    audience: 'Full-time employees with Greeley-area employers',
    benefit: 'Up to $8,000 forgivable down payment loan',
    link: '/greeley-g-hope-down-payment-assistance/',
  },
  {
    title: 'CHFA Schools To Home',
    audience: 'Full-time Colorado public school employees',
    benefit: 'Up to 25% down payment assistance',
    link: '/chfa-schools-to-home/',
  },
  {
    title: 'Colorado Champions Home Loan',
    audience: 'First responders & their households',
    benefit: '110% income eligibility + standard CHFA DPA',
    link: '/colorado-champions-home-loan-program/',
  },
];

export const CHFA_STEPS = [
  {
    title: 'Take homebuyer education early',
    description: 'CHFA requires an approved homebuyer education class before closing. Taking it early helps you understand the process and prepare for lender conversations.',
  },
  {
    title: 'Connect with a CHFA Participating Lender',
    description: 'A participating lender determines which CHFA program fits your income, credit, and loan type. CHFA does not lend directly — your lender handles qualification and origination.',
  },
  {
    title: 'Work with a local buyer agent',
    description: 'SAA Homes helps you find homes within CHFA purchase price limits, structure competitive offers, and coordinate with your lender through closing in Northern Colorado.',
  },
];

/** Map of CHFA route paths to their content configs */
export const CHFA_PAGE_CONFIGS = {
  '/chfa-down-payment-assistance/': {
    slug: 'chfa-down-payment-assistance',
    title: 'CHFA Down Payment Assistance Colorado',
    tagline: 'Grants and deferred loans up to $25,000 for Colorado first-time homebuyers',
    introParagraphs: [
      'The Colorado Housing and Finance Authority (CHFA) is the state\'s trusted partner for affordable homeownership. Through a statewide network of participating lenders, CHFA offers fixed-rate first mortgages paired with down payment grants or deferred second mortgage loans — helping buyers who might otherwise struggle to save a large down payment.',
      'Whether you\'re buying your first home in Fort Collins, Loveland, Windsor, or Greeley, CHFA programs can significantly reduce your upfront cash needs. SAA Homes helps Northern Colorado buyers navigate program limits, find qualifying homes, and coordinate with CHFA lenders.',
    ],
    stats: true,
    programs: true,
    dpaOptions: true,
    requirements: true,
    countyLimits: true,
    specialtyPrograms: true,
    steps: true,
    faqs: CHFA_FAQS,
    contactCta: 'Ready to explore CHFA down payment assistance? Contact SAA Homes at (970) 999-1407 for a free consultation. Our team helps Northern Colorado buyers navigate CHFA programs, find qualifying homes, and connect with participating lenders.',
  },
  '/chfa-schools-to-home/': {
    slug: 'chfa-schools-to-home',
    title: 'CHFA Schools To Home — Colorado Teacher Down Payment Assistance',
    tagline: 'Up to 25% down payment assistance for Colorado public school employees',
    introParagraphs: [
      'The CHFA Schools To Home program provides down payment assistance specifically for Colorado public school employees. Eligible educators and school staff can receive up to 25% down payment assistance to help buy a home in the communities where they teach.',
      'This program is designed to help Colorado teachers, administrators, and support staff achieve homeownership in Northern Colorado and across the state. SAA Homes helps educators find homes within program limits and coordinate with CHFA participating lenders.',
    ],
    stats: false,
    programs: false,
    dpaOptions: false,
    requirements: true,
    countyLimits: false,
    specialtyPrograms: false,
    steps: false,
    faqs: [
      {
        q: 'Who is eligible for CHFA Schools To Home?',
        a: 'Full-time employees of Colorado public school districts, including teachers, administrators, counselors, nurses, and support staff. Eligibility is determined by your lender based on program guidelines.',
      },
      {
        q: 'How much down payment assistance can teachers get?',
        a: 'The CHFA Schools To Home program offers up to 25% down payment assistance. Exact amounts depend on the home price, loan type, and program guidelines. Your lender can confirm specific figures.',
      },
      {
        q: 'Can I combine Schools To Home with other CHFA programs?',
        a: 'No. Schools To Home is a standalone program and cannot be combined with other CHFA first mortgage or down payment assistance programs. Your lender helps identify the best single program for your situation.',
      },
    ],
    contactCta: 'Are you a Colorado educator looking to buy a home? Contact SAA Homes at (970) 999-1407 for guidance on the CHFA Schools To Home program and Northern Colorado real estate.',
  },
  '/colorado-champions-home-loan-program/': {
    slug: 'colorado-champions-home-loan-program',
    title: 'Colorado Champions Home Loan Program — First Responder Home Loans',
    tagline: 'Expanded CHFA eligibility at 110% income limits for Colorado first responders and their households',
    introParagraphs: [
      'The Colorado Champions Home Loan Program is a CHFA initiative created by SB26-053 that expands access to affordable home financing for Colorado first responders and their households by raising income eligibility to 110% of standard CHFA limits and pairing with down payment assistance up to $25,000 or 3–4% of the loan amount.',
      'First responders in Larimer County (Fort Collins, Loveland, Wellington) and Weld County (Greeley, Windsor) can access the program through CHFA participating lenders. The program is expected to launch in late 2026 — sign up for updates on this page.',
    ],
    stats: false,
    programs: false,
    dpaOptions: false,
    requirements: true,
    countyLimits: false,
    specialtyPrograms: false,
    steps: false,
    faqs: [
      {
        q: 'What is the Colorado Champions Home Loan Program?',
        a: 'It is a CHFA initiative created by SB26-053 that expands access to affordable home financing for Colorado first responders and their households by raising income eligibility to 110% of standard CHFA limits and pairing with down payment assistance.',
      },
      {
        q: 'Is this a brand-new loan product?',
        a: 'No. The program expands eligibility within CHFA\'s existing first mortgage and down payment assistance programs — it does not create an entirely separate loan product.',
      },
      {
        q: 'Does the program offer zero-down financing?',
        a: 'Down payment assistance grants can make upfront costs very low or zero in many cases, depending on loan size, purchase price, and other factors. Standard CHFA requirements still apply, including a minimum $1,000 borrower contribution.',
      },
      {
        q: 'Who counts as a first responder under SB26-053?',
        a: 'Peace officers (including corrections officers, 911 specialists, wildlife officers, and more), firefighters, and EMTs — plus their households. The bill includes a broad definition of peace officer beyond sworn patrol roles.',
      },
      {
        q: 'When will I be able to apply for CHFA Champions in Colorado?',
        a: 'CHFA anticipates launching the program in late 2026. The law is effective August 12, 2026, but final guidelines and lender availability are still being developed. Sign up on this page for updates.',
      },
      {
        q: 'Can Fort Collins and Greeley first responders apply?',
        a: 'Yes. The program is statewide. First responders in Larimer County (Fort Collins, Loveland, Wellington) and Weld County (Greeley, Windsor) will access it through CHFA participating lenders serving Northern Colorado.',
      },
    ],
    contactCta: 'Are you a Colorado first responder looking to buy a home? Contact SAA Homes at (970) 999-1407 for guidance on the Champions Home Loan program and Northern Colorado real estate.',
  },
  '/greeley-g-hope-down-payment-assistance/': {
    slug: 'greeley-g-hope-down-payment-assistance',
    title: 'G-HOPE Greeley Down Payment Assistance for Employees',
    tagline: 'Up to $8,000 in forgivable down payment help for full-time Greeley-area employees buying east of 35th Avenue',
    introParagraphs: [
      'G-HOPE (Greeley Home Ownership Program for Employees) is a City of Greeley down payment assistance program for full-time employees whose employer is based within the program area. Assistance ranges from $2,500 to $8,000 depending on which of four geographic zones you purchase in — all east of 35th Avenue within Greeley.',
      'The program offers forgivable deferred loans — each year you occupy the home as your primary residence, 20% of the loan is forgiven, reaching full forgiveness after five years. No first-time buyer requirement and no income limits make this one of the most accessible down payment programs in Northern Colorado.',
    ],
    stats: false,
    programs: false,
    dpaOptions: false,
    requirements: true,
    countyLimits: false,
    specialtyPrograms: false,
    steps: false,
    faqs: [
      {
        q: 'What is the G-HOPE program in Greeley?',
        a: 'G-HOPE (Greeley Home Ownership Program for Employees) is a City of Greeley down payment assistance program for full-time employees whose employer is based within the program area. Assistance ranges from $2,500 to $8,000 depending on which of four geographic zones you purchase in — all east of 35th Avenue within Greeley.',
      },
      {
        q: 'How much down payment help can I get in each zone?',
        a: 'Zone 1 (east of 8th Avenue): up to $8,000. Zone 2 (between 8th and 14th Avenues): up to $6,000. Zone 3 (west of 14th Avenue): up to $4,000. Zone 4 (outlying eligible areas): up to $2,500. The city confirms your exact amount based on the property address.',
      },
      {
        q: 'How does the 5-year loan forgiveness work?',
        a: 'G-HOPE provides a deferred down payment loan, not a grant. Each full year you occupy the home as your primary residence, 20% of the loan is forgiven. After five years, the entire assistance amount is forgiven if you remain eligible.',
      },
      {
        q: 'Can I combine G-HOPE with CHFA down payment assistance?',
        a: 'Program stacking depends on lender guidelines and city rules. Many buyers explore G-HOPE, CHFA, or both with their loan officer. SAA Homes can help you understand options — final eligibility is determined by the city and your lender.',
      },
    ],
    contactCta: 'Are you a Greeley-area employee looking to buy a home? Contact SAA Homes at (970) 999-1407 for guidance on the G-HOPE program and Northern Colorado real estate.',
  },
};
