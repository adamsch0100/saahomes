/**
 * The platform's own marketing site, served on its marketing domain
 * (PLATFORM_MARKETING_DOMAIN or the platform console; never saahomes.com):
 *
 *   /                         the product page for brokerages
 *   /start, /admin, /agent,   the app's pages (signup, the platform owner's
 *   /reset-password           console, a new brokerage's console) in a shell
 *                             with the platform's head, never SAA's
 *   /robots.txt, /sitemap.xml, /manifest.webmanifest, favicons: the platform's own
 *   anything else             the platform's 404 (no SAA page answers here)
 *
 * The page is plain HTML and CSS rendered here: no framework, no web fonts,
 * nothing to wait for. Plans come from the plan catalog; if it can't be
 * read, the pricing section offers the free trial.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { platformIdentity, publicPlatform, isPlatformHost, refreshPlatformIdentity } from './platform.js';
import { TRIAL_DAYS } from './billing.js';
import { loadPlanCatalog, publicCatalog } from './plans.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// JSON inside <script>: no closing tags, no line separators.
const scriptJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, '');

/** Black or white, whichever reads on the given background color. */
function onColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return lum > 0.35 ? '#111111' : '#ffffff';
}

// App pages the marketing domain also serves (trailing slash optional).
export const PLATFORM_APP_PATHS = /^\/(start|admin|agent|reset-password)\/?$/;

const FEATURES = [
  {
    title: 'Branded home search and buyer app',
    text: 'Every home for sale in your market on your own domain. Saved searches, instant alerts for new matches and price drops, and an app buyers add to their home screen.',
  },
  {
    title: 'A CRM your agents will open',
    text: 'New leads arrive with a score, a heat level and a next step. Tasks, action plans, a team inbox and a morning brief that says who to call first.',
  },
  {
    title: 'AI follow-up and texting',
    text: 'An assistant answers buyers about homes and neighborhoods any time of day and hands them to your team. Texting with consent, STOP and HELP handled for you.',
  },
  {
    title: 'Seller tools and stay-in-touch',
    text: 'Monthly home value emails for homeowners and past clients, a heads-up when someone may be getting ready to sell, and stay-in-touch plans for your sphere.',
  },
  {
    title: 'Your brand everywhere',
    text: 'Your name, logo, colors and phone on the site, every email, every text and the app icon. Your domain and your sending address, not ours.',
  },
  {
    title: 'Routing and reports',
    text: 'Send each new lead to the right agent automatically. See where leads come from and how fast your team answers them.',
  },
];

const COMPARE = [
  ['Home search site and buyer app', 'A separate IDX site plus a buyer app such as RealScout', 'Included, on your own domain'],
  ['CRM', 'A separate CRM such as Follow Up Boss', 'Included. Or keep Follow Up Boss: leads, searches and home views flow into it'],
  ['First reply and texting', 'Another add-on with its own login', 'Included, with consent and opt-outs built in'],
  ['Seller nurture and home values', 'Another tool, or done by hand', 'Included'],
  ['Whose brand buyers see', 'Often the vendor’s, in emails and apps', 'Yours, everywhere'],
  ['Logins per agent', 'Three to five', 'One'],
];

const STEPS = [
  ['Sign up', 'Name your brokerage and pick your free site address. It takes about a minute.'],
  ['Make it yours', 'Add your logo, colors and phone, invite your agents and pick your CRM.'],
  ['Connect your MLS', 'Sample homes show until your MLS approves your feed, usually a few days to a few weeks.'],
];

function faq(trial) {
  return [
    ['Do I need my MLS’s approval?', 'Yes, for live listings. Ask your MLS for an IDX or data feed license for your brokerage. Until it’s approved your site shows sample homes, so you can set up everything else.'],
    ['Can I use my own domain?', 'Yes. Your site works on a free address from day one. Point your own domain at it whenever you’re ready.'],
    ['We already use Follow Up Boss. Do we have to switch?', 'No. Keep it, and leads, saved searches and home views flow into it. Or run your leads right here. You can switch any time without losing anything.'],
    ['What happens after the free trial?', `You get ${trial} days free with no card. Add a payment method any time before it ends. If you don’t, your site pauses and nothing is deleted.`],
  ];
}

