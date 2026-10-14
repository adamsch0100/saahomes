/**
 * The stay-in-touch emails a past client gets, in their brokerage's brand:
 * home anniversary report, a nearby home sold or listed, a birthday note,
 * property tax season, and rate watch. Pure functions: callers gather the
 * numbers (never invented here) and send.
 *
 * Every email names its kind in the footer with a one-click way to stop just
 * that kind, plus a link to manage all of them.
 */
import { contactLine, textOnAccent } from './emailer.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = (n) => (n == null || !Number.isFinite(Number(n)) ? '—' : `$${Math.round(Number(n)).toLocaleString('en-US')}`);
const signed = (n) => `${n >= 0 ? '+' : '−'}${money(Math.abs(n))}`;
const pct = (n) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}%`;
const longDate = (d) => new Date(`${String(d).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const shortDate = (d) => new Date(`${String(d).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const ordinalYears = (n) => (n === 1 ? 'one-year' : `${n}-year`);

/** What each email is called, for footers, settings and the agent's list. */
export const STAY_LABELS = {
  anniversary: 'Home anniversary report',
  neighbor: 'Nearby homes sold or listed',
  birthday: 'Birthday note',
  tax: 'Property tax season note',
  rate: 'Rate watch',
};

/** A button in the brand's accent color. */
function button(href, label, brand) {
  const accent = brand.accent_color || '#111111';
  return `<a href="${esc(href)}" style="display:block;background:${accent};color:${textOnAccent(accent, '#111')};text-decoration:none;font-weight:700;font-size:14px;padding:13px 16px;border-radius:8px;text-align:center">${esc(label)}</a>`;
}

function ghostButton(href, label) {
  return `<a href="${esc(href)}" style="display:block;border:1px solid #d1d5db;color:#111;text-decoration:none;font-weight:600;font-size:13px;padding:12px 16px;border-radius:8px;text-align:center">${esc(label)}</a>`;
}

/**
 * The shared frame: brand header, white card, footer with contact line and
 * per-kind unsubscribe. brand is a brandFor() result.
 */
export function emailShell({ brand, site, kind, bodyHtml, unsubscribeUrl, manageUrl, preheader = '', reason = null, stopLabel = null }) {
  const primary = brand.primary_color || '#111111';
  const accent = brand.accent_color || '#111111';
  const name = String(brand.name || '').toUpperCase();
  const sub = [brand.legal_name && brand.legal_name !== brand.name ? brand.legal_name : null, brand.market_name ? `${brand.market_name} Real Estate` : null]
    .filter(Boolean).join(' · ');
  const footer = contactLine(brand, site);
  const label = STAY_LABELS[kind];
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${primary}">
    <tr><td align="center" style="padding:22px 16px">
      ${brand.logo_url && /^https:/.test(brand.logo_url) ? `<img src="${esc(brand.logo_url)}" alt="${esc(brand.name)}" style="max-height:40px;max-width:200px" />` : `<div style="color:${accent};font-size:19px;font-weight:800;letter-spacing:0.04em">${esc(name)}</div>`}
      ${sub ? `<div style="color:#9ca3af;font-size:12px;margin-top:4px">${esc(sub)}</div>` : ''}
    </td></tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:22px 12px">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
        ${bodyHtml}
        <tr><td style="padding:16px 24px 26px;border-top:1px solid #f3f4f6">
          <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6">
            ${esc(reason || 'You get this because you asked to stay in touch after your closing.')}
            ${unsubscribeUrl ? `<br/><a href="${esc(unsubscribeUrl)}" style="color:#6b7280">${esc(stopLabel || `Stop ${label ? label.toLowerCase() : 'these'} emails`)}</a>` : ''}
            ${manageUrl ? ` &nbsp;·&nbsp; <a href="${esc(manageUrl)}" style="color:#6b7280">Manage all emails</a>` : ''}
            ${footer ? `<br/>${esc(footer)}` : ''}
            <br/>Equal Housing Opportunity
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const row = (html, pad = '8px 24px') => `<tr><td style="padding:${pad}">${html}</td></tr>`;
const p = (html, style = '') => `<p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#374151;${style}">${html}</p>`;

function agentSignature(agent, brand) {
  const name = agent?.name || brand.agent_name || brand.name;
  const phone = agent?.phone || brand.phone;
  return `<p style="margin:14px 0 0;font-size:14px;color:#111;line-height:1.5"><strong>${esc(name)}</strong>${phone ? `<br/><span style="color:#6b7280">${esc(phone)}</span>` : ''}</p>`;
}

/**
 * Home anniversary report.
 * data: { years, value: {low, mid, high} | null, closePrice, equity | null,
 *         sales: { count, median, recent: [{address, price, date}] }, note }
 */
export function anniversaryEmail({ brand, site, firstName, address, agent, data, myHomeUrl, unsubscribeUrl, manageUrl }) {
  const { years, value, closePrice, equity, sales, note } = data;
  const change = value?.mid != null && closePrice ? value.mid - closePrice : null;
  const changePct = change != null && closePrice ? (change / closePrice) * 100 : null;
  const subject = `Happy ${ordinalYears(years)} home anniversary${firstName ? `, ${firstName}` : ''}!`;
  const accent = brand.accent_color || '#111111';

  const valueBlock = value?.mid != null
    ? `<div style="background:${brand.primary_color || '#111'};border-radius:12px;padding:18px;text-align:center">
        <div style="color:${accent};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">Estimated value today</div>
        <div style="color:#fff;font-size:30px;font-weight:800;margin-top:6px">${money(value.mid)}</div>
        <div style="color:#d1d5db;font-size:13px;margin-top:4px">${money(value.low)} – ${money(value.high)}</div>
        ${change != null ? `<div style="color:#fff;font-size:13px;margin-top:10px">${signed(change)} (${pct(changePct)}) since you bought for ${money(closePrice)}</div>` : ''}
      </div>`
    : p('We could not estimate a value this year: there were not enough recent sales like your home nearby. Your agent can pull one for you.');

  const equityBlock = equity != null
    ? p(`<strong>Estimated equity:</strong> about ${money(equity)} (estimated value minus an estimated loan balance from the loan details on file).`)
    : '';

  const salesBlock = sales?.count
    ? `<p style="margin:16px 0 6px;font-size:14px;font-weight:700;color:#111">Your neighborhood this year</p>
       ${p(`${sales.count} home${sales.count === 1 ? '' : 's'} sold in ${esc(sales.area)} in the last 12 months${sales.median ? `, at a median of ${money(sales.median)}` : ''}.`)}
       ${sales.recent?.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#374151">
         ${sales.recent.map((s) => `<tr><td style="padding:6px 0;border-top:1px solid #f3f4f6">${esc(s.address)}</td><td style="padding:6px 0;border-top:1px solid #f3f4f6;text-align:right;white-space:nowrap">${money(s.price)} · ${esc(shortDate(s.date))}</td></tr>`).join('')}
       </table>` : ''}`
    : '';

  const noteBlock = note
    ? `<div style="margin-top:18px;border-left:3px solid ${accent};padding:4px 0 4px 14px">
        <p style="margin:0;font-size:14px;line-height:1.6;color:#111;white-space:pre-line">${esc(note)}</p>
        ${agentSignature(agent, brand)}
      </div>`
    : agentSignature(agent, brand);

  const body = [
    row(`${p(`Hi ${esc(firstName || 'there')},`, 'font-size:16px;color:#111')}${p(`${years === 1 ? 'One year' : `${years} years`} ago you got the keys to <strong>${esc(address)}</strong>. Here is how your home and your neighborhood have done since.`)}`, '26px 24px 6px'),
    row(valueBlock),
    row(`${equityBlock}${salesBlock}${noteBlock}`, '14px 24px 8px'),
    row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:6px 0">${button(myHomeUrl, 'See my home’s value', brand)}</td></tr>
      ${agent?.email || brand.email ? `<tr><td style="padding:6px 0">${ghostButton(`mailto:${agent?.email || brand.email}`, 'Ask a question')}</td></tr>` : ''}
    </table>
    <p style="margin:10px 0 0;font-size:11px;color:#9ca3af;line-height:1.5">Estimates use recent sales near you. They are not an appraisal.</p>`, '10px 24px 18px'),
  ].join('');

  return { subject, html: emailShell({ brand, site, kind: 'anniversary', bodyHtml: body, unsubscribeUrl, manageUrl, preheader: 'Your home’s value, your equity and what sold near you.' }) };
}

