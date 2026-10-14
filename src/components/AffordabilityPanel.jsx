import React, { useEffect, useMemo, useState } from "react";
import { formatPrice } from "../utils/listingHelpers.js";
import { affordability } from "../utils/affordability.js";
import { monthlyHoa } from "./PaymentCalculator.jsx";
import { useBrokerageBrand } from "../context/TenantContext.jsx";
import { marketPack } from "../data/marketPack.js";
import BookTourModal from "./BookTourModal.jsx";

const STORE_KEY = "home_afford_inputs";
const usd = (n) => (Number.isFinite(n) ? `$${Math.round(n).toLocaleString("en-US")}` : "—");
const digits = (v) => String(v ?? "").replace(/[^\d.]/g, "");

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function MoneyInput({ id, label, hint, value, onChange, placeholder }) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <div className="mt-1 flex items-center rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-[color:var(--brand-accent)]">
        <span className="pl-3 text-sm text-gray-400" aria-hidden="true">$</span>
        <input
          id={id}
          inputMode="numeric"
          value={value ? Number(value).toLocaleString("en-US") : ""}
          onChange={(e) => onChange(digits(e.target.value))}
          placeholder={placeholder}
          className="w-full min-h-[44px] rounded-lg bg-transparent px-2 text-sm text-gray-900 outline-none tabular-nums"
        />
      </div>
      {hint && <span className="mt-1 block text-[11px] text-gray-500">{hint}</span>}
    </label>
  );
}

/**
 * "Can I afford this?" for one listing: household income, other debts, down
 * payment and rate in; this home's monthly cost and a comfortable price range
 * out, with taxes and HOA from the listing. Inputs are remembered on this
 * device only, so the next home is one glance.
 */
