/**
 * Widgets a brokerage pastes into WordPress, Squarespace or Wix, served from
 * its own domain:
 *
 *   /embed.js                 the loader: turns <div data-saa-embed="search"
 *                             data-city="Loveland"></div> into an iframe that
 *                             sizes itself to its content (postMessage)
 *   /embed/search             a search box
 *   /embed/listings           a grid of homes (city, min/max price, beds, type, count)
 *   /embed/listing/:slug      one featured home
 *   POST /api/embed/view      a view, logged in the brokerage's event stream
 *
 * Pages are small, self-contained HTML in the brokerage's colors. Homes come
 * from the same public listing API the site uses (so whatever that API shows
 * a brokerage, its widgets show). Every link opens the brokerage's own site
 * in a new tab with UTM tags. Only these responses may be framed anywhere
 * (Content-Security-Policy: frame-ancestors *).
 */
import logger from '../utils/logger.js';
import { resolveTenantForHost, tenantIdOf } from '../services/tenantContext.js';
import { brandFor } from '../services/brand.js';
import { recordEvent, ensureVisitorId } from '../services/events.js';

export const EMBED_WIDGETS = ['search', 'listings', 'listing'];
const CITY_RE = /^[A-Za-z0-9 .'\-,]{1,80}$/;
const SLUG_RE = /^[A-Za-z0-9-]{1,160}$/;
const TYPE_RE = /^[A-Za-z0-9 ,_-]{1,60}$/;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// JSON inside <script>: no closing tags, no line separators.
const scriptJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, '');

function hexOr(v, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(v || '')) ? v : fallback;
}

function onColor(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#111111' : '#ffffff';
}

/** Filters a widget accepts, cleaned. */
export function embedParams(query = {}) {
  const out = {};
  const city = String(query.city || '').trim();
  if (city && CITY_RE.test(city)) out.city = city;
  for (const k of ['minPrice', 'maxPrice', 'beds']) {
    const n = Number(query[k]);
    if (query[k] !== undefined && query[k] !== '' && Number.isFinite(n) && n > 0 && n < 1e9) out[k] = Math.round(n);
  }
  const type = String(query.type || '').trim().toLowerCase();
  if (type && TYPE_RE.test(type)) out.type = type;
  const count = Number(query.count);
  out.count = Number.isInteger(count) && count >= 1 && count <= 12 ? count : 6;
  const listing = String(query.listing || '').trim();
  if (listing && SLUG_RE.test(listing)) out.listing = listing;
  return out;
}

const STYLES = `
*{box-sizing:border-box}html,body{margin:0;padding:0;background:transparent}
body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#111827;font-size:15px;line-height:1.4}
a{color:inherit}
.w{padding:2px}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;border:0;border-radius:10px;background:var(--accent);color:var(--on-accent);font:600 15px/1 inherit;font-family:inherit;cursor:pointer;text-decoration:none;white-space:nowrap}
.btn:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.muted{color:#6b7280}.small{font-size:12px}
.by{margin-top:8px;font-size:12px;color:#6b7280;text-align:right}
.by a{text-decoration:none;font-weight:600;color:#374151}
/* search */
.search{padding:16px}
.search h2{margin:0 0 12px;font-size:18px}
.row{display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px}
.row input,.row select{width:100%;min-height:44px;border:1px solid #d1d5db;border-radius:10px;padding:0 12px;font:inherit;background:#fff;color:#111827}
@media (max-width:560px){.row{grid-template-columns:1fr 1fr}.row .grow{grid-column:1/-1}.row .btn{grid-column:1/-1}}
/* grid */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}
.home{display:block;text-decoration:none;color:inherit;transition:box-shadow .15s}
.home:hover{box-shadow:0 6px 20px rgba(0,0,0,.08)}
.ph{position:relative;aspect-ratio:4/3;background:#f3f4f6}
.ph img{width:100%;height:100%;object-fit:cover;display:block}
.tag{position:absolute;top:8px;left:8px;background:rgba(17,24,39,.85);color:#fff;font-size:11px;font-weight:700;padding:3px 7px;border-radius:6px;letter-spacing:.02em}
.info{padding:10px 12px 12px}
.price{font-size:18px;font-weight:700}
.facts{font-size:13px;color:#374151;margin-top:2px}
.addr{font-size:13px;color:#6b7280;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.courtesy{font-size:11px;color:#9ca3af;margin-top:6px}
.foot{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:14px;flex-wrap:wrap}
.skel{background:linear-gradient(90deg,#f3f4f6,#e5e7eb,#f3f4f6);background-size:200% 100%;animation:sh 1.2s infinite}
@keyframes sh{to{background-position:-200% 0}}
.empty{padding:28px 16px;text-align:center}
/* featured */
.feat{display:grid;grid-template-columns:1.3fr 1fr}
.feat .ph{aspect-ratio:auto;min-height:260px}
.feat .info{padding:20px;display:flex;flex-direction:column;gap:6px;justify-content:center}
.feat .price{font-size:26px}
@media (max-width:620px){.feat{grid-template-columns:1fr}.feat .ph{min-height:0;aspect-ratio:4/3}}
.disclaimer{font-size:11px;color:#9ca3af;margin-top:10px}
`;