const CSS = `
:root{--ink:#111111;--muted:#4b5563;--line:#e5e7eb;--soft:#f6f7f9;--brand:VAR_PRIMARY;--on-brand:VAR_ON_PRIMARY;--accent:VAR_ACCENT;--on-accent:VAR_ON_ACCENT;color-scheme:light}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:var(--ink);background:#fff;line-height:1.55;font-size:16px}
a{color:inherit}
img{max-width:100%;display:block}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px;border-radius:4px}
.skip{position:absolute;left:-9999px;top:8px;background:#fff;padding:8px 12px;z-index:10}
.skip:focus{left:8px}
.wrap{max-width:1120px;margin:0 auto;padding:0 20px}
header.top{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.94);backdrop-filter:saturate(1.5) blur(8px);border-bottom:1px solid var(--line)}
.bar{display:flex;align-items:center;justify-content:space-between;gap:12px;height:64px}
.logo{display:flex;align-items:center;gap:10px;font-weight:700;text-decoration:none;letter-spacing:-.01em;min-width:0}
.logo img{height:32px;width:auto}
.logo .mark{width:32px;height:32px;border-radius:8px;background:var(--brand);color:var(--on-brand);display:grid;place-items:center;font-size:14px;font-weight:800;flex:none}
.logo span.name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
nav.links{display:flex;align-items:center;gap:4px}
nav.links a{text-decoration:none;color:var(--muted);font-weight:500;padding:10px 10px;border-radius:8px;min-height:44px;display:inline-flex;align-items:center}
nav.links a:hover{color:var(--ink);background:var(--soft)}
nav.links .anchor{display:none}
@media (min-width:760px){nav.links .anchor{display:inline-flex}}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 22px;border-radius:10px;font-weight:650;text-decoration:none;border:1px solid transparent;font-size:16px;white-space:nowrap}
.btn.primary{background:var(--accent);color:var(--on-accent)}
.btn.primary:hover{filter:brightness(.95)}
.btn.ghost{border-color:var(--line);background:#fff;color:var(--ink)}
.btn.ghost:hover{border-color:var(--ink)}
.btn.small{min-height:44px;padding:0 16px;font-size:15px}
.hero{padding:56px 0 40px}
.hero .grid{display:grid;gap:40px;align-items:center}
@media (min-width:960px){.hero{padding:88px 0 64px}.hero .grid{grid-template-columns:1.1fr .9fr}}
.eyebrow{font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 12px}
h1{font-size:clamp(34px,6vw,58px);line-height:1.05;letter-spacing:-.03em;margin:0}
h2{font-size:clamp(26px,4vw,38px);line-height:1.15;letter-spacing:-.02em;margin:0 0 12px}
h3{font-size:18px;margin:0 0 6px;letter-spacing:-.01em}
.lede{font-size:clamp(17px,2.2vw,20px);color:var(--muted);margin:18px 0 28px;max-width:38em}
.ctas{display:flex;flex-wrap:wrap;gap:12px}
.fine{font-size:14px;color:var(--muted);margin:14px 0 0}
.mock{position:relative;background:linear-gradient(160deg,var(--soft),#fff);border:1px solid var(--line);border-radius:24px;padding:22px;display:grid;gap:14px}
.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 16px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.card .k{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.card .v{font-weight:650;margin-top:4px}
.photo{height:120px;border-radius:10px;background:linear-gradient(135deg,#dbe4ee,#eef2f6);margin-bottom:10px;position:relative;overflow:hidden}
.photo:after{content:"";position:absolute;left:18%;right:18%;bottom:0;height:58%;background:#c9d4df;clip-path:polygon(0 45%,50% 0,100% 45%,100% 100%,0 100%)}
.pill{display:inline-block;font-size:12px;font-weight:700;padding:3px 8px;border-radius:999px;background:var(--accent);color:var(--on-accent)}
.bubble{background:var(--brand);color:var(--on-brand);border-radius:16px 16px 4px 16px;padding:10px 14px;justify-self:end;max-width:85%}
.row{display:flex;justify-content:space-between;gap:10px;align-items:center}
.strip{border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:var(--soft)}
.strip p{margin:0;padding:18px 0;color:var(--muted);text-align:center;font-size:15px}
section.block{padding:64px 0}
@media (min-width:960px){section.block{padding:88px 0}}
.intro{max-width:44em;color:var(--muted);margin:0 0 32px;font-size:18px}
.features{display:grid;gap:16px;grid-template-columns:1fr;list-style:none;padding:0;margin:0}
@media (min-width:640px){.features{grid-template-columns:1fr 1fr}}
@media (min-width:960px){.features{grid-template-columns:1fr 1fr 1fr}}
.features li{border:1px solid var(--line);border-radius:16px;padding:22px}
.features li p{margin:0;color:var(--muted)}
.dot{width:36px;height:36px;border-radius:10px;background:var(--soft);border:1px solid var(--line);display:grid;place-items:center;margin-bottom:14px;font-weight:800;color:var(--brand)}
.steps{display:grid;gap:16px;list-style:none;padding:0;margin:0;counter-reset:s}
@media (min-width:760px){.steps{grid-template-columns:repeat(3,1fr)}}
.steps li{counter-increment:s;padding:22px;border-radius:16px;background:var(--soft)}
.steps li:before{content:counter(s);display:grid;place-items:center;width:32px;height:32px;border-radius:999px;background:var(--brand);color:var(--on-brand);font-weight:800;margin-bottom:12px}
.steps li p{margin:0;color:var(--muted)}
.tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:16px;-webkit-overflow-scrolling:touch}
table{border-collapse:collapse;width:100%;min-width:600px;font-size:15px}
th,td{text-align:left;padding:14px 16px;border-bottom:1px solid var(--line);vertical-align:top}
tbody tr:last-child th,tbody tr:last-child td{border-bottom:0}
thead th{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);background:var(--soft)}
td.us{font-weight:600}
tbody th{font-weight:600;width:28%}
.sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
.plans{display:grid;gap:16px;grid-template-columns:1fr}
@media (min-width:760px){.plans.many{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}}
.plan{border:1px solid var(--line);border-radius:16px;padding:26px;display:flex;flex-direction:column;gap:10px}
.plan.lead{border-color:var(--ink)}
.plan .price{font-size:34px;font-weight:800;letter-spacing:-.02em}
.plan .price small{font-size:15px;font-weight:500;color:var(--muted)}
.plan ul{margin:4px 0 8px;padding-left:20px;color:var(--muted)}
.plan .btn{margin-top:auto;align-self:flex-start}
.faq{display:grid;gap:12px;max-width:820px}
details{border:1px solid var(--line);border-radius:12px;padding:0 18px}
summary{cursor:pointer;font-weight:650;padding:16px 0;min-height:44px;list-style-position:outside}
details p{margin:0 0 16px;color:var(--muted)}
.final{background:var(--brand);color:var(--on-brand);border-radius:24px;padding:40px 24px;text-align:center}
.final p{opacity:.85;margin:8px 0 24px}
footer.foot{border-top:1px solid var(--line);padding:28px 0 40px;color:var(--muted);font-size:14px}
footer.foot .wrap{display:flex;flex-wrap:wrap;gap:12px 24px;justify-content:space-between}
footer.foot a{text-decoration:none}
footer.foot a:hover{text-decoration:underline}
`;