/** A similar home nearby sold or listed. home: { address, price, beds, baths, sqft, date, sold } */
export function neighborEmail({ brand, site, firstName, agent, home, myHomeUrl, unsubscribeUrl, manageUrl }) {
  const verb = home.sold ? 'sold' : 'just listed';
  const facts = [home.beds ? `${Number(home.beds)} bd` : null, home.baths ? `${Number(home.baths)} ba` : null, home.sqft ? `${Math.round(home.sqft).toLocaleString('en-US')} sq ft` : null].filter(Boolean).join(' · ');
  const subject = home.sold
    ? `A home like yours near you sold for ${money(home.price)}`
    : `A home like yours near you just listed at ${money(home.price)}`;
  const body = [
    row(`${p(`Hi ${esc(firstName || 'there')},`, 'font-size:16px;color:#111')}${p(`A home a lot like yours ${verb} nearby. Thought you’d want to know.`)}`, '26px 24px 6px'),
    row(`<div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px">
      <div style="font-size:15px;font-weight:700;color:#111">${esc(home.address)}</div>
      ${facts ? `<div style="font-size:13px;color:#6b7280;margin-top:4px">${esc(facts)}</div>` : ''}
      <div style="font-size:22px;font-weight:800;color:#111;margin-top:10px">${money(home.price)}</div>
      <div style="font-size:12px;color:#6b7280;margin-top:2px">${home.sold ? `Sold ${esc(longDate(home.date))}` : 'Listed price'}</div>
    </div>`),
    row(`${button(myHomeUrl, 'What might mine be worth?', brand)}${agentSignature(agent, brand)}`, '14px 24px 18px'),
  ].join('');
  return { subject, html: emailShell({ brand, site, kind: 'neighbor', bodyHtml: body, unsubscribeUrl, manageUrl }) };
}

