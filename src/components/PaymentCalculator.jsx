import React, { useMemo, useState } from "react";
import { formatPrice } from "../utils/listingHelpers.js";

/**
 * Estimated monthly payment calculator (pure math — no external rate API).
 * P&I + est. taxes + est. insurance + HOA when present.
 * Labeled as estimate; Fair Housing compliant.
 */

function monthlyHoa(hoaFee, freq) {
  if (hoaFee == null || hoaFee === "" || Number(hoaFee) <= 0) return 0;
  const n = Number(hoaFee);
  if (!Number.isFinite(n)) return 0;
  const f = String(freq || "").toLowerCase();
  if (f.includes("year") || f.includes("annual")) return n / 12;
  if (f.includes("quarter")) return n / 3;
  if (f.includes("semi")) return n / 6;
  // Default / "Monthly" / empty → treat as monthly
  return n;
}

/** Standard amortization: M = P * r(1+r)^n / ((1+r)^n - 1) */
function principalAndInterest(principal, annualRatePct, termYears) {
  const P = Number(principal);
  const r = Number(annualRatePct) / 100 / 12;
  const n = Math.round(Number(termYears) * 12);
  if (!Number.isFinite(P) || P <= 0 || !Number.isFinite(n) || n <= 0) return 0;
  if (!Number.isFinite(r) || r <= 0) return P / n;
  const factor = Math.pow(1 + r, n);
  return (P * r * factor) / (factor - 1);
}