function css(id) {
  return CSS
    .replace('VAR_PRIMARY', id.primary_color)
    .replace('VAR_ON_PRIMARY', onColor(id.primary_color))
    .replace('VAR_ACCENT', id.accent_color)
    .replace('VAR_ON_ACCENT', onColor(id.accent_color));
}

function initials(name) {
  const words = String(name || '').split(/\s+/).map((w) => w.replace(/[^A-Za-z0-9]/g, '')).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'H';
}

function logoHtml(id) {
  const mark = id.logo_url
    ? `<img src="${esc(id.logo_url)}" alt="" width="32" height="32">`
    : `<span class="mark" aria-hidden="true">${esc(initials(id.short_name))}</span>`;
  return `<a class="logo" href="/" aria-label="${esc(id.name)} home">${mark}<span class="name">${esc(id.short_name)}</span></a>`;
}

function headHtml(id, { title, description, canonical, robots = 'index, follow' }) {
  const icon = id.icon_url || '/platform-icon.svg';
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: id.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description,
    ...(canonical ? { url: canonical } : {}),
    publisher: { '@type': 'Organization', name: id.legal_name },
  };
  return [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    `<meta name="robots" content="${esc(robots)}">`,
    `<meta name="theme-color" content="${esc(id.primary_color)}">`,
    canonical ? `<link rel="canonical" href="${esc(canonical)}">` : '',
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(id.name)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    canonical ? `<meta property="og:url" content="${esc(canonical)}">` : '',
    id.logo_url ? `<meta property="og:image" content="${esc(id.logo_url)}">` : '',
    '<meta name="twitter:card" content="summary">',
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    `<link rel="icon" href="${esc(icon)}">`,
    `<link rel="apple-touch-icon" href="${esc(icon)}">`,
    '<link rel="manifest" href="/manifest.webmanifest">',
    `<style>${css(id)}</style>`,
    robots.startsWith('index') ? `<script type="application/ld+json">${scriptJson(schema)}</script>` : '',
  ].filter(Boolean).join('\n');
}