/** Fill {first_name}, {agent_name}, {brand_name} in an agent-approved template. */
export function fillTemplate(text, vars) {
  return String(text || '').replace(/\{(first_name|agent_name|brand_name)\}/g, (_, k) => vars[k] || '');
}

export const DEFAULT_BIRTHDAY_TEMPLATE = {
  subject: 'Happy birthday, {first_name}!',
  body: 'Happy birthday, {first_name}! I hope the year ahead is a great one, in your home and everywhere else.\n\nIf there is ever anything I can do for you, I’m a quick call away.',
};

/** Birthday note from the agent's approved template. */
export function birthdayEmail({ brand, site, firstName, agent, template, unsubscribeUrl, manageUrl }) {
  const vars = { first_name: firstName || 'there', agent_name: agent?.name || brand.name, brand_name: brand.name };
  const subject = fillTemplate(template.subject, vars).slice(0, 150);
  const text = fillTemplate(template.body, vars);
  const body = row(`<div style="font-size:30px;text-align:center;margin-bottom:8px" aria-hidden="true">🎂</div>
    ${p(esc(text).replace(/\n/g, '<br/>'), 'font-size:15px;color:#111')}
    ${agentSignature(agent, brand)}`, '28px 24px 18px');
  return { subject, html: emailShell({ brand, site, kind: 'birthday', bodyHtml: body, unsubscribeUrl, manageUrl }) };
}

