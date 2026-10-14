/**
 * "Can I afford this?" — pure math on the same payment rules as the payment
 * calculator (principal and interest, taxes, insurance, HOA), plus the
 * common lender guidelines for how much of a household's income goes to
 * housing: about 28% for housing alone and 36% for housing plus other debts
 * is comfortable; up to 43% for everything is a stretch.
 *
 * Everything here is an estimate, never a loan approval.
 */
import { principalAndInterest } from "../components/PaymentCalculator.jsx";

export const COMFORT_HOUSING = 0.28;
export const COMFORT_TOTAL = 0.36;
export const STRETCH_TOTAL = 0.43;
const INSURANCE_RATE = 0.0035; // per year, same as the payment calculator
const DEFAULT_TAX_RATE = 0.01; // per year, when the listing has no tax amount

/** Monthly cost of a home at `price` with these terms. */
export function monthlyCost(price, { down = 0, rate = 6.5, termYears = 30, taxRate = DEFAULT_TAX_RATE, hoaMonthly = 0 } = {}) {
  const p = Math.max(0, Number(price) || 0);
  const loan = Math.max(0, p - Math.max(0, Number(down) || 0));
  const pi = principalAndInterest(loan, rate, termYears);
  const tax = (p * taxRate) / 12;
  const insurance = (p * INSURANCE_RATE) / 12;
  const hoa = Math.max(0, Number(hoaMonthly) || 0);
  return { total: pi + tax + insurance + hoa, pi, tax, insurance, hoa, loan };
}

/** Highest price whose monthly cost fits `budget` (a monthly housing amount). */
export function maxPriceFor(budget, terms = {}) {
  const b = Number(budget) - Math.max(0, Number(terms.hoaMonthly) || 0);
  if (!(b > 0)) return 0;
  const down = Math.max(0, Number(terms.down) || 0);
  const taxRate = terms.taxRate ?? DEFAULT_TAX_RATE;
  // Cost is linear in price: k per dollar borrowed, c per dollar of price.
  const k = principalAndInterest(100000, terms.rate ?? 6.5, terms.termYears ?? 30) / 100000;
  const c = (taxRate + INSURANCE_RATE) / 12;
  const withLoan = (b + k * down) / (k + c);
  const price = withLoan >= down ? withLoan : b / c;
  return Math.max(0, Math.floor(price / 1000) * 1000);
}

/**
 * @param {object} input
 * @param {number} input.income yearly household income before taxes
 * @param {number} input.debts monthly payments on other debts
 * @param {number} input.down down payment in dollars
 * @param {number} input.rate interest rate, percent
 * @param {number} input.termYears
 * @param {number} input.price this home's price
 * @param {number|null} input.taxAnnual this home's yearly taxes, when known
 * @param {number} input.hoaMonthly this home's HOA per month
 */
export function affordability({ income, debts = 0, down = 0, rate = 6.5, termYears = 30, price, taxAnnual = null, hoaMonthly = 0 }) {
  const monthlyIncome = (Number(income) || 0) / 12;
  const p = Number(price) || 0;
  const taxKnown = Number(taxAnnual) > 0 && p > 0;
  const taxRate = taxKnown ? Number(taxAnnual) / p : DEFAULT_TAX_RATE;
  const terms = { down, rate, termYears, taxRate, hoaMonthly };
  const home = monthlyCost(p, terms);
  if (!(monthlyIncome > 0)) return { home, ready: false, taxKnown };

  const otherDebts = Math.max(0, Number(debts) || 0);
  const comfortableBudget = Math.min(monthlyIncome * COMFORT_HOUSING, monthlyIncome * COMFORT_TOTAL - otherDebts);
  const stretchBudget = monthlyIncome * STRETCH_TOTAL - otherDebts;
  const comfortableMax = maxPriceFor(comfortableBudget, terms);
  const stretchMax = Math.max(comfortableMax, maxPriceFor(stretchBudget, terms));
  const share = (home.total + otherDebts) / monthlyIncome;
  const verdict = p <= comfortableMax ? "comfortable" : p <= stretchMax ? "stretch" : "over";
  return {
    ready: true,
    taxKnown,
    home,
    comfortableMax,
    stretchMax,
    comfortableMonthly: Math.max(0, comfortableBudget),
    share,
    verdict,
  };
}