function headerHtml(id) {
  return `<header class="top"><div class="wrap bar">
  ${logoHtml(id)}
  <nav class="links" aria-label="Main">
    <a class="anchor" href="/#features">Features</a>
    <a class="anchor" href="/#compare">Compare</a>
    <a class="anchor" href="/#pricing">Pricing</a>
    <a href="/admin">Sign in</a>
    <a class="btn primary small" href="/start">Start free trial</a>
  </nav>
</div></header>`;
}

function footerHtml(id) {
  const year = new Date().getFullYear();
  return `<footer class="foot"><div class="wrap">
  <span>&copy; ${year} ${esc(id.legal_name)}</span>
  <span>
    ${id.support_email ? `<a href="mailto:${esc(id.support_email)}">${esc(id.support_email)}</a> &middot; ` : ''}<a href="/admin">Sign in</a> &middot; <a href="/start">Start free trial</a>
  </span>
</div></footer>`;
}

const dollars = (cents) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: cents % 100 ? 2 : 0 })}`;

/** Plan cards from the live plan catalog (services/plans.js publicCatalog). */
function plansHtml(catalog, trialDays) {
  const plans = catalog?.plans || [];
  if (!plans.length) {
    return `<div id="plans" class="plans">
        <div class="plan lead">
          <h3>Start free for ${trialDays} days</h3>
          <p>Your branded site, home search app, CRM, AI follow-up and seller tools. Pick a plan any time before your trial ends.</p>
          <a class="btn primary" href="/start">Start free trial</a>
        </div>
      </div>`;
  }
  const mid = plans.length > 2 ? 1 : 0;
  const cards = plans.map((p, i) => `<div class="plan${i === mid ? ' lead' : ''}">
          <h3>${esc(p.name)}</h3>
          <div class="price">${dollars(p.month.base_cents)}<small> / month</small></div>
          <p>${esc(p.included)} agents included, then ${dollars(p.month.extra_cents)} per agent.</p>
          ${p.tagline ? `<p>${esc(p.tagline)}</p>` : ''}
          <a class="btn ${i === mid ? 'primary' : 'ghost'}" href="/start?plan=${encodeURIComponent(p.key)}">Start free trial</a>
        </div>`).join('\n        ');
  const yearly = Number(catalog.yearly_months) > 0 && Number(catalog.yearly_months) < 12
    ? ` Pay yearly and get ${12 - Number(catalog.yearly_months)} months free.` : '';
  const features = (catalog.features || []).length
    ? `<p class="intro">Every plan includes: ${(catalog.features || []).map(esc).join(' &middot; ')}.</p>` : '';
  return `<div id="plans" class="plans many">
        ${cards}
      </div>
      ${features}
      <p class="intro">${trialDays}-day free trial on every plan. No setup fee.${yearly}</p>`;
}

/** The product page for brokerages. */
export function renderPlatformHome(id = platformIdentity(), { trialDays = TRIAL_DAYS(), catalog = null } = {}) {
  const title = `${id.name}: home search, CRM and AI follow-up for brokerages`;
  const description = `Give buyers a branded home search app, give agents a CRM that says who to call, and let AI answer and follow up by text and email. ${trialDays}-day free trial.`;
  const canonical = id.marketing_url ? `${id.marketing_url}/` : null;
  const short = id.short_name;
  return `<!doctype html>
