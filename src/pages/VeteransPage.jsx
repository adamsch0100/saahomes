import React from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import VeteransLeadForm from "../components/VeteransLeadForm";
import QualifyCta from "../components/QualifyCta";
import { BUSINESS } from "../utils/seoConstants";
import { buildFaqPageSchema } from "../data/moneyPageFaqs.js";

const GOLD = "#CFB36E";
const PAGE_URL = "https://saahomes.com/veterans/";
const PAGE_TITLE =
  "Veterans Real Estate Northern Colorado | VA Loans & 0.5% Back | SAA Homes";
const PAGE_DESCRIPTION =
  "Schwartz and Associates gives 0.5% of the purchase price back to veterans — home warranty, closing costs, or price reduction. VA loan guidance, military relocation, and Northern Colorado expertise. Fort Collins, Loveland, Windsor, Greeley. Call (970) 999-1407.";

const vaBenefits = [
  {
    title: "0% down",
    description:
      "VA does not require a down payment on a purchase loan. A lender may still ask for one in some cases — we help you confirm that with a VA-approved lender before you write an offer.",
  },
  {
    title: "No monthly PMI",
    description:
      "VA-backed loans do not require private mortgage insurance. That is a real monthly savings versus most low-down conventional or FHA loans.",
  },
  {
    title: "Funding fee — or none",
    description:
      "Most borrowers pay a one-time VA funding fee. The rate depends on first-use vs subsequent use and how much you put down. You do not pay it if you receive VA compensation for a service-connected disability (or meet other VA exemption rules). Verify current rates and exemptions on VA.gov with your lender.",
  },
  {
    title: "Assumable",
    description:
      "VA-backed loans can be assumed by a qualified buyer. If you buy a home with a lower-rate VA loan already in place, the payment can be substantially lower than a new loan at today's rates.",
  },
];

const pledgeSteps = [
  {
    step: "1",
    title: "Tell us you served",
    description:
      "On this form, by phone, or when we start working together. We will confirm eligibility plainly — no fine-print games.",
  },
  {
    step: "2",
    title: "Buy (or sell) with SAA Homes",
    description:
      "Adam and Mandi represent you on a Northern Colorado purchase or sale. The 0.5% is calculated on the purchase price of the home.",
  },
  {
    step: "3",
    title: "Choose how you receive it",
    description:
      "Home warranty, a credit toward closing costs, or a price reduction. You decide. We put it in writing at closing, as Colorado law requires for commission rebates.",
  },
];

const coResources = [
  {
    name: "Northern Colorado VA Clinic",
    detail: "4575 Byrd Drive, Loveland, CO 80538 · (970) 593-3300",
    href: "https://www.va.gov/cheyenne-health-care/locations/northern-colorado-va-clinic/",
    note: "Outpatient care for Larimer and Weld County veterans (Cheyenne VA Health Care).",
  },
  {
    name: "Larimer County Veterans Service Office",
    detail: "200 W. Oak Street, 5th Floor / Suite 5000, Fort Collins · (970) 498-7390",
    href: "https://www.larimer.gov/veterans",
    note: "County VSOs help with VA claims, a Certificate of Eligibility, and state benefits. Email larimerveterans@larimer.org.",
  },
  {
    name: "Weld County Veterans Service Office",
    detail: "315 N. 11th Avenue, Building B, Greeley, CO 80631 · (970) 400-3444",
    href: "https://www.weld.gov/Government/Departments/Veterans-Service-Office",
    note: "Help applying for VA benefits. Email VSO@weld.gov.",
  },
  {
    name: "Colorado disabled-veteran property tax exemption",
    detail: "Apply with your county assessor · confirm current rules with CO Dept. of Revenue",
    href: "https://vets.colorado.gov/property-tax-exemption",
    note: "Typically 50% of the first $200,000 of actual value on a qualifying primary residence for veterans with a 100% permanent and total service-connected disability (Gold Star spouses may also qualify). Rules can change — verify before you file.",
  },
];

