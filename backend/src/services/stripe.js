/**
 * Stripe over its REST API (no SDK): the brokerage seat subscription.
 *
 * Same Stripe account and conventions as ListLogic (listlogic/stripe_billing.py):
 * STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET, Checkout in subscription mode,
 * the customer portal for "manage billing", and metadata on the customer,
 * session and subscription naming the app, so each product's webhook only
 * acts on its own objects. The seat price has its own env name
 * (STRIPE_PRICE_BROKERAGE_SEAT, or STRIPE_PRICE_SEAT) so the two products
 * never collide.
 *
 * Without STRIPE_SECRET_KEY nothing here is called: billing shows
 * "Billing isn't set up yet".
 */
import crypto from 'node:crypto';

const STRIPE_API = 'https://api.stripe.com/v1';
const TIMEOUT_MS = 15000;
export const STRIPE_APP = 'brokerages';
const SIGNATURE_TOLERANCE_S = 300;

export const stripeConfigured = () => !!String(process.env.STRIPE_SECRET_KEY || '').trim();
export const seatPriceId = () => String(process.env.STRIPE_PRICE_BROKERAGE_SEAT || process.env.STRIPE_PRICE_SEAT || '').trim();
export const billingReady = () => stripeConfigured() && !!seatPriceId();

/** Stripe's form encoding: nested objects and arrays as key[sub][0]=v. */
export function formEncode(params, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item && typeof item === 'object') formEncode(item, `${key}[${i}]`, out);
        else out.append(`${key}[${i}]`, String(item));
      });
    } else if (typeof v === 'object') {
      formEncode(v, key, out);
    } else {
      out.append(key, String(v));
    }
  }
  return out;
}

/** One Stripe API call. Throws with Stripe's own message on an error. */
export async function stripeRequest(method, path, params = null, { idempotencyKey } = {}) {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) throw new Error('Billing isn’t set up yet');
  const isGet = method === 'GET';
  const qs = isGet && params ? `?${formEncode(params).toString()}` : '';
  const res = await fetch(`${STRIPE_API}${path}${qs}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(isGet ? {} : { 'Content-Type': 'application/x-www-form-urlencoded' }),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: isGet || !params ? undefined : formEncode(params).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Stripe returned ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/**
 * Check a Stripe-Signature header the way Stripe documents it: the header
 * carries t=<unix time> and one or more v1=<hex>; v1 is HMAC-SHA256 of
 * "<t>.<raw body>" keyed with the endpoint's signing secret. Rejects
 * timestamps more than five minutes from now (replays).
 */
export function verifyStripeSignature(rawBody, header, secret, { now = Date.now(), tolerance = SIGNATURE_TOLERANCE_S } = {}) {
  if (!secret || !header) return false;
  const parts = String(header).split(',').map((p) => p.trim().split('='));
  const t = Number(parts.find(([k]) => k === 't')?.[1]);
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v).filter(Boolean);
  if (!Number.isFinite(t) || !sigs.length) return false;
  if (Math.abs(Math.floor(now / 1000) - t) > tolerance) return false;
  const payload = `${t}.${Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody ?? '')}`;
  const expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  const exp = Buffer.from(expected, 'hex');
  return sigs.some((s) => {
    const got = Buffer.from(String(s), 'hex');
    return got.length === exp.length && crypto.timingSafeEqual(got, exp);
  });
}

/** A Stripe-Signature header for a body (tests and local tools). */
export function signStripePayload(rawBody, secret, t = Math.floor(Date.now() / 1000)) {
  const sig = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`, 'utf8').digest('hex');
  return `t=${t},v1=${sig}`;
}

let priceCache = { at: 0, id: null, price: null };
const PRICE_CACHE_MS = 60 * 60 * 1000;

/** The seat price for display ({ amount, currency, interval }), cached an hour; null when unknown. */
export async function seatPrice() {
  if (!billingReady()) return null;
  const id = seatPriceId();
  if (priceCache.id === id && Date.now() - priceCache.at < PRICE_CACHE_MS) return priceCache.price;
  try {
    const p = await stripeRequest('GET', `/prices/${encodeURIComponent(id)}`);
    const price = p?.unit_amount != null
      ? { amount: Number(p.unit_amount) / 100, currency: String(p.currency || 'usd').toUpperCase(), interval: p.recurring?.interval || 'month' }
      : null;
    priceCache = { at: Date.now(), id, price };
    return price;
  } catch {
    return null;
  }
}

export function clearStripeCache() {
  priceCache = { at: 0, id: null, price: null };
}