// Shared browser code: links with UTM tags, height to the parent page, the view beacon.
const CLIENT_JS = `
(function(){
var C=window.__EMBED__;
var origin=location.origin;
function utm(u,content){var url=new URL(u,origin);url.searchParams.set('utm_source','embed');url.searchParams.set('utm_medium','widget');url.searchParams.set('utm_campaign',C.widget);var ref=C.ref;if(ref)url.searchParams.set('utm_content',ref);return url.toString();}
window.__link=utm;
function money(n){return n==null?'':'$'+Number(n).toLocaleString('en-US',{maximumFractionDigits:0});}
window.__money=money;
function post(){try{var h=Math.ceil(document.documentElement.getBoundingClientRect().height);parent.postMessage({type:'saa-embed:height',height:h},'*');}catch(e){}}
window.__resize=post;
if(window.ResizeObserver){new ResizeObserver(post).observe(document.documentElement);}else{setInterval(post,500);}
window.addEventListener('load',post);post();
try{C.ref=document.referrer?new URL(document.referrer).hostname:'';}catch(e){C.ref='';}
try{fetch('/api/embed/view',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({widget:C.widget,page:document.referrer||''}),keepalive:true,credentials:'omit'});}catch(e){}
})();
`;

function homeCardJs() {
  return `
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function addr(l){return [l.street_number,l.street_name,l.unit?('#'+l.unit):''].filter(Boolean).join(' ');}
function facts(l){var f=[];if(l.beds!=null)f.push(Number(l.beds)+' bd');if(l.baths!=null)f.push(Number(l.baths)+' ba');if(l.living_area)f.push(Number(l.living_area).toLocaleString('en-US')+' sq ft');return f.join(' · ');}
function courtesy(l){var c=l.attribution||l.courtesy||(l.list_office_name?('Listing courtesy of '+l.list_office_name):'');return c?'<div class="courtesy">'+esc(c)+'</div>':'';}
function sample(l){return (l.is_demo||l.demo||l.sample||l.is_sample)?'<span class="tag">Sample home</span>':'';}
function photo(l){return '/api/photo/'+encodeURIComponent(l.listing_id)+'/0';}
function homeUrl(l){return window.__link('/homes-for-sale/'+encodeURIComponent(l.slug||l.listing_id)+'/');}
`;
}