<html lang="en">
<head>
${headHtml(id, { title, description, canonical })}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${headerHtml(id)}
<main id="main">
  <section class="hero" aria-labelledby="hero-title">
    <div class="wrap grid">
      <div>
        <p class="eyebrow">For real estate brokerages</p>
        <h1 id="hero-title">Your home search, CRM and follow-up, under your own name.</h1>
        <p class="lede">Give buyers a home search app they come back to. Give agents a CRM that tells them who to call today. Let AI answer new leads in minutes and keep the conversation going by text and email.</p>
        <div class="ctas">
          <a class="btn primary" href="/start">Start free trial</a>
          <a class="btn ghost" href="#features">See what’s included</a>
        </div>
        <p class="fine">${trialDays} days free. No card to start. Live in an afternoon.</p>
      </div>
      <div class="mock" aria-hidden="true">
        <div class="card">
          <div class="photo"></div>
          <div class="row"><span class="pill">New match</span><span class="k">Saved search</span></div>
          <div class="v">3 bd · 2 ba · 1,850 sq ft</div>
        </div>
        <div class="card">
          <div class="k">Today</div>
          <div class="row"><span class="v">4 people to call</span><span class="k">Hot first</span></div>
        </div>
        <div class="bubble">Hi Sam, want to see it Saturday morning?</div>
      </div>
    </div>
  </section>

  <div class="strip"><div class="wrap"><p>One login instead of an IDX site, a buyer app, a CRM, a texting tool and a seller-nurture tool.</p></div></div>

  <section class="block" id="features" aria-labelledby="features-title">
    <div class="wrap">
      <h2 id="features-title">Everything a brokerage runs on, in one place</h2>
      <p class="intro">Built for brokerages that want their own brand in front of buyers and sellers, and one place for agents to work.</p>
      <ul class="features">
        ${FEATURES.map((f, i) => `<li><div class="dot" aria-hidden="true">${i + 1}</div><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></li>`).join('\n        ')}
      </ul>
    </div>
  </section>

  <section class="block" style="padding-top:0" aria-labelledby="how-title">
    <div class="wrap">
      <h2 id="how-title">Live in an afternoon</h2>
      <ol class="steps">
        ${STEPS.map(([t, p]) => `<li><h3>${esc(t)}</h3><p>${esc(p)}</p></li>`).join('\n        ')}
      </ol>
    </div>
  </section>

  <section class="block" id="compare" style="background:var(--soft)" aria-labelledby="compare-title">
    <div class="wrap">
      <h2 id="compare-title">How it compares</h2>
      <p class="intro">Most brokerages stitch several tools together. Here’s the same job with ${esc(short)}.</p>
      <div class="tablewrap" role="region" aria-labelledby="compare-title" tabindex="0">
        <table>
          <caption class="sr">The usual stack of tools compared with ${esc(short)}</caption>
          <thead><tr><th scope="col">What you need</th><th scope="col">The usual stack</th><th scope="col">${esc(short)}</th></tr></thead>
          <tbody>
            ${COMPARE.map(([need, usual, us]) => `<tr><th scope="row">${esc(need)}</th><td>${esc(usual)}</td><td class="us">${esc(us)}</td></tr>`).join('\n            ')}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="block" id="pricing" aria-labelledby="pricing-title">
    <div class="wrap">
      <h2 id="pricing-title">Pricing</h2>
      <p class="intro">Try everything free first. No card to start.</p>
      ${plansHtml(catalog, trialDays)}
    </div>
  </section>

  <section class="block" style="padding-top:0" aria-labelledby="faq-title">
    <div class="wrap">
      <h2 id="faq-title">Questions</h2>
      <div class="faq">
        ${faq(trialDays).map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n        ')}
      </div>
    </div>
  </section>

  <section class="block" style="padding-top:0">
    <div class="wrap">
      <div class="final">
        <h2>See it with your brand on it</h2>
        <p>Sign up, add your logo, and your site is live today.</p>
        <a class="btn primary" href="/start">Start free trial</a>
      </div>
    </div>
  </section>
</main>
${footerHtml(id)}
</body>
</html>`;
}

/** The platform's 404, with a way back. */
export function renderPlatformNotFound(id = platformIdentity()) {
  return `<!doctype html>
<html lang="en">
<head>
${headHtml(id, { title: `Page not found | ${id.name}`, description: 'This page isn’t here.', canonical: null, robots: 'noindex' })}
</head>
<body>
${headerHtml(id)}
<main id="main" class="wrap" style="padding:80px 20px;min-height:50vh">
  <h1 style="font-size:36px">Page not found</h1>
  <p class="lede">This page isn’t here. Try the home page, or start your free trial.</p>
  <div class="ctas"><a class="btn ghost" href="/">Home</a><a class="btn primary" href="/start">Start free trial</a></div>
</main>
${footerHtml(id)}
</body>
</html>`;
}

export function platformRobots(id = platformIdentity()) {
  const lines = ['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /agent', 'Disallow: /reset-password', 'Disallow: /api/'];
  if (id.marketing_url) lines.push(`Sitemap: ${id.marketing_url}/sitemap.xml`);
  return `${lines.join('\n')}\n`;
}

export function platformSitemap(id = platformIdentity()) {
  const base = id.marketing_url || '';
  const urls = ['/', '/start/'].map((p) => `  <url><loc>${esc(base)}${p}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

export function platformManifest(id = platformIdentity()) {
  const icon = id.icon_url || '/platform-icon.svg';
  return {
    name: id.name,
    short_name: id.short_name.slice(0, 12),
    description: 'Home search, CRM and AI follow-up for real estate brokerages.',
    id: '/',
    start_url: '/admin',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: id.primary_color,
    icons: [{ src: icon, sizes: id.icon_url ? '512x512' : 'any', ...(id.icon_url ? {} : { type: 'image/svg+xml' }), purpose: 'any' }],
  };
}

/**
 * The brand the app shell wears on platform pages (/start, the console):
 * the platform's name, its colors and icon. The identity rides along in the
 * page (window: #platform-identity) so the app needs no extra request.
 */
export function platformShellBrand(id = platformIdentity()) {
  return {
    name: id.name,
    tagline: 'Home search, CRM and AI follow-up for real estate brokerages, under your own brand.',
    primary_color: id.primary_color,
    icon_url: id.icon_url || '/platform-icon.svg',
  };
}

/** The identity the app reads from a platform page (see src/utils/platform.js). */
export function platformIdentityScript(hostname) {
  return `<script id="platform-identity" type="application/json">${scriptJson({ ...publicPlatform(), is_platform_host: isPlatformHost(hostname) })}</script>`;
}

/**
 * Express middleware for the marketing domain. Anything not on it passes
 * through untouched, so SAA's site is exactly as before.
 *   renderShell(indexHtml, brand, path, { platformHost }) → html  (server.js)
 *   renderIcon(brand) → svg                                       (server.js)
 */
export function platformSite({ distPath, renderShell, renderIcon }) {
  return async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api')) return next();
    await refreshPlatformIdentity();
    if (!isPlatformHost(req.hostname)) return next();
    const id = platformIdentity();
    const path = req.path;
    res.setHeader('Cache-Control', 'no-cache');
    switch (path) {
      case '/':
        res.setHeader('Cache-Control', 'public, max-age=300');
        let catalog = null;
        try {
          catalog = publicCatalog(await loadPlanCatalog());
        } catch { /* the free-trial card shows instead */ }
        return res.type('html').send(renderPlatformHome(id, { catalog }));
      case '/robots.txt':
        return res.type('text/plain').send(platformRobots(id));
      case '/sitemap.xml':
        return res.type('application/xml').send(platformSitemap(id));
      case '/manifest.webmanifest':
        return res.type('application/manifest+json').send(JSON.stringify(platformManifest(id), null, 2));
      case '/platform-icon.svg':
      case '/brand-icon.svg':
      case '/favicon.svg':
      case '/favicon.ico':
        return res.type('image/svg+xml').send(renderIcon({ name: id.short_name, primary_color: id.primary_color }));
      default:
        break;
    }
    if (PLATFORM_APP_PATHS.test(path)) {
      const index = join(distPath, 'index.html');
      if (!existsSync(index)) return next();
      return res.type('html').send(renderShell(readFileSync(index, 'utf8'), platformShellBrand(id), path, {
        platformHost: req.hostname,
        robots: /^\/start\/?$/.test(path) ? 'index, follow' : 'noindex',
      }));
    }
    // Built files (scripts, styles, images) serve as usual; no SAA page does.
    const ext = path.match(/\.([a-z0-9]+)$/i);
    if (ext && !['html', 'xml', 'txt'].includes(ext[1].toLowerCase()) && !path.startsWith('/embed')) return next();
    return res.status(404).type('html').send(renderPlatformNotFound(id));
  };
}