const cities = [
  { name: "Fort Collins", href: "/northern-colorado-areas/fort-collins/", note: "CSU, Old Town, Poudre School District" },
  { name: "Loveland", href: "/northern-colorado-areas/loveland/", note: "VA Clinic on Byrd Drive, lakes, Thompson schools" },
  { name: "Windsor", href: "/northern-colorado-areas/windsor/", note: "I-25 corridor, newer housing, family communities" },
  { name: "Greeley", href: "/northern-colorado-areas/greeley/", note: "More accessible prices, Weld County VSO in town" },
];

const faqs = [
  {
    q: "Can I use a VA loan in Fort Collins?",
    a: "Yes. A VA-backed purchase loan can be used on an eligible primary residence in Fort Collins and throughout Northern Colorado — including Loveland, Windsor, and Greeley — if you have a Certificate of Eligibility and you and the property meet VA and lender requirements. The home must be your primary residence. Confirm property eligibility (including condos on the VA-approved list) with a VA-approved lender.",
  },
  {
    q: "What does 0.5% back actually mean for me?",
    a: "Schwartz and Associates gives 0.5% of the purchase price back to veterans who buy with us. On a $500,000 purchase, 0.5% is $2,500. On a $600,000 purchase, 0.5% is $3,000. You choose how it is applied: a home warranty, a credit toward closing costs, or a price reduction. It is disclosed in writing at closing, as Colorado requires for commission rebates. It is not an 'up to' offer and it is not a lender credit.",
  },
  {
    q: "Do I need a down payment with a VA loan?",
    a: "VA does not require a down payment. Some lenders may still ask for one depending on credit, residual income, or the specific file. You will usually pay closing costs unless the seller or lender covers some of them. We help you compare a true 0% down path with any lender conditions before you write an offer.",
  },
  {
    q: "Can my spouse co-borrow?",
    a: "A spouse can typically be on a VA loan with you. Adding a non-spouse co-borrower is more limited and depends on VA and lender rules. Surviving spouses may have a separate VA home-loan benefit. Confirm occupancy, entitlement, and who can be on the note with a VA-approved lender — we will introduce you to one.",
  },
  {
    q: "What's the Colorado disabled veteran property tax exemption?",
    a: "Colorado's disabled-veteran property tax exemption typically exempts 50% of the first $200,000 of actual value on a qualifying primary residence. The core eligibility on the state veterans site is a 100% permanent and total service-connected disability rating from the VA; Gold Star spouses may also qualify. File with your county assessor and confirm current rules with the Colorado Department of Revenue or vets.colorado.gov — we do not invent tax numbers or file the exemption for you.",
  },
  {
    q: "How fast can I close with a VA loan?",
    a: "A VA purchase often closes on a similar 30–45 day timeline to other loan types once your Certificate of Eligibility, VA appraisal, and underwriting are in place. PCS orders, a delayed appraisal, or a condo approval can add time. We build the contract around your report date rather than promising a number we cannot control. Confirm current timelines with your lender.",
  },
];

const faqSchema = buildFaqPageSchema(faqs);

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://saahomes.com/" },
    { "@type": "ListItem", position: 2, name: "Colorado Home Buyers", item: "https://saahomes.com/for-buyers/" },
    { "@type": "ListItem", position: 3, name: "Veterans Real Estate", item: PAGE_URL },
  ],
};