function page({ brand, widget, title, body, data, script }) {
  const primary = hexOr(brand.primary_color, '#111111');
  const accent = hexOr(brand.accent_color, '#2563eb');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>:root{--accent:${accent};--on-accent:${onColor(accent)};--primary:${primary}}${STYLES}</style></head>
<body><div class="w" id="w">${body}</div>
<script>window.__EMBED__=${scriptJson({ widget, ...data })};</script>
<script>${CLIENT_JS}</script>
${script ? `<script>${script}</script>` : ''}
</body></html>`;
}

function byLine(brand) {
  return `<div class="by">from <a href="#" data-home target="_blank" rel="noopener">${esc(brand.name)}</a></div>`;
}
const BY_JS = "document.querySelectorAll('[data-home]').forEach(function(a){a.href=window.__link('/');});";

function searchPage(brand, p) {
  const prices = [200000, 300000, 400000, 500000, 600000, 750000, 1000000, 1500000, 2000000];
  const opt = (v, label, sel) => `<option value="${v}"${sel ? ' selected' : ''}>${esc(label)}</option>`;
  const market = brand.market_name ? ` in ${brand.market_name}` : '';
  const body = `<form class="card search" id="f" role="search">
<h2>Search homes for sale${esc(market)}</h2>
<div class="row">
<label class="grow"><span class="sr" hidden>City, ZIP or neighborhood</span><input name="city" value="${esc(p.city || '')}" placeholder="City, ZIP or neighborhood" aria-label="City, ZIP or neighborhood" autocomplete="off"></label>
<select name="maxPrice" aria-label="Max price">${opt('', 'Any price', !p.maxPrice)}${prices.map((v) => opt(v, `Up to $${v >= 1000000 ? `${v / 1000000}M` : `${v / 1000}k`}`, p.maxPrice === v)).join('')}</select>
<select name="beds" aria-label="Bedrooms">${opt('', 'Any beds', !p.beds)}${[1, 2, 3, 4, 5].map((v) => opt(v, `${v}+ beds`, p.beds === v)).join('')}</select>
<button class="btn" type="submit">Search</button>
</div></form>${byLine(brand)}`;
  const script = `${BY_JS}
document.getElementById('f').addEventListener('submit',function(e){e.preventDefault();var fd=new FormData(e.target);var q=new URLSearchParams();
var c=(fd.get('city')||'').trim();if(c){if(/^\\d{5}$/.test(c))q.set('postal_code',c);else q.set('city',c);}
if(fd.get('maxPrice'))q.set('maxPrice',fd.get('maxPrice'));if(fd.get('beds'))q.set('beds',fd.get('beds'));
var C=window.__EMBED__;if(C.minPrice)q.set('minPrice',C.minPrice);if(C.type)q.set('types',C.type);
window.open(window.__link('/properties/'+(q.toString()?'?'+q.toString():'')),'_blank','noopener');});`;
  return page({ brand, widget: 'search', title: `${brand.name} — Search homes`, body, data: { minPrice: p.minPrice || null, type: p.type || null }, script });
}

function listingsPage(brand, p) {
  const skeleton = Array.from({ length: Math.min(p.count, 6) }).map(() => '<div class="card"><div class="ph skel"></div><div class="info"><div class="skel" style="height:18px;width:50%;border-radius:4px"></div><div class="skel" style="height:12px;width:80%;border-radius:4px;margin-top:8px"></div></div></div>').join('');
  const body = `<div class="grid" id="g" aria-live="polite">${skeleton}</div><div class="foot"><a class="btn" id="all" href="#" target="_blank" rel="noopener">See all homes</a><div class="by" style="margin:0">from <a href="#" data-home target="_blank" rel="noopener">${esc(brand.name)}</a></div></div><div class="disclaimer" id="disc"></div>`;
  const q = new URLSearchParams();
  if (p.city) q.set('city', p.city);
  if (p.minPrice) q.set('minPrice', String(p.minPrice));
  if (p.maxPrice) q.set('maxPrice', String(p.maxPrice));
  if (p.beds) q.set('beds', String(p.beds));
  if (p.type) q.set('types', p.type);
  const script = `${BY_JS}${homeCardJs()}
var C=window.__EMBED__;var g=document.getElementById('g');
document.getElementById('all').href=window.__link('/properties/'+(C.q?'?'+C.q:''));
fetch('/api/listings?'+(C.q?C.q+'&':'')+'limit='+C.count+'&sort=newest',{credentials:'omit'}).then(function(r){return r.json();}).then(function(d){
var rows=(d&&d.data)||[];var total=d&&d.meta&&d.meta.total;
if(total)document.getElementById('all').textContent='See all '+Number(total).toLocaleString('en-US')+' homes';
if(d&&d.meta&&d.meta.disclaimer)document.getElementById('disc').textContent=d.meta.disclaimer;
if(!rows.length){g.outerHTML='<div class="card empty"><p style="margin:0 0 4px;font-weight:600">No homes match right now</p><p class="muted" style="margin:0">New listings show up here as soon as they hit the market.</p></div>';window.__resize();return;}
g.innerHTML=rows.map(function(l){return '<a class="card home" target="_blank" rel="noopener" href="'+homeUrl(l)+'"><div class="ph"><img loading="lazy" alt="" src="'+photo(l)+'" onerror="this.style.display=\\'none\\'">'+sample(l)+'</div><div class="info"><div class="price">'+window.__money(l.list_price)+'</div><div class="facts">'+esc(facts(l))+'</div><div class="addr">'+esc(addr(l))+(l.city?', '+esc(l.city):'')+'</div>'+courtesy(l)+'</div></a>';}).join('');
window.__resize();
}).catch(function(){g.outerHTML='<div class="card empty muted">Homes couldn’t load. <a href="'+window.__link('/properties/')+'" target="_blank" rel="noopener">Search homes</a></div>';window.__resize();});`;
  return page({ brand, widget: 'listings', title: `${brand.name} — Homes for sale`, body, data: { q: q.toString(), count: p.count }, script });
}

function listingPage(brand, slug) {
  const body = `<div class="card feat" id="f"><div class="ph skel"></div><div class="info"><div class="skel" style="height:26px;width:60%;border-radius:4px"></div><div class="skel" style="height:14px;width:80%;border-radius:4px"></div></div></div>${byLine(brand)}`;
  const script = `${BY_JS}${homeCardJs()}
var C=window.__EMBED__;var f=document.getElementById('f');
function gone(){f.outerHTML='<div class="card empty"><p style="margin:0 0 10px;font-weight:600">This home is no longer available</p><a class="btn" target="_blank" rel="noopener" href="'+window.__link('/properties/')+'">See homes for sale</a></div>';window.__resize();}
if(!C.slug){gone();}else fetch('/api/listings/'+encodeURIComponent(C.slug),{credentials:'omit'}).then(function(r){return r.ok?r.json():null;}).then(function(d){var l=d&&d.data;if(!l){gone();return;}
f.innerHTML='<a class="ph" target="_blank" rel="noopener" href="'+homeUrl(l)+'"><img alt="" src="'+photo(l)+'" onerror="this.style.display=\\'none\\'">'+sample(l)+'</a><div class="info"><div class="price">'+window.__money(l.list_price)+'</div><div class="facts">'+esc(facts(l))+'</div><div class="addr" style="white-space:normal">'+esc(addr(l))+(l.city?', '+esc(l.city):'')+'</div>'+courtesy(l)+'<div style="margin-top:10px"><a class="btn" target="_blank" rel="noopener" href="'+homeUrl(l)+'">See this home</a></div></div>';
window.__resize();}).catch(gone);`;
  return page({ brand, widget: 'listing', title: `${brand.name} — Featured home`, body, data: { slug: slug || null }, script });
}

function frameable(res) {
  res.setHeader('Content-Security-Policy', 'frame-ancestors *');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

/** GET /embed/:widget and /embed/listing/:slug */
export const serveEmbedPage = async (req, res) => {
  const widget = String(req.params.widget || '').toLowerCase();
  if (!EMBED_WIDGETS.includes(widget)) return res.status(404).type('text/plain').send('Not found');
  frameable(res);
  try {
    const tenant = await resolveTenantForHost(req.hostname);
    const brand = brandFor(tenant);
    if (tenant.status !== 'active') {
      return res.status(503).type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>${esc(brand.name)}</title></head><body style="font-family:system-ui,sans-serif;color:#6b7280;font-size:14px"><p>This site is paused. Please contact the brokerage.</p></body></html>`);
    }
    const p = embedParams(req.query);
    let html;
    if (widget === 'search') html = searchPage(brand, p);
    else if (widget === 'listings') html = listingsPage(brand, p);
    else {
      const slug = String(req.params.slug || p.listing || '');
      html = listingPage(brand, SLUG_RE.test(slug) ? slug : null);
    }
    return res.status(200).type('html').send(html);
  } catch (error) {
    logger.error('embed page error', { message: error.message });
    return res.status(500).type('text/plain').send('Something went wrong.');
  }
};

