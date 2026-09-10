// Buyer & Seller FAQ data for GEO (Generative Engine Optimization)
// These feed FAQPage JSON-LD schema and visible FAQ sections on money pages

const BUYER_FAQS = [
  {
    q: 'How much do I need for a down payment on a home in Northern Colorado?',
    a: 'Down payment requirements vary by loan type. Conventional loans typically require 3–20% down, FHA loans allow as little as 3.5%, and VA and USDA loans may offer 0% down options. For qualified buyers, CHFA down payment assistance programs provide grants up to $25,000 or deferred 0%-interest loans — making homeownership achievable with minimal cash out of pocket. SAA Homes can connect you with local lenders who specialize in Colorado first-time buyer programs.'
  },
  {
    q: 'What is the first step to buying a home in Fort Collins or Northern Colorado?',
    a: 'The first step is getting pre-approved with a local lender who understands Northern Colorado market conditions and Colorado-specific financing programs like CHFA, FHA, and conventional loans. Pre-approval tells you your budget and shows sellers you are a serious buyer. Then, work with a buyer agent to define your must-haves — location, price range, home type — and start exploring neighborhoods across Fort Collins, Loveland, Windsor, Greeley, and all 27 communities we serve.'
  },
  {
    q: 'What are the best places to buy a home in Northern Colorado?',
    a: 'Northern Colorado offers diverse communities for every lifestyle: Fort Collins for CSU culture and craft breweries, Loveland for arts and lake recreation, Windsor for family-friendly neighborhoods and top schools, Greeley for affordable entry points and UNC vibrancy, Timnath for new construction, and Longmont for Boulder County access at better value. Each city has distinct neighborhoods at different price points — a local agent helps match you with the right community for your budget and lifestyle.'
  },
  {
    q: 'What closing costs should I expect when buying a Colorado home?',
    a: 'Closing costs in Colorado typically range from 2–5% of the purchase price and include loan origination fees, appraisal, title insurance, escrow fees, recording fees, prepaid property taxes, and homeowners insurance. Some costs may be negotiable with the seller depending on market conditions. CHFA programs can also help cover closing costs through their down payment assistance products.'
  },
  {
    q: 'Do I need a real estate agent to buy a home in Northern Colorado?',
    a: 'While you can buy a home without an agent, working with a professional buyer agent costs you nothing (the seller pays both commissions) and provides critical advantages: access to all MLS listings, neighborhood market data, professional negotiation, CHFA program guidance, and protection through the transaction. Schwartz and Associates at Coldwell Banker Realty offers comprehensive buyer representation across all 27 Northern Colorado communities.'
  },
  {
    q: 'What should I know about relocating to Northern Colorado?',
    a: 'Relocating to Northern Colorado offers access to outdoor recreation, strong schools, growing job markets, and a high quality of life across 27 distinct communities. Start by researching cities that match your lifestyle — Fort Collins for urban amenities and CSU culture, Loveland for arts and affordability, Windsor for family-friendly neighborhoods with top schools, and Greeley for more affordable options near UNC. The housing market is competitive in desirable areas, so getting pre-approved before your search is essential. CHFA down payment assistance programs are available statewide for qualified buyers. Schwartz and Associates can help you compare cities, find neighborhoods that fit your budget and commute needs, and coordinate with lenders who understand relocation timelines. Call (970) 999-1407 for personalized guidance.'
  },
  {
    q: 'How do I find the best realtor in Northern Colorado?',
    a: 'The best realtor for you is one with deep Northern Colorado market knowledge, verifiable local results, and a communication style that fits yours. Start by comparing agents across the markets you care about — Fort Collins, Loveland, Windsor, Greeley — review their recent sales and client feedback, and interview two or three before committing. Ask how they price homes, how they market listings, and whether they regularly work with CHFA and first-time buyer programs. Schwartz and Associates brings over 20 years of combined local expertise, verified 5.0-star client reviews, and coverage across all 27 Northern Colorado communities. Call (970) 999-1407 for a no-pressure conversation to see if we are the right fit.'
  },
  {
    q: 'What grants and programs are available for first-time homebuyers in Colorado?',
    a: 'Colorado\'s main funding source for first-time buyers is CHFA (Colorado Housing and Finance Authority), which offers down payment assistance through SmartStep & SmartStep Plus (grant or second mortgage on FHA/VA/USDA loans), Preferred & Preferred Plus (conventional up to 97% LTV), FirstStep & FirstStep Plus (FHA for first-time buyers, veterans, or targeted areas), and FirstGeneration & FirstGeneration Plus (up to $25,000 for first-generation buyers). CHFA\'s no-repayment grant adds up to $25,000 or 3% of the first mortgage on eligible programs. Beyond CHFA, look at the CHFA Schools To Home program for educators, Greeley\'s G-HOPE forgivable assistance ($2,500\u2013$8,000 by zone), and USDA or VA zero-down loans for qualifying buyers. Income limits, purchase price caps, and credit requirements vary by county and loan type, so SAA Homes verifies current program details with CHFA-approved lenders before you apply.'
  },
];