export default function AffordabilityPanel({ listing, showTour = true }) {
  const bb = useBrokerageBrand();
  const price = Number(listing?.list_price) || 0;
  const feats = listing?.features || {};
  const hoaMonthly = monthlyHoa(listing?.hoa_fee, feats.assoc_fee_freq);
  const saved = useMemo(loadSaved, []);
  const [income, setIncome] = useState(saved?.income || "");
  const [debts, setDebts] = useState(saved?.debts || "");
  const [down, setDown] = useState(saved?.down || (price ? String(Math.round(price * 0.1)) : ""));
  const [rate, setRate] = useState(saved?.rate || "6.5");
  const [termYears, setTermYears] = useState(saved?.termYears || 30);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ income, debts, down, rate, termYears }));
    } catch {
      /* private mode */
    }
  }, [income, debts, down, rate, termYears]);

  const result = useMemo(
    () => affordability({
      income: Number(income) || 0,
      debts: Number(debts) || 0,
      down: Number(down) || 0,
      rate: Number(rate) || 0,
      termYears: Number(termYears) || 30,
      price,
      taxAnnual: feats.tax_annual,
      hoaMonthly,
    }),
    [income, debts, down, rate, termYears, price, feats.tax_annual, hoaMonthly]
  );

  if (!price) return null;

  const lenderHref = `/contact/?interest=${encodeURIComponent("Talk to a lender")}`;
  const agentTel = bb ? bb.tel : marketPack.market.tel;
  const scaleMax = result.ready ? Math.max(result.stretchMax, price) * 1.15 : 0;
  const pos = (v) => `${Math.min(100, Math.max(0, (v / scaleMax) * 100))}%`;
  const verdictCopy = {
    comfortable: { tone: "border-emerald-200 bg-emerald-50 text-emerald-900", text: "This home fits comfortably in your budget." },
    stretch: { tone: "border-amber-200 bg-amber-50 text-amber-900", text: "This home is a stretch. It can work, but leaves less room each month." },
    over: { tone: "border-red-200 bg-red-50 text-red-900", text: "This home is above what most lenders would approve on these numbers." },
  };

  return (
    <section id="affordability" className="scroll-mt-24 rounded-xl border border-gray-200 bg-white p-5" aria-labelledby="afford-heading">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="afford-heading" className="text-xl sm:text-2xl font-bold text-gray-900 font-serif">Can I afford this?</h2>
          <p className="text-sm text-gray-600 mt-1">A quick check using this home&apos;s price, taxes and HOA. Stays on this device.</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">This home</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{usd(result.home.total)}<span className="text-sm font-semibold text-gray-500">/mo</span></p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MoneyInput id="afford-income" label="Household income (per year, before taxes)" value={income} onChange={setIncome} placeholder="120,000" />
        <MoneyInput id="afford-debts" label="Other monthly debts" hint="Car, student loans, card minimums" value={debts} onChange={setDebts} placeholder="450" />
        <MoneyInput
          id="afford-down"
          label="Down payment"
          hint={price && Number(down) ? `${Math.round((Number(down) / price) * 1000) / 10}% of this home` : null}
          value={down}
          onChange={setDown}
          placeholder="50,000"
        />
        <div className="grid grid-cols-2 gap-3">
          <label htmlFor="afford-rate" className="block">
            <span className="text-xs font-medium text-gray-700">Rate</span>
            <div className="mt-1 flex items-center rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-[color:var(--brand-accent)]">
              <input
                id="afford-rate"
                inputMode="decimal"
                value={rate}
                onChange={(e) => setRate(digits(e.target.value).slice(0, 6))}
                className="w-full min-h-[44px] rounded-lg bg-transparent px-3 text-sm text-gray-900 outline-none tabular-nums"
              />
              <span className="pr-3 text-sm text-gray-400" aria-hidden="true">%</span>
            </div>
          </label>
          <label htmlFor="afford-term" className="block">
            <span className="text-xs font-medium text-gray-700">Loan</span>
            <select
              id="afford-term"
              value={termYears}
              onChange={(e) => setTermYears(Number(e.target.value))}
              className="mt-1 w-full min-h-[44px] rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900"
            >
              <option value={30}>30 years</option>
              <option value={20}>20 years</option>
              <option value={15}>15 years</option>
            </select>
          </label>
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {[
          ["Loan payment", result.home.pi],
          [result.taxKnown ? "Taxes (listing)" : "Taxes (est.)", result.home.tax],
          ["Insurance (est.)", result.home.insurance],
          ["HOA", result.home.hoa],
        ].map(([label, v]) => (
          <li key={label} className="rounded-lg bg-gray-50 px-3 py-2">
            <span className="block text-gray-500">{label}</span>
            <span className="block font-semibold text-gray-900 tabular-nums">{usd(v)}</span>
          </li>
        ))}
      </ul>

      {result.ready ? (
        <div className="mt-5">
          <p className="text-sm text-gray-700">
            Comfortable price range: <strong className="text-gray-900 tabular-nums">up to {formatPrice(result.comfortableMax)}</strong>
            {result.stretchMax > result.comfortableMax && (
              <> · stretch up to <strong className="text-gray-900 tabular-nums">{formatPrice(result.stretchMax)}</strong></>
            )}
          </p>
          <div className="relative mt-3 h-3 rounded-full bg-gray-100" aria-hidden="true">
            <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-400" style={{ width: pos(result.comfortableMax) }} />
            <div
              className="absolute inset-y-0 rounded-r-full bg-amber-300"
              style={{ left: pos(result.comfortableMax), width: `calc(${pos(result.stretchMax)} - ${pos(result.comfortableMax)})` }}
            />
            <div className="absolute -top-1 h-5 w-1 rounded bg-gray-900" style={{ left: `calc(${pos(price)} - 2px)` }} />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-gray-500">
            <span>$0</span>
            <span>▲ this home {formatPrice(price)}</span>
          </div>
          <p className={`mt-3 rounded-lg border px-3 py-2 text-sm ${verdictCopy[result.verdict].tone}`} role="status">
            {verdictCopy[result.verdict].text} Your housing cost would be about {Math.round(result.share * 100)}% of your income, counting other debts.
          </p>
        </div>
      ) : (
        <p className="mt-5 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">Add your household income to see a comfortable price range.</p>
      )}

      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <a
          href={lenderHref}
          className="inline-flex flex-1 items-center justify-center min-h-[44px] rounded-lg px-4 text-sm font-semibold"
          style={{ backgroundColor: "var(--brand-accent)", color: "var(--brand-on-accent-ink)" }}
        >
          Talk to a lender
        </a>
        {showTour ? (
          <div className="flex-1 flex">
            <BookTourModal
              listing={listing}
              buttonLabel="Book a tour"
              hideIcon
              buttonClassName="inline-flex flex-1 items-center justify-center min-h-[44px] rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-900 hover:border-black"
            />
          </div>
        ) : agentTel ? (
          <a href={agentTel} className="inline-flex flex-1 items-center justify-center min-h-[44px] rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-900 hover:border-black">
            Ask an agent
          </a>
        ) : null}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
        Estimate only, not a loan approval or offer. Uses common lender guidelines (about 28% of income for housing and 36% for
        all debts is comfortable; up to 43% is a stretch). Insurance assumes about 0.35% of the price a year
        {result.taxKnown ? "; taxes are from the listing" : "; taxes assume about 1% of the price a year"}. Equal Housing Opportunity.
      </p>
    </section>
  );
}