const LOADER_JS = `/* Home search widgets. Paste <div data-saa-embed="search"></div> (or "listings", "listing") and this script. */
(function(){
var s=document.currentScript;var origin;try{origin=new URL(s&&s.src?s.src:location.href).origin;}catch(e){return;}
var frames=[];
var ATTRS={'city':'city','min-price':'minPrice','max-price':'maxPrice','beds':'beds','type':'type','count':'count','listing':'listing'};
var TITLES={search:'Search homes for sale',listings:'Homes for sale',listing:'Featured home'};
function mount(el){
if(el.getAttribute('data-saa-mounted'))return;
var type=String(el.getAttribute('data-saa-embed')||'search').toLowerCase();
if(!TITLES[type])return;
el.setAttribute('data-saa-mounted','1');
var q=[];for(var a in ATTRS){var v=el.getAttribute('data-'+a);if(v)q.push(ATTRS[a]+'='+encodeURIComponent(v));}
var f=document.createElement('iframe');
f.src=origin+'/embed/'+type+(q.length?'?'+q.join('&'):'');
f.title=TITLES[type];f.loading='lazy';f.setAttribute('scrolling','no');
f.style.cssText='display:block;width:100%;border:0;overflow:hidden;min-height:'+(type==='search'?'150':'360')+'px;background:transparent';
el.appendChild(f);frames.push(f);
}
function scan(){var els=document.querySelectorAll('[data-saa-embed]');for(var i=0;i<els.length;i++)mount(els[i]);}
window.addEventListener('message',function(e){
if(e.origin!==origin)return;var d=e.data;if(!d||d.type!=='saa-embed:height')return;
for(var i=0;i<frames.length;i++){if(frames[i].contentWindow===e.source){frames[i].style.minHeight='0';frames[i].style.height=Math.max(60,Math.ceil(Number(d.height)||0))+'px';}}
});
scan();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan);
if(window.MutationObserver)new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
})();
`;

/** GET /embed.js */
export const serveEmbedLoader = (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.send(LOADER_JS);
};

/** POST /api/embed/view { widget, page } */
export const recordEmbedView = async (req, res) => {
  const widget = String(req.body?.widget || '');
  if (!EMBED_WIDGETS.includes(widget)) return res.status(400).json({ error: 'Unknown widget' });
  let page = '';
  try {
    const u = new URL(String(req.body?.page || ''));
    if (/^https?:$/.test(u.protocol)) page = `${u.hostname}${u.pathname}`.slice(0, 200);
  } catch { page = ''; }
  await recordEvent({
    type: 'embed_view',
    visitorId: ensureVisitorId(req, res),
    source: 'embed',
    meta: { widget, page },
    tenantId: tenantIdOf(req),
  });
  return res.status(204).end();
};