/** Property tax season: generic, no legal or tax advice. */
export function taxEmail({ brand, site, firstName, address, agent, myHomeUrl, unsubscribeUrl, manageUrl }) {
  const subject = 'Property value notices are going out';
  const body = [
    row(`${p(`Hi ${esc(firstName || 'there')},`, 'font-size:16px;color:#111')}
      ${p(`This is the time of year many counties mail property value notices. Yours for <strong>${esc(address)}</strong> may arrive soon, if it hasn’t already.`)}
      ${p('If the value on your notice looks high next to what similar homes near you sold for, your county has a process to ask for a review, with a deadline printed on the notice.')}
      ${p('We’re glad to send you a free list of recent sales near your home to compare. Just reply to this email.')}`, '26px 24px 6px'),
    row(`${button(myHomeUrl, 'See recent sales near my home', brand)}${agentSignature(agent, brand)}
      <p style="margin:14px 0 0;font-size:11px;color:#9ca3af;line-height:1.5">This is general information, not legal or tax advice. Dates and rules vary by county; check your notice or your county assessor’s website.</p>`, '10px 24px 18px'),
  ].join('');
  return { subject, html: emailShell({ brand, site, kind: 'tax', bodyHtml: body, unsubscribeUrl, manageUrl }) };
}

/** Rate watch: the published average reached the client's target. */
export function rateEmail({ brand, site, firstName, agent, rate, target, asOf, sourceLabel, myHomeUrl, unsubscribeUrl, manageUrl }) {
  const subject = `Rates reached your ${Number(target).toFixed(2)}% target`;
  const body = [
    row(`${p(`Hi ${esc(firstName || 'there')},`, 'font-size:16px;color:#111')}
      ${p(`You asked us to tell you when mortgage rates reached <strong>${Number(target).toFixed(2)}%</strong>. The average 30-year fixed rate is now <strong>${Number(rate).toFixed(2)}%</strong>${asOf ? ` (week of ${esc(longDate(asOf))})` : ''}.`)}
      ${p('Your own rate depends on your loan, credit and the lender. If you’d like, we’ll introduce you to a local lender who can run the numbers for you.')}`, '26px 24px 6px'),
    row(`${button(agent?.email || brand.email ? `mailto:${agent?.email || brand.email}?subject=${encodeURIComponent('Rates reached my target')}` : myHomeUrl, 'Connect me with a lender', brand)}
      ${agentSignature(agent, brand)}
      <p style="margin:14px 0 0;font-size:11px;color:#9ca3af;line-height:1.5">${sourceLabel ? `Source: ${esc(sourceLabel)}. ` : ''}A published average, not a quote or advice.</p>`, '10px 24px 18px'),
  ].join('');
  return { subject, html: emailShell({ brand, site, kind: 'rate', bodyHtml: body, unsubscribeUrl, manageUrl }) };
}

/** A short note to the agent (tour asked for, market analysis asked for, …). */
export function agentNoticeEmail({ brand, site, title, lines = [], link, linkLabel = 'Open your cockpit' }) {
  const body = [
    row(`<p style="margin:0 0 10px;font-size:17px;font-weight:700;color:#111">${esc(title)}</p>
      ${lines.filter(Boolean).map((l) => p(esc(l))).join('')}`, '24px 24px 6px'),
    row(button(link, linkLabel, brand), '6px 24px 22px'),
  ].join('');
  // No unsubscribe line: these go to the brokerage's own staff.
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:22px 12px">
    <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
      <tr><td style="background:${brand.primary_color || '#111'};padding:12px 24px;color:${brand.accent_color || '#fff'};font-size:13px;font-weight:800;letter-spacing:0.04em">${esc(String(brand.name || '').toUpperCase())}</td></tr>
      ${body}
    </table>
    <p style="font-size:11px;color:#9ca3af">${esc(contactLine(brand, site))}</p>
  </td></tr></table>
</body></html>`;
}