const SELLER_FAQS = [
  {
    q: 'How much does it cost to sell a home in Northern Colorado?',
    a: 'Selling costs in Northern Colorado typically include real estate commissions (5–6% total, split between buyer and seller agents), closing costs (1–3% of sale price including title insurance, escrow, recording fees), potential staging costs, and any repairs from the home inspection. Pre-listing improvements with strong ROI include fresh paint, landscaping, and minor kitchen updates. Schwartz and Associates provides a detailed net-sheet estimate during your free consultation.'
  },
  {
    q: 'What is the best time of year to sell a home in Colorado?',
    a: 'Northern Colorado\'s real estate market is active year-round, but spring and early summer (April through July) typically see the highest buyer activity, more competitive offers, and faster sales. However, fall and winter sellers often face less competition and more serious buyers. Regardless of season, proper pricing and marketing are the biggest factors in a successful sale — SAA Homes adjusts strategy based on current market conditions.'
  },
  {
    q: 'How do I prepare my home for sale in Northern Colorado?',
    a: 'Key preparation steps include: decluttering and deep cleaning throughout, making minor repairs (leaky faucets, cracked tiles, worn carpet), freshening paint with neutral colors, enhancing curb appeal with landscaping and a clean entryway, and staging rooms to help buyers visualize the space. Professional photography is essential — listings with professional photos sell 32% faster. SAA Homes provides a personalized pre-listing checklist for every seller client.'
  },
  {
    q: 'What is a free home market analysis and how does it work?',
    a: 'A Comparative Market Analysis (CMA) is a free, no-obligation report that estimates your home\'s value based on recent sales of comparable properties in your neighborhood, current active listings (your competition), and pending sales (market direction). The CMA considers your home\'s size, condition, location, upgrades, and lot features. Schwartz and Associates provides a detailed CMA with pricing recommendations, not just an automated online estimate.'
  },
  {
    q: 'How long does it take to sell a home in Fort Collins or Northern Colorado?',
    a: 'Days on market vary by city, price point, and season. In 2026, well-priced homes in desirable Northern Colorado neighborhoods typically sell within 14–45 days. Premium properties and homes in higher price brackets may take longer. Key factors affecting time-to-sale include pricing strategy, condition, location, marketing reach, and current inventory levels. Your SAA Homes agent provides a customized timeline based on your specific property and market conditions.'
  },
  {
    q: 'Can I sell my house fast in Northern Colorado?',
    a: 'Yes. Homes in desirable Northern Colorado neighborhoods that are priced correctly and well-presented often sell within 14–30 days, especially in Fort Collins, Loveland, and Windsor. To sell quickly: price competitively based on a Comparative Market Analysis, declutter and stage your home, make minor repairs, and use professional photography. If you need to sell immediately — due to relocation, financial pressure, or an inherited property — ask about our cash buyer network which can close in as little as 7–14 days with no repairs or showings required. Schwartz and Associates provides honest guidance on whether a fast cash sale or traditional listing will net you more. Call (970) 999-1407 for a free consultation.'
  },
  {
    q: 'Is it a good time to sell a house in Colorado right now?',
    a: 'Northern Colorado in late 2026 is a more balanced market than the post-pandemic years, and the sellers who win are the ones who price accurately. Inventory has grown in most cities — Loveland active listings were up about 14% in July 2026 — and days on market have lengthened above each market\'s premium tier, but medians remain solid: Fort Collins near $610,000, Loveland near $510,000 (+3.6% year-over-year), Windsor near $588,000 (+2.1%), and Greeley near $432,000. The September 2026 Federal Reserve rate cut has also brought more first-time buyers back, especially to well-priced homes in each city\'s most active price segment. Whether now is right for you depends on your equity, timeline, and next step — request a free market analysis and SAA Homes will show you current comparable sales, expected days on market, and a net-sheet estimate for your specific home.'
  },
];

export { BUYER_FAQS, SELLER_FAQS };