function formatUsd(n) {
  if (!Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/**
 * @param {object} props
 * @param {number|string} props.listPrice
 * @param {number|string|null} [props.taxAnnual] — from listing features.tax_annual when present
 * @param {number|string|null} [props.hoaFee]
 * @param {string|null} [props.hoaFreq] — features.assoc_fee_freq
 * @param {"card"|"inline"|"compact"} [props.variant]
 * @param {string} [props.className]
 */
export default function PaymentCalculator({
  listPrice,
  taxAnnual = null,
  hoaFee = null,
  hoaFreq = null,
  variant = "card",
  className = "",
}) {
  const price = Number(listPrice) || 0;
  const [downPct, setDownPct] = useState(20);
  const [rate, setRate] = useState(6.5);
  const [termYears, setTermYears] = useState(30);
  const [downMode, setDownMode] = useState("pct"); // pct | dollars
  const [downDollars, setDownDollars] = useState(() =>
    price > 0 ? Math.round(price * 0.2) : 0
  );

  const resolvedDownPct = useMemo(() => {
    if (downMode === "dollars" && price > 0) {
      return Math.min(100, Math.max(0, (Number(downDollars) / price) * 100));
    }
    return Math.min(100, Math.max(0, Number(downPct) || 0));
  }, [downMode, downDollars, downPct, price]);

  const calc = useMemo(() => {
    if (!price || price <= 0) return null;

    const downAmount = (price * resolvedDownPct) / 100;
    const loan = Math.max(0, price - downAmount);
    const pi = principalAndInterest(loan, rate, termYears);

    // Taxes: use listing TaxAnnualAmount when present, else 1% of price / 12
    const hasTax = taxAnnual != null && taxAnnual !== "" && Number.isFinite(Number(taxAnnual)) && Number(taxAnnual) > 0;
    const taxMonthly = hasTax
      ? Number(taxAnnual) / 12
      : (price * 0.01) / 12;
    const taxIsEstimate = !hasTax;

    // Insurance: ~0.35% of price / 12 (estimate only)
    const insuranceMonthly = (price * 0.0035) / 12;

    const hoaMonthly = monthlyHoa(hoaFee, hoaFreq);
    const total = pi + taxMonthly + insuranceMonthly + hoaMonthly;

    return {
      downAmount,
      loan,
      pi,
      taxMonthly,
      taxIsEstimate,
      insuranceMonthly,
      hoaMonthly,
      total,
    };
  }, [price, resolvedDownPct, rate, termYears, taxAnnual, hoaFee, hoaFreq]);

  if (!price || price <= 0 || !calc) return null;

  const isCompact = variant === "compact";
  const isCard = variant === "card" || variant === "inline";

  const onDownPctChange = (v) => {
    const n = Math.min(100, Math.max(0, Number(v) || 0));
    setDownPct(n);
    setDownMode("pct");
    if (price > 0) setDownDollars(Math.round((price * n) / 100));
  };

  const onDownDollarsChange = (v) => {
    const n = Math.min(price, Math.max(0, Number(v) || 0));
    setDownDollars(n);
    setDownMode("dollars");
    if (price > 0) setDownPct(Math.round((n / price) * 1000) / 10);
  };

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white ${
        isCompact ? "p-4" : "p-5"
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className={`font-bold text-gray-900 ${isCompact ? "text-sm" : "text-base"}`}>
            Est. monthly payment
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
            Estimate — actual rates vary. Not a loan offer or commitment.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`font-bold text-gray-900 tabular-nums ${isCompact ? "text-xl" : "text-2xl"}`}>
            {formatUsd(calc.total)}
            <span className="text-sm font-semibold text-gray-500">/mo</span>
          </p>
        </div>
      </div>

      {/* Down payment */}
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <label className="text-xs font-medium text-gray-600" htmlFor="pay-down-pct">
              Down payment ({resolvedDownPct.toFixed(resolvedDownPct % 1 ? 1 : 0)}%)
            </label>
            <span className="text-xs text-gray-500 tabular-nums">
              {formatPrice(Math.round(calc.downAmount))}
            </span>
          </div>
          <input
            id="pay-down-pct"
            type="range"
            min={0}
            max={50}
            step={1}
            value={Math.min(50, Math.round(resolvedDownPct))}
            onChange={(e) => onDownPctChange(e.target.value)}
            className="w-full accent-[#CFB36E] h-2 cursor-pointer"
            aria-valuemin={0}
            aria-valuemax={50}
            aria-valuenow={Math.round(resolvedDownPct)}
          />
          <div className="mt-1.5 flex gap-2">
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={Math.round(resolvedDownPct * 10) / 10}
              onChange={(e) => onDownPctChange(e.target.value)}
              className="w-16 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-900"
              aria-label="Down payment percent"
            />
            <span className="text-xs text-gray-400 self-center">% or</span>
            <input
              type="number"
              min={0}
              max={price}
              step={1000}
              value={Math.round(calc.downAmount)}
              onChange={(e) => onDownDollarsChange(e.target.value)}
              className="flex-1 min-w-0 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-900"
              aria-label="Down payment dollars"
            />
          </div>
        </div>

        {/* Rate + term */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1" htmlFor="pay-rate">
              Interest rate
            </label>
            <div className="flex items-center gap-1">
              <input
                id="pay-rate"
                type="number"
                min={0}
                max={20}
                step={0.125}
                value={rate}
                onChange={(e) => setRate(Math.min(20, Math.max(0, Number(e.target.value) || 0)))}
                className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900"
              />
              <span className="text-xs text-gray-500">%</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1" htmlFor="pay-term">
              Loan term
            </label>
            <select
              id="pay-term"
              value={termYears}
              onChange={(e) => setTermYears(Number(e.target.value))}
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 bg-white"
            >
              <option value={15}>15 years</option>
              <option value={20}>20 years</option>
              <option value={30}>30 years</option>
            </select>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      {isCard && (
        <ul className="mt-4 pt-3 border-t border-gray-100 space-y-1.5 text-xs text-gray-600">
          <li className="flex justify-between gap-2">
            <span>Principal &amp; interest</span>
            <span className="tabular-nums font-medium text-gray-900">{formatUsd(calc.pi)}</span>
          </li>
          <li className="flex justify-between gap-2">
            <span>
              Property taxes{calc.taxIsEstimate ? " (est.)" : ""}
            </span>
            <span className="tabular-nums font-medium text-gray-900">{formatUsd(calc.taxMonthly)}</span>
          </li>
          <li className="flex justify-between gap-2">
            <span>Homeowners insurance (est.)</span>
            <span className="tabular-nums font-medium text-gray-900">{formatUsd(calc.insuranceMonthly)}</span>
          </li>
          {calc.hoaMonthly > 0 && (
            <li className="flex justify-between gap-2">
              <span>HOA</span>
              <span className="tabular-nums font-medium text-gray-900">{formatUsd(calc.hoaMonthly)}</span>
            </li>
          )}
          <li className="flex justify-between gap-2 pt-1.5 border-t border-gray-100 text-sm font-semibold text-gray-900">
            <span>Estimated total</span>
            <span className="tabular-nums">{formatUsd(calc.total)}/mo</span>
          </li>
        </ul>
      )}

      <p className="mt-3 text-[10px] text-gray-400 leading-relaxed">
        Payment estimate only. Taxes
        {calc.taxIsEstimate
          ? " use ~1% of list price annually (no tax amount on this listing)"
          : " use the annual tax amount from the MLS listing"}
        ; insurance assumes ~0.35% of list price annually. Rates, insurance, taxes, and HOA can
        differ. Equal Housing Opportunity.
      </p>
    </div>
  );
}

export { principalAndInterest, monthlyHoa };