export default function VeteransPage() {
  return (
    <>
      <SEO
        exactTitle={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        keywords="VA loan Fort Collins, VA home loan Colorado, veterans real estate agent Fort Collins, best realtor for veterans Loveland, buying a home with a VA loan, VA loan no down payment, disabled veteran property tax exemption Colorado, military relocation Northern Colorado, PCS to Fort Collins, VA loan assumption, homes for sale VA loan Greeley, veterans realtor Windsor"
        canonical={PAGE_URL}
        ogTitle="Honoring Those Who Served — 0.5% Back to Every Veteran"
        ogDescription={PAGE_DESCRIPTION}
        ogImage="https://saahomes.com/images/Fort-Collins-CO-Area-Guide.jpg"
        ogUrl={PAGE_URL}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: "Veterans Real Estate — VA Loans & 0.5% Back",
            description: PAGE_DESCRIPTION,
            url: PAGE_URL,
            provider: {
              "@type": "RealEstateAgent",
              name: BUSINESS.name,
              url: BUSINESS.url,
              telephone: BUSINESS.telephone,
            },
            areaServed: [
              "Fort Collins, CO",
              "Loveland, CO",
              "Windsor, CO",
              "Greeley, CO",
              "Northern Colorado",
            ],
          },
          breadcrumbSchema,
          faqSchema,
        ].filter(Boolean)}
      />

      {/* Hero */}
      <section
        className="relative min-h-[min(100svh,680px)] sm:min-h-[540px] bg-cover bg-center flex items-end sm:items-center justify-center pt-28 sm:pt-32 pb-16 sm:pb-20"
        style={{ backgroundImage: "url('/images/Fort-Collins-CO-Area-Guide.jpg')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-black/50" />
        <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: GOLD }} aria-hidden="true" />
        <div className="relative z-10 max-w-5xl mx-auto text-center text-white px-4 sm:px-6 w-full">
          <p
            className="inline-block mb-4 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold tracking-[0.18em] uppercase"
            style={{ backgroundColor: GOLD, color: "#1a1a1a" }}
          >
            Schwartz and Associates · Northern Colorado
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold font-serif leading-tight">
            Honoring Those Who Served — 0.5% Back to Every Veteran
          </h1>
          <p className="mt-4 sm:mt-5 text-lg sm:text-xl md:text-2xl font-sans max-w-3xl mx-auto text-gray-100 leading-relaxed">
            VA loans, military relocation, and local expertise across Fort Collins, Loveland, Windsor, and Greeley.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center max-w-md sm:max-w-none mx-auto">
            <a
              href="#veterans-lead-form"
              className="inline-flex items-center justify-center px-8 py-3.5 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors touch-manipulation shadow-lg"
            >
              Get your 0.5% veteran benefit
            </a>
            <a
              href="tel:9709991407"
              className="inline-flex items-center justify-center px-8 py-3.5 border-2 font-semibold rounded-lg hover:bg-white hover:text-black transition-colors touch-manipulation"
              style={{ borderColor: GOLD, color: GOLD }}
            >
              (970) 999-1407
            </a>
          </div>
        </div>
      </section>

      <QualifyCta
        program="a VA loan and the 0.5% veteran benefit"
        headline="Not sure if a VA loan fits — or what 0.5% back means?"
        chatQuestion="Hi! I'm a veteran (or active duty / Guard / Reserve) looking at Northern Colorado. Can you walk me through VA loans and the 0.5% veteran benefit from SAA Homes?"
        formAnchor="#veterans-lead-form"
        formLabel="Get your 0.5% veteran benefit instead"
      />

      {/* Pledge — centerpiece */}
      <section className="py-16 sm:py-20 px-6 bg-[#FAF7F2]" id="pledge">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-5 gap-12 items-start">
          <div className="lg:col-span-3">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: GOLD }}>
              The 0.5% pledge
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-6 text-gray-900">
              0.5% of the purchase price, back to you
            </h2>
            <div className="rounded-xl border-2 p-6 sm:p-8 bg-white mb-8" style={{ borderColor: GOLD }}>
              <p className="text-lg sm:text-xl text-gray-900 leading-relaxed font-medium">
                Schwartz and Associates gives 0.5% of the purchase price back to veterans, applied however you choose: home warranty, closing costs, or price reduction.
              </p>
            </div>
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              This is a real offer from Adam and Mandi Schwartz — not an “up to” teaser. On a $500,000 home, 0.5% is $2,500. On a $600,000 home, 0.5% is $3,000. You tell us how to apply it.
            </p>
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              <strong>How it works:</strong> Colorado allows commission rebates when they are disclosed in writing at closing. We document the 0.5% on the closing statement. No side deals, no disappearing credits.
            </p>
            <p className="text-lg text-gray-700 mb-4 leading-relaxed">
              <strong>Who qualifies:</strong> Veterans, active-duty service members, and National Guard / Reserve members who buy or sell with Schwartz and Associates. We will ask for straightforward proof of service — typically a DD-214, current LES, or VA Certificate of Eligibility — so we can apply the benefit correctly. Surviving spouses using a VA loan benefit should ask; we will review your situation honestly rather than stretch the offer.
            </p>
            <p className="text-sm text-gray-500">
              The 0.5% is our brokerage benefit. It is separate from the VA funding fee, seller concessions, and any lender credit. We do not mark it up or bury it in junk fees.
            </p>
          </div>
          <div className="lg:col-span-2 lg:sticky lg:top-28 scroll-mt-28">
            <VeteransLeadForm compact />
          </div>
        </div>
      </section>

      {/* How the pledge lands */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-10 text-center text-gray-900">
            Three steps. No fine print.
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {pledgeSteps.map((item) => (
              <article key={item.step} className="rounded-xl border border-gray-200 p-6 bg-gray-50">
                <p className="text-sm font-bold tracking-[0.2em] uppercase mb-3" style={{ color: GOLD }}>
                  Step {item.step}
                </p>
                <h3 className="text-xl font-bold font-serif text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-700 leading-relaxed">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* VA loan explainer */}
      <section className="py-16 sm:py-20 px-6 bg-gray-50" id="va-loans">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3 text-center" style={{ color: GOLD }}>
            VA home loans
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4 text-center text-gray-900">
            How a VA loan actually works
          </h2>
          <p className="text-lg text-gray-700 max-w-3xl mx-auto text-center mb-12 leading-relaxed">
            Facts from{" "}
            <a
              href="https://www.va.gov/housing-assistance/home-loans/"
              className="underline font-semibold"
              target="_blank"
              rel="noopener noreferrer"
            >
              VA.gov
            </a>
            . We do not invent rates, funding-fee charts, or closing timelines. Your VA-approved lender confirms the numbers on your file.
          </p>
          <div className="grid sm:grid-cols-2 gap-6 mb-12">
            {vaBenefits.map((item) => (
              <article key={item.title} className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-xl font-bold font-serif text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-700 leading-relaxed">{item.description}</p>
              </article>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8">
              <h3 className="text-2xl font-bold font-serif text-gray-900 mb-4">Certificate of Eligibility (COE)</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                A COE is how the VA shows a lender you have the home-loan benefit. Most VA-approved lenders can request it electronically. You can also request one yourself on{" "}
                <a
                  href="https://www.va.gov/housing-assistance/home-loans/how-to-request-coe/"
                  className="underline font-semibold"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  VA.gov
                </a>{" "}
                or with help from a county Veterans Service Officer.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Eligibility is based on service history and duty status — veterans, many active-duty members, qualifying Guard/Reserve service, and certain surviving spouses. We do not decide entitlement. The COE does.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8">
              <h3 className="text-2xl font-bold font-serif text-gray-900 mb-4">VA appraisal</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                Your lender orders a VA appraisal. It estimates market value and checks minimum property requirements. It is not a home inspection and it is not a guarantee of value. You should still get an independent inspection.
              </p>
              <p className="text-gray-700 leading-relaxed">
                If the appraised value comes in below the contract price, we help you renegotiate, bring cash, or walk — using the VA escape clause when it applies. We never tell you to skip the inspection to “win” a house.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-xl border-2 bg-black text-white p-6 sm:p-8" style={{ borderColor: GOLD }}>
            <h3 className="text-2xl font-bold font-serif mb-3">VA loans are assumable</h3>
            <p className="text-gray-200 leading-relaxed mb-4">
              A qualified buyer can take over a seller’s VA-backed loan instead of originating a new one. In a higher-rate market, assuming a lower-rate VA loan can mean a meaningfully lower monthly payment. The buyer still has to qualify, and VA / lender assumption rules apply.
            </p>
            <Link
              to="/assumable-mortgages/"
              className="inline-flex items-center font-semibold hover:underline"
              style={{ color: GOLD }}
            >
              See how VA loan assumption works →
            </Link>
          </div>
        </div>
      </section>

      {/* Colorado benefits */}
      <section className="py-16 sm:py-20 px-6 bg-white" id="colorado-benefits">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3 text-center" style={{ color: GOLD }}>
            Colorado
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4 text-center text-gray-900">
            Colorado veteran benefits we actually cite
          </h2>
          <p className="text-lg text-gray-700 max-w-3xl mx-auto text-center mb-12 leading-relaxed">
            Local resources verified from VA.gov, Larimer County, Weld County, and Colorado Division of Veterans Affairs. Confirm hours and eligibility before you visit.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {coResources.map((item) => (
              <article key={item.name} className="rounded-xl border border-gray-200 p-6">
                <h3 className="text-xl font-bold font-serif text-gray-900 mb-2">{item.name}</h3>
                <p className="text-sm font-semibold text-gray-800 mb-3">{item.detail}</p>
                <p className="text-gray-700 leading-relaxed mb-4">{item.note}</p>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline"
                  style={{ color: "#1a1a1a" }}
                >
                  Official source →
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Military relocation */}
      <section className="py-16 sm:py-20 px-6 bg-[#111] text-white" id="pcs">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: GOLD }}>
            Military relocation
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-6">
            PCS to Northern Colorado — we work your timeline
          </h2>
          <p className="text-lg text-gray-300 max-w-3xl leading-relaxed mb-10">
            Orders do not wait on a Colorado closing. We run a remote-friendly process: video tours, same-day offer strategy, and a contract calendar built around your report date. You do not have to be in Fort Collins to start.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
            {cities.map((city) => (
              <Link
                key={city.name}
                to={city.href}
                className="block rounded-xl border border-white/15 p-5 hover:border-[#CFB36E] transition-colors"
              >
                <h3 className="text-xl font-bold font-serif mb-2">{city.name}</h3>
                <p className="text-sm text-gray-400">{city.note}</p>
              </Link>
            ))}
          </div>
          <ul className="space-y-3 text-gray-200 max-w-3xl">
            <li>Pre-approval with a VA-approved lender before you fly out — so you can write when the right house hits.</li>
            <li>Neighborhood shortlist by commute, school district, and distance to the Loveland VA Clinic — not a canned “best of” list.</li>
            <li>Temporary lodging vs. buying on arrival: we will say so if renting first is the smarter move for your dates.</li>
          </ul>
          <p className="mt-8">
            <Link
              to="/blog/military-relocation-northern-colorado/"
              className="font-semibold hover:underline"
              style={{ color: GOLD }}
            >
              Read the military relocation guide →
            </Link>
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20 px-6 bg-white" id="faq">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-10 text-center text-gray-900">
            Veterans real estate FAQ
          </h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <details key={faq.q} className="group rounded-xl border border-gray-200 bg-gray-50 p-5 sm:p-6">
                <summary className="cursor-pointer font-semibold text-lg text-gray-900 list-none flex items-start justify-between gap-4">
                  <span>{faq.q}</span>
                  <span className="text-[#CFB36E] group-open:rotate-45 transition-transform text-2xl leading-none">+</span>
                </summary>
                <p className="mt-4 text-gray-700 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="py-16 px-6 bg-[#FAF7F2]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold font-serif text-gray-900 mb-4">
              Get your 0.5% veteran benefit + VA loan guidance
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              Adam and Mandi Schwartz — Schwartz and Associates, Coldwell Banker Realty. Call{" "}
              <a href="tel:9709991407" className="font-semibold underline">
                (970) 999-1407
              </a>
              .
            </p>
          </div>
          <VeteransLeadForm />
          <p className="text-sm text-gray-500 mt-8 text-center leading-relaxed">
            Related:{" "}
            <Link to="/blog/va-loan-colorado-guide/" className="underline hover:text-gray-800">
              VA loan Colorado guide
            </Link>
            {" · "}
            <Link to="/blog/military-relocation-northern-colorado/" className="underline hover:text-gray-800">
              Military relocation
            </Link>
            {" · "}
            <Link to="/chfa-down-payment-assistance/" className="underline hover:text-gray-800">
              CHFA down payment assistance
            </Link>
            {" · "}
            <Link to="/assumable-mortgages/" className="underline hover:text-gray-800">
              Assumable mortgages
            </Link>
            {" · "}
            <Link to="/for-buyers/" className="underline hover:text-gray-800">
              For buyers
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
