"""Market Fingerprint — living after-list page (agent console + seller view)."""
from __future__ import annotations

import json
from html import escape as _esc


def _json_script(data) -> str:
    raw = json.dumps(data, default=str, ensure_ascii=False)
    return raw.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")


def _notes_for_view(notes, *, agent: bool) -> list:
    rows = notes if isinstance(notes, list) else []
    out = []
    for item in rows:
        if not isinstance(item, dict) or not item.get("body"):
            continue
        status = str(item.get("status") or "draft")
        if not agent and status != "published":
            continue
        out.append({
            "as_of": str(item.get("as_of") or "")[:10],
            "body": str(item.get("body") or ""),
            "status": status,
            "published_at": str(item.get("published_at") or ""),
            "emailed_at": str(item.get("emailed_at") or ""),
        })
    return out


def render_fingerprint_html(view: dict, *, agent: bool = False) -> str:
    brief = view.get("brief") if isinstance(view.get("brief"), dict) else {}
    if not agent:
        brief = dict(brief)
        brief["notes"] = [
            n for n in (brief.get("notes") or [])
            if isinstance(n, dict) and n.get("status") == "published" and n.get("body")
        ]
    lock = view.get("lock") if isinstance(view.get("lock"), dict) else {}
    digest = brief.get("digest") if isinstance(brief.get("digest"), dict) else (view.get("digest") or {})
    addr = brief.get("subject_address") or "This listing"
    title = f"Market Fingerprint · {_esc(addr)}"
    data = {
        "agent": bool(agent),
        "brief": brief,
        "lock": lock,
        "digest": digest,
        "data_source": view.get("data_source") or "",
        "can_search_refresh": bool(view.get("can_search_refresh")),
        "needs_upload": bool(view.get("needs_upload")),
        "run_id": view.get("run_id") or "",
        "report_url": brief.get("report_url") or view.get("report_url") or "",
        "share_url": view.get("seller_url") or brief.get("share_url") or "",
        "fingerprint_url": brief.get("fingerprint_url") or "",
        "seller_access": lock.get("seller_access", True) is not False,
        "sold_at": lock.get("sold_at") or brief.get("sold_at") or "",
        "active_at": lock.get("active_at") or brief.get("active_at") or "",
        "active_at_source": lock.get("active_at_source") or "",
        "seller_name": lock.get("seller_name") or "",
        "seller_email": (lock.get("email") or {}).get("seller_email") or lock.get("seller_email") or "",
        "email": lock.get("email") if isinstance(lock.get("email"), dict) else {},
        "stale_upload": bool(brief.get("stale_upload") or view.get("stale_upload")),
        "agent_name": view.get("agent_name") or (brief.get("agent_name") if isinstance(brief, dict) else "") or "",
        "last_looked_at": view.get("last_looked_at") or lock.get("last_looked_at") or "",
        "notes": _notes_for_view(brief.get("notes") or view.get("notes") or [], agent=agent),
        "seller_got_weekly": bool(view.get("seller_got_weekly")),
    }
    return _PAGE.format(
        title=title,
        agent_class="is-agent" if agent else "is-seller",
        data_json=_json_script(data),
    )


_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root {{
  --ink:#0b1220; --navy:#0c3c6e; --muted:#5c6675; --line:#e6e0d4;
  --paper:#f7f4ee; --card:#fff; --gold:#c9a227; --teal:#0e7a6d;
  --under:#9b2c2c; --over:#0e7a6d;
}}
* {{ box-sizing:border-box; margin:0; padding:0; }}
body {{ font-family:Inter,system-ui,sans-serif; background:var(--paper); color:var(--ink); }}
a {{ color:var(--navy); }}
.wrap {{ max-width:1120px; margin:0 auto; padding:24px 20px 80px; }}
body.is-agent .wrap {{ max-width:1320px; display:grid; grid-template-columns:minmax(0,1fr) 320px; gap:24px; align-items:start; }}
@media (max-width:980px) {{ body.is-agent .wrap {{ grid-template-columns:1fr; }} }}
.hero {{
  background:linear-gradient(150deg, var(--ink), #16233c); color:#fff;
  border-radius:22px; padding:28px 28px 24px; display:grid; grid-template-columns:88px 1fr; gap:18px; align-items:center;
}}
.hero img {{ width:88px; height:88px; object-fit:cover; border-radius:16px; background:#1a2a44; }}
.hero .ph {{ width:88px; height:88px; border-radius:16px; background:#1a2a44; }}
.hero .kicker {{ font-size:.68rem; letter-spacing:.12em; text-transform:uppercase; color:#c9a227; font-weight:800; }}
.hero h1 {{ font-family:Fraunces,Georgia,serif; font-size:clamp(1.4rem,3vw,2rem); margin:4px 0 8px; }}
.hero .meta {{ color:#c8d2e0; font-size:.88rem; }}
.live {{ display:inline-flex; align-items:center; gap:6px; font-size:.72rem; font-weight:700; color:#8ee0c8; }}
.live i {{ width:7px; height:7px; border-radius:50%; background:#3dd6a5; animation:pulse 1.6s ease-in-out infinite; }}
@keyframes pulse {{ 50% {{ opacity:.35; }} }}
.archive {{ color:#f0d060; font-size:.78rem; font-weight:700; }}
.score {{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin:18px 0; }}
@media (max-width:800px) {{ .score {{ grid-template-columns:1fr 1fr 1fr; }} }}
.score .cell {{ background:#fff; border:1px solid var(--line); border-radius:14px; padding:12px 10px; text-align:center; }}
.score .v {{ font-family:Fraunces,Georgia,serif; font-size:1.45rem; font-weight:700; color:var(--navy); }}
.score .l {{ font-size:.68rem; color:var(--muted); font-weight:600; margin-top:4px; }}
.read {{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:16px 18px; margin-bottom:18px; }}
.read h2 {{ font-size:.72rem; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin-bottom:8px; }}
.read li {{ margin:6px 0 6px 1.1rem; font-size:.92rem; line-height:1.45; }}
.strip-wrap {{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:16px 18px 22px; margin-bottom:18px; }}
.strip-wrap h2 {{ font-family:Fraunces,Georgia,serif; font-size:1.15rem; margin-bottom:4px; }}
.strip-wrap .sub {{ color:var(--muted); font-size:.82rem; margin-bottom:8px; }}
.strip {{ position:relative; height:52px; }}
.strip .rail {{ position:absolute; left:0; right:0; top:24px; height:4px; background:#e8eef6; border-radius:99px; }}
.strip .tick {{ position:absolute; top:12px; width:10px; height:10px; border-radius:50%; background:#9fb0c6; transform:translateX(-50%); border:0; padding:0; appearance:none; -webkit-appearance:none; }}
.strip .tick.me {{ width:16px; height:16px; top:9px; background:var(--gold); box-shadow:0 0 0 4px #c9a22733; }}
.strip .lab {{ position:absolute; top:34px; font-size:.62rem; color:var(--muted); transform:translateX(-50%); white-space:nowrap; }}
.sec {{ margin:22px 0; }}
.sec h2 {{ font-family:Fraunces,Georgia,serif; font-size:1.25rem; margin-bottom:6px; }}
.sec .sub {{ color:var(--muted); font-size:.88rem; margin-bottom:12px; }}
.cards {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; }}
.card {{
  background:#fff; border:1px solid var(--line); border-radius:14px; overflow:hidden; cursor:pointer;
  display:flex; flex-direction:column; min-height:0;
}}
.card:hover {{ border-color:#c9d6e8; }}
.card .pic {{ height:128px; background:#dfe6ef center/cover no-repeat; }}
.card .pic.empty {{ display:flex; align-items:center; justify-content:center; color:#8a96a8; font-size:.72rem; }}
.card .body {{ padding:10px 12px 12px; }}
.card .tag {{ display:inline-block; font-size:.62rem; font-weight:800; letter-spacing:.06em; text-transform:uppercase; border-radius:99px; padding:3px 8px; margin-bottom:6px; }}
.tag-active {{ background:#e7f6f1; color:var(--teal); }}
.tag-pending,.tag-backup,.tag-firstright {{ background:#fff3e0; color:#e65100; }}
.tag-sold {{ background:#e8eef6; color:var(--navy); }}
.tag-gone {{ background:#f3f0ea; color:var(--muted); }}
.tag-under {{ background:#fde8e8; color:var(--under); }}
.tag-over {{ background:#e7f6f1; color:var(--over); }}
.card strong {{ display:block; font-size:.88rem; }}
.card .price {{ font-family:Fraunces,Georgia,serif; font-size:1.12rem; font-weight:700; margin:4px 0 2px; }}
.card .meta {{ font-size:.72rem; color:var(--muted); }}
.console {{
  background:#fff; border:1px solid var(--line); border-radius:18px; padding:18px;
  position:sticky; top:16px;
}}
body.is-seller .console {{ display:none; }}
.console h3 {{ font-family:Fraunces,Georgia,serif; font-size:1.1rem; margin-bottom:10px; }}
.console label {{ display:block; font-size:.72rem; font-weight:700; margin:10px 0 4px; }}
.console input, .console select {{ width:100%; padding:8px 10px; border:1px solid var(--line); border-radius:8px; font:inherit; }}
.console .who {{ display:flex; flex-wrap:wrap; gap:8px; font-size:.8rem; }}
.console .who label {{ font-weight:600; margin:0; display:flex; gap:4px; align-items:center; }}
.console button, .console .btn {{
  display:block; width:100%; margin-top:8px; padding:9px 12px; border-radius:10px; border:1px solid var(--line);
  background:#fff; font:inherit; font-weight:700; cursor:pointer; color:var(--navy); text-align:center; text-decoration:none;
}}
.console .btn-gold {{ background:var(--gold); border-color:transparent; color:#1a1200; }}
.console .status {{ font-size:.75rem; color:var(--muted); margin-top:8px; min-height:1.2em; }}
.links {{ display:flex; flex-wrap:wrap; gap:10px; margin-top:10px; font-size:.82rem; font-weight:700; }}
.drawer {{
  position:fixed; inset:0; background:rgba(11,18,32,.46); z-index:40; display:none; align-items:stretch; justify-content:flex-end;
}}
.drawer.open {{ display:flex; }}
.drawer .panel {{ width:min(420px,100%); background:#fff; padding:20px; overflow:auto; }}
.drawer .dpic {{ width:100%; height:220px; object-fit:cover; border-radius:12px; background:#eef2f7; }}
.drawer h3 {{ font-family:Fraunces,Georgia,serif; margin:12px 0 6px; }}
.drawer .close {{ float:right; border:0; background:transparent; font-size:1.4rem; cursor:pointer; }}
.note {{ font-size:.78rem; color:var(--muted); margin-top:8px; }}
.upload {{ display:none; }}
.weeks-wrap {{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:16px 18px; margin-bottom:18px; }}
.weeks-wrap h2 {{ font-family:Fraunces,Georgia,serif; font-size:1.15rem; margin-bottom:4px; }}
.weeks-wrap .sub {{ color:var(--muted); font-size:.82rem; margin-bottom:12px; }}
.weeks {{ display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; }}
.week {{
  flex:0 0 auto; min-width:156px; text-align:left; background:#f7f4ee; border:1px solid var(--line);
  border-radius:12px; padding:10px 12px; cursor:pointer; font:inherit;
}}
.week.is-on, .week:hover {{ border-color:var(--navy); background:#fff; }}
.week .w-d {{ display:block; font-size:.72rem; font-weight:800; color:var(--navy); }}
.week .w-m {{ display:block; font-size:.68rem; color:var(--muted); margin-top:4px; line-height:1.35; }}
.agent-note {{
  background:#fff; border:1px solid var(--line); border-left:4px solid var(--gold);
  border-radius:16px; padding:16px 18px; margin-bottom:14px;
}}
.agent-note h2 {{ font-family:Fraunces,Georgia,serif; font-size:1.15rem; }}
.agent-note .when {{ font-size:.75rem; color:var(--muted); margin:4px 0 10px; }}
.agent-note .body {{ font-size:.95rem; line-height:1.5; }}
.note-tl {{ margin:0 0 18px; }}
.note-tl-item {{ background:#fff; border:1px solid var(--line); border-radius:12px; padding:12px 14px; margin-top:8px; font-size:.88rem; }}
.note-tl-item strong {{ display:block; font-size:.72rem; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); margin-bottom:6px; }}
.read .fact {{ font-size:.72rem; color:var(--muted); margin-top:8px; }}
.console textarea {{ width:100%; min-height:96px; padding:8px 10px; border:1px solid var(--line); border-radius:8px; font:inherit; resize:vertical; }}
.console .starters {{ display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }}
.console .starter {{ width:auto; display:inline-block; margin-top:0; padding:5px 8px; font-size:.68rem; }}
.console .cadence {{ font-size:.75rem; color:var(--muted); margin:8px 0 0; }}
.console .check {{ display:flex; align-items:center; gap:6px; font-size:.78rem; font-weight:600; margin:10px 0 0; }}
.console .note-console.is-focus {{ box-shadow:0 0 0 3px #c9a22755; border-radius:12px; padding:8px; margin:8px -8px 0; }}
.console .check-hint {{ font-size:.72rem; color:var(--muted); font-weight:500; margin:4px 0 0 22px; line-height:1.35; }}
.card.is-week {{ border-color:var(--gold); box-shadow:0 0 0 2px #c9a22755; }}
.week-homes {{ margin-top:14px; }}
.week-homes h3 {{ font-size:.72rem; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin-bottom:8px; }}
.week-homes .cards {{ grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); }}
.spark {{ margin:8px 0 14px; }}
.spark svg {{ display:block; max-width:280px; }}
.spark .cap {{ font-size:.72rem; color:var(--muted); margin-top:4px; }}
.lanes {{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:16px 18px; margin-bottom:18px; }}
.lanes h2 {{ font-family:Fraunces,Georgia,serif; font-size:1.15rem; margin-bottom:4px; }}
.lanes > .sub {{ color:var(--muted); font-size:.82rem; margin-bottom:12px; }}
.lane {{ margin-top:10px; }}
.lane h3 {{ font-size:.72rem; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); margin-bottom:6px; }}
.lane-row {{ display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; }}
.lane-home {{
  flex:0 0 auto; width:148px; padding:0; border:1px solid var(--line); border-radius:12px;
  overflow:hidden; background:#fff; cursor:pointer; text-align:left; font:inherit; color:inherit;
  appearance:none; -webkit-appearance:none;
}}
.lane-home.is-week {{ border-color:var(--gold); box-shadow:0 0 0 2px #c9a22755; }}
.lane-home.is-pin {{ border-color:var(--navy); box-shadow:0 0 0 2px #0c3c6e44; }}
.lane-pic {{ display:block; width:100%; height:86px; background:#dfe6ef center/cover no-repeat; }}
.lane-pic.empty {{ background:#e8eef4; }}
.lane-meta {{ padding:7px 8px 8px; }}
.lane-meta .p {{ font-family:Fraunces,Georgia,serif; font-size:.95rem; font-weight:700; }}
.lane-meta .m {{ font-size:.68rem; color:var(--muted); margin-top:2px; line-height:1.35; }}
.sorts {{ display:flex; flex-wrap:wrap; gap:6px; margin:4px 0 10px; align-items:center; }}
.sorts span {{ font-size:.68rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); margin-right:4px; }}
.sorts button {{
  width:auto; margin:0; padding:5px 10px; border-radius:99px; border:1px solid var(--line);
  background:#f7f4ee; font:inherit; font-size:.72rem; font-weight:700; cursor:pointer; color:var(--navy);
}}
.sorts button.is-on {{ background:var(--navy); color:#fff; border-color:var(--navy); }}
.board {{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:14px 16px 12px; margin-bottom:18px; }}
.board table {{ width:100%; border-collapse:collapse; }}
.board th, .board td {{ padding:8px 6px; text-align:center; }}
.board th {{ font-size:.68rem; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); font-weight:700; }}
.board td.row {{ text-align:left; font-size:.82rem; font-weight:700; color:var(--navy); }}
.board .n {{ font-family:Fraunces,Georgia,serif; font-size:1.35rem; font-weight:700; color:var(--navy); }}
.board .hint {{ font-size:.78rem; color:var(--muted); margin-top:8px; }}
.strip {{ position:relative; height:88px; }}
.strip .tick {{ cursor:pointer; }}
.strip .tick.is-pin {{ background:var(--navy); }}
.strip-pin {{
  position:absolute; z-index:4; width:210px; background:#fff; border:1px solid var(--line);
  border-radius:12px; box-shadow:0 10px 28px rgba(11,18,32,.14); padding:8px; display:none;
  transform:translateX(-50%); bottom:48px; text-align:left;
}}
.strip-pin.open {{ display:block; }}
.strip-pin img, .strip-pin .ph {{ width:100%; height:92px; object-fit:cover; border-radius:8px; background:#eef2f7; display:block; }}
.strip-pin strong {{ display:block; font-size:.82rem; margin-top:6px; }}
.strip-pin .p {{ font-family:Fraunces,Georgia,serif; font-size:1rem; font-weight:700; }}
.strip-pin .m {{ font-size:.68rem; color:var(--muted); margin-top:2px; }}
.card.is-pin {{ border-color:var(--navy); box-shadow:0 0 0 2px #0c3c6e44; }}
</style>
</head>
<body class="{agent_class}">
<div class="wrap">
  <main id="main"></main>
  <aside class="console" id="console"></aside>
</div>
<div class="drawer" id="drawer" hidden>
  <div class="panel">
    <button type="button" class="close" id="drawerClose" aria-label="Close">&times;</button>
    <div id="drawerBody"></div>
  </div>
</div>
<script>
const DATA = {data_json};
function money(n) {{
  const v = Number(n || 0);
  if (!v) return '—';
  return '$' + Math.round(v).toLocaleString();
}}
function esc(s) {{
  return String(s || '').replace(/[&<>"']/g, function (c) {{
    return ({{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}})[c];
  }});
}}
function tagClass(st) {{
  const s = String(st || '').toLowerCase();
  if (s === 'active') return 'tag-active';
  if (s === 'pending' || s === 'backup' || s === 'firstright' || s.indexOf('contract') >= 0) return 'tag-pending';
  if (s === 'sold') return 'tag-sold';
  if (s === 'gone') return 'tag-gone';
  if (s === 'under') return 'tag-under';
  if (s === 'over') return 'tag-over';
  return '';
}}
function cardHtml(c, extraTag) {{
  const pic = c.photo_url
    ? '<div class="pic" style="background-image:url(\\'' + String(c.photo_url).replace(/'/g, '%27') + '\\')"></div>'
    : '<div class="pic empty">No photo</div>';
  const st = extraTag || c.status || '';
  const bits = [];
  if (c.beds) bits.push(c.beds + ' bd');
  if (c.baths) bits.push(c.baths + ' ba');
  if (c.sqft) bits.push(Number(c.sqft).toLocaleString() + ' sf');
  if (c.delta) bits.push((c.delta > 0 ? '+' : '') + money(Math.abs(c.delta)).replace('$','') + ' vs lock');
  if (c.was_price && c.was_price !== c.price) bits.push(money(c.was_price) + ' → ' + money(c.price));
  if (c.rank_then && c.rank) bits.push('rank ' + c.rank_then + ' → ' + c.rank);
  else if (c.rank) bits.push('#' + c.rank);
  return '<article class="card" data-id="' + esc(c.id) + '">' + pic +
    '<div class="body"><span class="tag ' + tagClass(st) + '">' + esc(st || 'Listing') + '</span>' +
    '<strong>' + esc(c.address || 'Listing') + '</strong>' +
    '<div class="price">' + money(c.price) + '</div>' +
    '<div class="meta">' + esc(bits.join(' · ')) + '</div></div></article>';
}}
function byId(id) {{
  const b = DATA.brief || {{}};
  const pools = [b.still_active, b.new_under, b.new_over, b.baseline, b.went_pending, b.went_sold, b.cheaper_active, b.price_cuts, b.gone];
  for (const pool of pools) {{
    for (const c of (pool || [])) if (c && c.id === id) return c;
  }}
  return null;
}}
function weekKey(v) {{
  return String(v || '').slice(0, 10);
}}
function weekLabel(asOf) {{
  const raw = weekKey(asOf);
  const d = new Date(raw + 'T12:00:00');
  if (isNaN(d.getTime())) return esc(raw || '—');
  return d.toLocaleDateString(undefined, {{ month: 'short', day: 'numeric' }});
}}
function noteForWeek(asOf) {{
  const key = weekKey(asOf);
  return (DATA.notes || []).find(n => weekKey(n.as_of) === key) || null;
}}
function isUc(st) {{
  const s = String(st || '').toLowerCase();
  return s === 'pending' || s === 'backup' || s === 'firstright' || s === 'under contract';
}}
function clockKind() {{
  const d = DATA.digest || (DATA.brief || {{}}).digest || {{}};
  if ((d.clock || '') === 'active' || DATA.active_at) return 'active';
  return 'generate';
}}
function sinceLabel() {{
  return clockKind() === 'active' ? 'since active' : 'since generate';
}}
let laneSort = 'price';
function sortVal(c, by) {{
  if (by === 'sqft') return Number(c.sqft || 0);
  if (by === 'beds') return Number(c.beds || 0);
  if (by === 'baths') return Number(c.baths || 0);
  return Number(c.price || c.was_price || 0);
}}
function sortedRows(rows, by) {{
  return (rows || []).slice().sort(function (a, b) {{
    return sortVal(a, by) - sortVal(b, by);
  }});
}}
function homeBits(c) {{
  const bits = [];
  if (c.beds) bits.push(Number(c.beds) + ' bd');
  if (c.baths) bits.push(Number(c.baths) + ' ba');
  if (c.sqft) bits.push(Number(c.sqft).toLocaleString() + ' sf');
  return bits.join(' · ');
}}
function sortsHtml(id) {{
  const keys = [['price','Price'],['sqft','Sq ft'],['beds','Beds'],['baths','Baths']];
  return '<div class="sorts" data-sort-for="' + id + '"><span>Sort</span>' +
    keys.map(function (k) {{
      return '<button type="button" data-sort="' + k[0] + '"' + (laneSort === k[0] ? ' class="is-on"' : '') + '>' + k[1] + '</button>';
    }}).join('') + '</div>';
}}
function inWeek(dateStr, start, end) {{
  const d = weekKey(dateStr);
  if (!d || !start) return false;
  if (d < start) return false;
  if (end && d >= end) return false;
  return true;
}}
function weekWindows() {{
  const hist = ((DATA.brief || {{}}).history || []).slice().sort(function (a, b) {{
    return weekKey(a.as_of).localeCompare(weekKey(b.as_of));
  }});
  return hist.map(function (w, i) {{
    return {{
      as_of: weekKey(w.as_of),
      start: weekKey(w.as_of),
      end: hist[i + 1] ? weekKey(hist[i + 1].as_of) : ''
    }};
  }});
}}
function cardMovedInWeek(c, start, end) {{
  if (!c) return false;
  const hist = c.status_history || [];
  for (let i = 0; i < hist.length; i++) {{
    const st = hist[i].status;
    if ((isUc(st) || String(st || '').toLowerCase() === 'sold') && inWeek(hist[i].as_of, start, end)) return true;
  }}
  return !!(c.list_date && inWeek(c.list_date, start, end));
}}
function weekCounts(asOf) {{
  const wins = weekWindows();
  const key = weekKey(asOf);
  const w = wins.find(function (x) {{ return x.as_of === key; }}) || wins[wins.length - 1];
  const out = {{ listed: 0, uc: 0, sold: 0 }};
  if (!w) return out;
  homesForWeek(w.as_of).forEach(function (c) {{
    if (c.list_date && inWeek(c.list_date, w.start, w.end)) out.listed += 1;
    const hist = c.status_history || [];
    let sold = false;
    let uc = false;
    for (let i = 0; i < hist.length; i++) {{
      if (!inWeek(hist[i].as_of, w.start, w.end)) continue;
      const st = String(hist[i].status || '').toLowerCase();
      if (st === 'sold') sold = true;
      else if (isUc(st)) uc = true;
    }}
    if (sold) out.sold += 1;
    else if (uc) out.uc += 1;
  }});
  return out;
}}
function homesForWeek(asOf) {{
  const wins = weekWindows();
  const key = weekKey(asOf);
  const w = wins.find(function (x) {{ return x.as_of === key; }}) || wins[wins.length - 1];
  if (!w) return [];
  const b = DATA.brief || {{}};
  const seen = {{}};
  const out = [];
  const pools = [b.baseline, b.new_under, b.new_over, b.went_pending, b.went_sold, b.pending_now];
  for (let p = 0; p < pools.length; p++) {{
    const pool = pools[p] || [];
    for (let i = 0; i < pool.length; i++) {{
      const c = pool[i];
      if (!c || !c.id || seen[c.id]) continue;
      if (cardMovedInWeek(c, w.start, w.end)) {{
        seen[c.id] = 1;
        out.push(c);
      }}
    }}
  }}
  return out;
}}
function sparklineHtml() {{
  const hist = ((DATA.brief || {{}}).history || []);
  if (hist.length < 2) return '';
  const cheaper = hist.map(function (w) {{ return Number(w.still_active_cheaper || 0); }});
  const ranks = hist.map(function (w) {{ return Number(w.rank || 0); }});
  function poly(vals, color) {{
    const max = Math.max.apply(null, vals.concat([1]));
    const min = Math.min.apply(null, vals);
    const span = Math.max(max - min, 1);
    const pts = vals.map(function (v, i) {{
      const x = 6 + (vals.length < 2 ? 0 : i / (vals.length - 1) * 200);
      const y = 38 - ((v - min) / span) * 30;
      return x.toFixed(1) + ',' + y.toFixed(1);
    }}).join(' ');
    return '<polyline fill="none" stroke="' + color + '" stroke-width="2" points="' + pts + '"/>';
  }}
  return '<div class="spark"><svg viewBox="0 0 212 48" width="212" height="48" aria-hidden="true">' +
    poly(cheaper, '#0e7a6d') + poly(ranks, '#c9a227') + '</svg>' +
    '<p class="cap">Teal: still cheaper than you · Gold: your rank among similar actives. Same lock.</p></div>';
}}
function lanesHtml() {{
  const rows = sortedRows(((DATA.brief || {{}}).baseline || []), laneSort);
  if (!rows.length) return '';
  const active = [];
  const pending = [];
  const sold = [];
  for (let i = 0; i < rows.length; i++) {{
    const c = rows[i];
    const st = String(c.status || '').toLowerCase();
    if (st === 'sold') sold.push(c);
    else if (st === 'pending' || st === 'backup' || st === 'firstright') pending.push(c);
    else if (st !== 'gone') active.push(c);
  }}
  function laneHome(c) {{
    const pic = c.photo_url
      ? 'style="background-image:url(\\'' + String(c.photo_url).replace(/'/g, '%27') + '\\')"'
      : '';
    return '<button type="button" class="lane-home" data-id="' + esc(c.id) + '" title="' + esc(c.address || '') + '">' +
      '<span class="lane-pic' + (c.photo_url ? '' : ' empty') + '" ' + pic + '></span>' +
      '<span class="lane-meta"><span class="p">' + money(c.price) + '</span>' +
      '<span class="m">' + esc(homeBits(c) || (c.address || '')) + '</span></span></button>';
  }}
  function lane(title, items) {{
    if (!items.length) return '';
    return '<div class="lane"><h3>' + esc(title) + ' · ' + items.length + '</h3><div class="lane-row">' +
      items.map(laneHome).join('') + '</div></div>';
  }}
  const when = clockKind() === 'active' ? 'when this home went active' : 'when this Fingerprint was generated';
  return '<div class="lanes" id="day0Lanes"><h2>Where they are now</h2>' +
    '<p class="sub">The similar actives from ' + when + '. Price order by default — sort by size or beds/baths. Hover a home on the strip below to light it up here.</p>' +
    sortsHtml('lanes') +
    lane('Still active', active) + lane('Under contract', pending) + lane('Sold since ' + (clockKind() === 'active' ? 'active' : 'generate'), sold) + '</div>';
}}
function weekHomesHtml(asOf) {{
  const homes = homesForWeek(asOf);
  if (!homes.length) {{
    return '<div class="week-homes" id="weekHomes"><h3>Homes this week</h3>' +
      '<p class="sub">Nothing listed, under contract, or sold in this week.</p></div>';
  }}
  return '<div class="week-homes" id="weekHomes"><h3>Homes this week · ' + homes.length + '</h3>' +
    '<p class="sub">Newly listed, went under contract, or sold in this week. Pending and under contract are the same.</p>' +
    '<div class="cards">' + homes.map(function (c) {{ return cardHtml(c, c.status); }}).join('') + '</div></div>';
}}
function applyWeekHighlight(asOf) {{
  const wins = weekWindows();
  const key = weekKey(asOf);
  const w = wins.find(function (x) {{ return x.as_of === key; }}) || wins[wins.length - 1];
  const ids = {{}};
  if (w) {{
    homesForWeek(w.as_of).forEach(function (c) {{ ids[c.id] = 1; }});
  }}
  document.querySelectorAll('.card[data-id], .lane-home[data-id]').forEach(function (el) {{
    el.classList.toggle('is-week', !!ids[el.getAttribute('data-id')]);
  }});
}}
function selectWeek(asOf, scroll) {{
  const key = weekKey(asOf);
  document.querySelectorAll('.week').forEach(function (el) {{
    el.classList.toggle('is-on', el.getAttribute('data-asof') === key);
  }});
  const box = document.getElementById('weekHomes');
  if (box) box.outerHTML = weekHomesHtml(key);
  applyWeekHighlight(key);
  document.querySelectorAll('#weekHomes .card').forEach(function (el) {{
    el.addEventListener('click', function () {{ openDrawer(el.getAttribute('data-id')); }});
  }});
  if (scroll) {{
    const homes = document.getElementById('weekHomes');
    if (homes) homes.scrollIntoView({{ behavior: 'smooth', block: 'nearest' }});
    const note = document.getElementById('note-' + key);
    if (note) note.scrollIntoView({{ behavior: 'smooth', block: 'center' }});
  }}
  if (DATA.agent) loadNoteWeek(key);
}}
function weeksHtml() {{
  const hist = ((DATA.brief || {{}}).history || []);
  if (!hist.length) return '';
  const current = weekKey((DATA.brief || {{}}).as_of) || weekKey(hist[hist.length - 1].as_of);
  return '<div class="weeks-wrap"><h2>Week by week</h2>' +
    '<p class="sub">Each week vs the last refresh: new lists, under contract (same as pending), and sold. Click a week to see those homes.</p>' +
    sparklineHtml() +
    '<div class="weeks">' + hist.map(function (w) {{
      const asOf = weekKey(w.as_of);
      const rank = (w.rank && w.rank_of) ? (w.rank + '/' + w.rank_of) : '—';
      const on = asOf === current ? ' is-on' : '';
      const wc = weekCounts(asOf);
      return '<button type="button" class="week' + on + '" data-asof="' + esc(asOf) + '" id="week-' + esc(asOf) + '">' +
        '<span class="w-d">Week of ' + weekLabel(asOf) + '</span>' +
        '<span class="w-m">' + Number(wc.listed || w.listed_week || 0) + ' listed · ' +
        Number(wc.uc || w.uc_week || 0) + ' under contract · ' +
        Number(wc.sold || w.sold_week || 0) + ' sold</span>' +
        '<span class="w-m">#' + esc(rank) + ' · ' + Number(w.still_active_cheaper || 0) + ' cheaper</span></button>';
    }}).join('') + '</div>' + weekHomesHtml(current) + '</div>';
}}
function publishedNotesHtml() {{
  const notes = (DATA.notes || []).filter(n => n.status === 'published' && n.body);
  if (!notes.length) return '';
  const who = DATA.agent_name || 'your agent';
  const sorted = notes.slice().sort((a, b) => weekKey(b.as_of).localeCompare(weekKey(a.as_of)));
  const latest = sorted[0];
  const older = sorted.slice(1);
  let html = '<div class="agent-note" id="note-' + esc(weekKey(latest.as_of)) + '">' +
    '<h2>From ' + esc(who) + '</h2>' +
    '<p class="when">Week of ' + weekLabel(latest.as_of) +
    (latest.published_at ? ' · shared ' + weekLabel(latest.published_at) : '') + '</p>' +
    '<p class="body">' + esc(latest.body) + '</p></div>';
  if (older.length) {{
    html += '<div class="note-tl">' + older.map(n =>
      '<div class="note-tl-item" id="note-' + esc(weekKey(n.as_of)) + '">' +
      '<strong>Week of ' + weekLabel(n.as_of) + '</strong><p>' + esc(n.body) + '</p></div>'
    ).join('') + '</div>';
  }}
  return html;
}}
function bindWeeks() {{
  document.querySelectorAll('.week').forEach(el => {{
    el.addEventListener('click', () => {{
      selectWeek(el.getAttribute('data-asof'), true);
    }});
  }});
}}
function loadNoteWeek(asOf) {{
  const ta = document.getElementById('agentNote');
  const weekEl = document.getElementById('noteWeek');
  if (weekEl) weekEl.value = weekKey(asOf);
  const note = noteForWeek(asOf);
  if (ta) {{
    ta.value = note && note.body ? note.body : '';
    updateNoteCount();
  }}
  const badge = document.getElementById('noteState');
  if (badge) {{
    badge.textContent = note && note.status === 'published' ? 'Shared with seller' : 'Draft — seller cannot see this';
  }}
}}
function updateNoteCount() {{
  const ta = document.getElementById('agentNote');
  const el = document.getElementById('noteCount');
  if (el && ta) el.textContent = (ta.value || '').length + ' / 500';
}}
function scoreboardHtml(d) {{
  const since = sinceLabel();
  const listedSince = Number(d.listed_since != null ? d.listed_since : ((d.new_under || 0) + (d.new_over || 0)));
  const ucSince = Number(d.uc_since != null ? d.uc_since : d.went_pending || 0);
  const soldSince = Number(d.sold_since != null ? d.sold_since : d.went_sold || 0);
  const rows = [
    ['Listed', listedSince, d.listed_week],
    ['Under contract', ucSince, d.uc_week],
    ['Sold', soldSince, d.sold_week]
  ];
  const clockHint = clockKind() === 'active'
    ? 'Since this home went active, plus what moved since the last weekly refresh. Pending and under contract are the same.'
    : 'Not listed yet — counts are since generate. Set the listed date (or we pick it up when this address goes Active) and the board switches to since active.';
  return '<div class="board"><table><thead><tr><th></th><th>' + esc(since) + '</th><th>This week</th></tr></thead><tbody>' +
    rows.map(function (r) {{
      return '<tr><td class="row">' + r[0] + '</td><td><div class="n">' + (r[1] == null || r[1] === '' ? '—' : r[1]) + '</div></td><td><div class="n">' + (r[2] == null || r[2] === '' ? '0' : r[2]) + '</div></td></tr>';
    }}).join('') + '</tbody></table><p class="hint">' + clockHint + '</p></div>' +
    '<div class="score">' +
      [['v', (d.active_count != null && d.baseline_active != null) ? (d.active_count + ' / ' + d.baseline_active) : (d.active_count ?? '—'), 'Active now vs then'],
       ['v', d.still_active_cheaper, 'Still cheaper than you'],
       ['v', (d.rank && d.rank_of) ? (d.rank + ' / ' + d.rank_of) : '—', 'Your price rank']
      ].map(x => '<div class="cell"><div class="v">' + (x[1] == null || x[1] === '' ? '—' : x[1]) + '</div><div class="l">' + x[2] + '</div></div>').join('') +
    '</div>';
}}
function stripHtml(pos, d) {{
  const ordered = sortedRows(pos || [], laneSort);
  const prices = ordered.map(p => p.price).filter(Boolean);
  const lo = Math.min.apply(null, prices.concat([d.locked_price || 0]));
  const hi = Math.max.apply(null, prices.concat([d.locked_price || 0]));
  const span = Math.max(hi - lo, 1);
  const ticks = ordered.slice(0, 24).map(function (p, i) {{
    const pct = laneSort === 'price'
      ? 4 + 92 * ((p.price - lo) / span)
      : (ordered.length < 2 ? 50 : 4 + 92 * i / (Math.min(ordered.length, 24) - 1));
    return '<button type="button" class="tick' + (p.subject ? ' me' : '') + '" data-id="' + esc(p.id || '') + '" style="left:' + pct + '%" aria-label="' + esc(p.address || 'Listing') + '"></button>' +
      (p.subject ? '<span class="lab" style="left:' + pct + '%">' + money(p.price) + '</span>' : '');
  }}).join('');
  return '<div class="strip-wrap" id="sitStrip"><h2>Where you sit among similar actives</h2>' +
    '<p class="sub">Hover a pin for beds, baths, and square feet — it lights up in Where they are now when that home is in the original set. Default order is price.</p>' +
    sortsHtml('strip') +
    '<div class="strip" id="priceStrip"><div class="rail"></div>' + ticks + '<div class="strip-pin" id="stripPin"></div></div></div>';
}}
function pinCardHtml(p) {{
  if (!p) return '';
  const pic = p.photo_url
    ? '<img src="' + esc(p.photo_url) + '" alt="">'
    : '<div class="ph"></div>';
  return pic + '<strong>' + esc(p.subject ? 'Your list' : (p.address || 'Listing')) + '</strong>' +
    '<div class="p">' + money(p.price) + '</div>' +
    '<div class="m">' + esc(homeBits(p) || p.status || '') + '</div>';
}}
function positionById(id) {{
  const pos = ((DATA.brief || {{}}).position || []);
  return pos.find(function (p) {{ return String(p.id) === String(id); }}) || byId(id);
}}
function showPin(id, tickEl) {{
  const pin = document.getElementById('stripPin');
  const p = positionById(id);
  document.querySelectorAll('.tick, .lane-home, .card').forEach(function (el) {{
    el.classList.toggle('is-pin', el.getAttribute('data-id') === String(id));
  }});
  if (!pin || !p) return;
  pin.innerHTML = pinCardHtml(p);
  pin.classList.add('open');
  if (tickEl) {{
    const strip = document.getElementById('priceStrip');
    const left = tickEl.offsetLeft;
    const max = strip ? strip.clientWidth - 105 : left;
    pin.style.left = Math.max(105, Math.min(left, max)) + 'px';
  }}
}}
function hidePin() {{
  const pin = document.getElementById('stripPin');
  if (pin) pin.classList.remove('open');
  document.querySelectorAll('.is-pin').forEach(function (el) {{ el.classList.remove('is-pin'); }});
}}
function bindPins() {{
  document.querySelectorAll('#priceStrip .tick').forEach(function (el) {{
    el.addEventListener('mouseenter', function () {{ showPin(el.getAttribute('data-id'), el); }});
    el.addEventListener('focus', function () {{ showPin(el.getAttribute('data-id'), el); }});
    el.addEventListener('click', function (ev) {{
      ev.preventDefault();
      const id = el.getAttribute('data-id');
      showPin(id, el);
      if (id && id !== 'subject') openDrawer(id);
      const lane = document.querySelector('.lane-home[data-id="' + id + '"]');
      if (lane) lane.scrollIntoView({{ behavior: 'smooth', block: 'nearest', inline: 'center' }});
    }});
  }});
  document.querySelectorAll('.lane-home').forEach(function (el) {{
    el.addEventListener('mouseenter', function () {{
      const tick = document.querySelector('#priceStrip .tick[data-id="' + el.getAttribute('data-id') + '"]');
      showPin(el.getAttribute('data-id'), tick);
    }});
  }});
}}
function bindSorts() {{
  document.querySelectorAll('.sorts button').forEach(function (btn) {{
    btn.addEventListener('click', function () {{
      laneSort = btn.getAttribute('data-sort') || 'price';
      const b = DATA.brief || {{}};
      const lanes = document.getElementById('day0Lanes');
      if (lanes) {{
        const html = lanesHtml();
        if (html) lanes.outerHTML = html;
      }}
      const thenSec = document.getElementById('thenNow');
      if (thenSec) thenSec.outerHTML = section('Where they sit now', 'Same similar set — still active, under contract, sold, or gone. Default order is price.', sortedRows(b.baseline || [], laneSort), null, 'thenNow');
      const strip = document.getElementById('sitStrip');
      if (strip) strip.outerHTML = stripHtml(b.position || [], DATA.digest || b.digest || {{}});
      document.querySelectorAll('.sorts button').forEach(function (x) {{
        x.classList.toggle('is-on', x.getAttribute('data-sort') === laneSort);
      }});
      bindSorts();
      bindPins();
      document.querySelectorAll('.card, .lane-home').forEach(function (el) {{
        el.addEventListener('click', function () {{ openDrawer(el.getAttribute('data-id')); }});
      }});
    }});
  }});
}}
function render() {{
  const b = DATA.brief || {{}};
  const d = DATA.digest || b.digest || {{}};
  const sold = DATA.sold_at;
  const photo = b.subject_photo
    ? '<img src="' + esc(b.subject_photo) + '" alt="">'
    : '<div class="ph"></div>';
  const statusLine = sold
    ? '<div class="archive">Archived · listed as sold ' + esc(String(sold).slice(0,10)) + '</div>'
    : '<div class="live"><i></i> Live Fingerprint</div>';
  const talk = ((b.talk || {{}})[DATA.agent ? 'agent' : 'seller'] || []);
  const pos = b.position || [];
  const daysLine = clockKind() === 'active' && b.days_active != null
    ? ' · ' + b.days_active + ' days on market'
    : (b.days_locked != null ? ' · ' + b.days_locked + ' days since generate' : '');
  const readTitle = DATA.agent ? 'This week’s read' : 'The market picture';
  const sinceCopy = clockKind() === 'active' ? 'after this home went active' : 'after generate';
  document.getElementById('main').innerHTML =
    '<div class="hero">' + photo + '<div>' +
      '<div class="kicker">Market Fingerprint</div>' +
      '<h1>' + esc(b.subject_address || 'This listing') + '</h1>' +
      '<div class="meta">Locked list ' + money(b.locked_price) +
        (b.market_label ? ' · ' + esc(b.market_label) : '') +
        ' · as of ' + esc(b.as_of || '') +
        daysLine +
        (DATA.active_at ? ' · listed ' + esc(String(DATA.active_at).slice(0,10)) : '') +
        (DATA.lock && DATA.lock.last_refresh_at ? ' · updated ' + esc(String(DATA.lock.last_refresh_at).slice(0,10)) : '') +
        (DATA.needs_upload ? ' · Upload market' : ' · Search market') +
      '</div>' + statusLine +
      '<div class="links">' +
        (b.report_url ? '<a href="' + esc(b.report_url) + '">Live Story</a>' : '') +
        (DATA.agent && DATA.share_url ? '<a href="' + esc(DATA.share_url.replace(/\\/?$/, '/')) + 'fingerprint/">Seller link</a>' : '') +
      '</div></div></div>' +
    (DATA.stale_upload ? '<p class="note">' + (DATA.agent
      ? 'Upload this week’s MLS export to refresh. The seller still sees the last file on hand.'
      : 'This picture uses the last market file we have. Ask your agent to refresh it with this week’s export.') + '</p>' : '') +
    scoreboardHtml(d) +
    weeksHtml() +
    lanesHtml() +
    publishedNotesHtml() +
    '<div class="read"><h2>' + readTitle + '</h2><ul>' +
      (talk.length ? talk.map(t => '<li>' + esc(t) + '</li>').join('') : '<li>Quiet week in this size band.</li>') +
    '</ul>' + (DATA.agent ? '' : '<p class="fact">Facts from this week’s market file — not a new list price.</p>') + '</div>' +
    stripHtml(pos, d) +
    section('Where they sit now', 'Same similar set — still active, under contract, sold, or gone. Default order is price.', sortedRows(b.baseline || [], laneSort), null, 'thenNow') +
    section('Listed ' + sinceCopy + ' — under the lock', 'New similar homes priced under you.', b.new_under, 'under') +
    section('Listed ' + sinceCopy + ' — over the lock', 'New similar homes priced over you.', b.new_over, 'over') +
    section('Price cuts', 'Homes that dropped $1,000+ since the last look.', b.price_cuts, null) +
    section('Under contract now', 'Pending, backup, and first-right — same bucket — in this size band.', b.pending_now || b.went_pending, 'Under contract');

  if (DATA.agent) renderConsole();
  bindWeeks();
  bindSorts();
  bindPins();
  const hist = (b.history || []);
  const current = weekKey(b.as_of) || (hist.length ? weekKey(hist[hist.length - 1].as_of) : '');
  if (current) selectWeek(current, false);
  document.querySelectorAll('.card, .lane-home').forEach(el => {{
    el.addEventListener('click', () => openDrawer(el.getAttribute('data-id')));
  }});
}}
function section(title, sub, rows, tag, sid) {{
  if (!rows || !rows.length) return '';
  return '<section class="sec"' + (sid ? ' id="' + sid + '"' : '') + '><h2>' + esc(title) + '</h2><p class="sub">' + esc(sub) + '</p><div class="cards">' +
    rows.map(c => cardHtml(c, tag)).join('') + '</div></section>';
}}
function renderConsole() {{
  const em = DATA.email || {{}};
    const who = (em.recipients || ['agent']).join(',');
    const on = !!em.on;
    const currentAsOf = weekKey((DATA.brief || {{}}).as_of);
    const currentNote = noteForWeek(currentAsOf);
    const published = (DATA.notes || []).filter(n => n.status === 'published' && n.published_at);
    published.sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)));
    const lastShared = published[0];
    const starters = ((DATA.brief || {{}}).talk || {{}}).agent || [];
    const starterBtns = starters.map((t, i) =>
      '<button type="button" class="starter" data-i="' + i + '">Use talk track ' + (i + 1) + '</button>'
    ).join('');
    const emailHint = DATA.seller_got_weekly
      ? 'They already have this week’s numbers. This sends only your read — not another scoreboard.'
      : (DATA.seller_email
        ? 'They’ll see it on the Fingerprint. Check this to email the note. Does not start weekly email.'
        : 'Save a seller email above if you want to email this note.');
    const emailCheck = DATA.seller_got_weekly && DATA.seller_email ? ' checked' : '';
    document.getElementById('console').innerHTML =
    '<h3>Agent console</h3>' +
    '<p class="cadence">Last looked ' + (DATA.last_looked_at ? weekLabel(DATA.last_looked_at) : '—') +
      ' · Last note shared ' + (lastShared ? weekLabel(lastShared.published_at) : 'none') + '</p>' +
    '<label>Locked list price</label>' +
    '<input type="number" id="lockPrice" value="' + (DATA.lock.locked_price || '') + '" step="1000">' +
    '<button type="button" class="btn-gold" id="btnLock">Update lock</button>' +
    '<label>Listed / went active</label>' +
    '<input type="date" id="activeAt" value="' + esc(String(DATA.active_at || '').slice(0,10)) + '">' +
    '<p class="cadence">' + (DATA.active_at
      ? (DATA.active_at_source === 'agent' ? 'You set this date. The board uses since active.' : 'Picked up from the market file when this address went Active. Change it if needed.')
      : 'Leave blank until it lists. After this date — or when we see this address Active — the board switches from since generate to since active.') + '</p>' +
    '<button type="button" id="btnActive">Save listed date</button>' +
    '<label>Seller name</label><input type="text" id="sellerName" value="' + esc(DATA.seller_name) + '">' +
    '<label>Seller email</label><input type="email" id="sellerEmail" value="' + esc(DATA.seller_email) + '">' +
    '<button type="button" id="btnContact">Save seller contact</button>' +
    '<label>Seller link</label>' +
    '<input type="text" readonly value="' + esc((DATA.share_url || '').replace(/\\/?$/, '/') + 'fingerprint/') + '">' +
    '<button type="button" id="btnCopy">Copy seller link</button>' +
    '<button type="button" id="btnRevoke">' + (DATA.seller_access ? 'Hide seller link' : 'Restore seller link') + '</button>' +
    '<label>Weekly email (opt-in)</label>' +
    '<div class="who">' +
      '<label><input type="radio" name="fpWho" value="agent"' + (who.indexOf('seller') < 0 ? ' checked' : '') + '> Me</label>' +
      '<label><input type="radio" name="fpWho" value="seller"' + (who === 'seller' ? ' checked' : '') + '> Seller</label>' +
      '<label><input type="radio" name="fpWho" value="both"' + (who.indexOf('seller') >= 0 && who.indexOf('agent') >= 0 ? ' checked' : '') + '> Both</label>' +
    '</div>' +
    '<button type="button" id="btnEmail">' + (on ? 'Update / keep weekly email' : 'Start weekly email') + '</button>' +
    (on ? '<button type="button" id="btnEmailOff">Stop weekly email</button>' : '') +
    '<div id="noteConsole" class="note-console">' +
    '<label>This week’s note to the seller</label>' +
    '<input type="hidden" id="noteWeek" value="' + esc(currentAsOf) + '">' +
    '<textarea id="agentNote" maxlength="500" placeholder="2–4 sentences. Draft stays private until you share.">' +
      esc(currentNote && currentNote.body ? currentNote.body : '') + '</textarea>' +
    '<div class="count" id="noteCount"></div>' +
    '<p class="cadence" id="noteState">' + (currentNote && currentNote.status === 'published' ? 'Shared with seller' : 'Draft — seller cannot see this') + '</p>' +
    (starterBtns ? '<div class="starters">' + starterBtns + '</div>' : '') +
    '<label class="check"><input type="checkbox" id="noteEmailNow"' + emailCheck + '> Email this note to the seller now</label>' +
    '<p class="check-hint">' + esc(emailHint) + '</p>' +
    '<button type="button" id="btnNoteDraft">Save draft</button>' +
    '<button type="button" class="btn-gold" id="btnNoteShare">Share with seller</button>' +
    '<button type="button" id="btnNoteUnpublish">Unpublish</button>' +
    '</div>' +
    (DATA.can_search_refresh ? '<button type="button" id="btnRefresh">Refresh market now</button>' : '') +
    (DATA.needs_upload ? '<label class="upload" id="uploadWrap" style="display:block">Upload MLS export<input type="file" id="exportFile" accept=".txt,.csv,.tsv"></label>' : '') +
    (DATA.sold_at ? '<p class="note">This Fingerprint is archived.</p>' : '<button type="button" id="btnSold">Mark listing sold</button>') +
    '<a class="btn" href="' + esc(DATA.report_url || '#') + '">Open Live Story</a>' +
    '<p class="status" id="fpStatus"></p>';
  bindConsole();
  updateNoteCount();
  focusNoteFromMail();
}}
function focusNoteFromMail() {{
  if (!DATA.agent) return;
  const hash = String(location.hash || '').replace('#', '');
  if (hash !== 'note') return;
  const box = document.getElementById('noteConsole');
  const ta = document.getElementById('agentNote');
  if (box) {{
    box.classList.add('is-focus');
    box.scrollIntoView({{ behavior: 'smooth', block: 'center' }});
  }}
  if (ta) setTimeout(function () {{ ta.focus(); }}, 250);
}}
function status(msg) {{ const el = document.getElementById('fpStatus'); if (el) el.textContent = msg || ''; }}
function bindConsole() {{
  const run = DATA.run_id;
  document.getElementById('btnLock')?.addEventListener('click', async () => {{
    status('Updating lock…');
    const res = await fetch('/api/runs/' + run + '/pulse-lock', {{
      method:'POST', credentials:'same-origin', headers:{{'Content-Type':'application/json'}},
      body: JSON.stringify({{ price: Number(document.getElementById('lockPrice').value) }})
    }});
    if (!res.ok) {{ status(await res.text()); return; }}
    location.reload();
  }});
  document.getElementById('btnActive')?.addEventListener('click', async () => {{
    status('Saving listed date…');
    const res = await fetch('/api/runs/' + run + '/fingerprint/active', {{
      method:'POST', credentials:'same-origin', headers:{{'Content-Type':'application/json'}},
      body: JSON.stringify({{ active_at: document.getElementById('activeAt').value }})
    }});
    if (!res.ok) {{ status(await res.text()); return; }}
    location.reload();
  }});
  document.getElementById('btnContact')?.addEventListener('click', async () => {{
    status('Saving…');
    const res = await fetch('/api/runs/' + run + '/fingerprint/contact', {{
      method:'POST', credentials:'same-origin', headers:{{'Content-Type':'application/json'}},
      body: JSON.stringify({{
        seller_name: document.getElementById('sellerName').value,
        seller_email: document.getElementById('sellerEmail').value
      }})
    }});
    status(res.ok ? 'Saved' : 'Could not save');
  }});
  document.getElementById('btnCopy')?.addEventListener('click', async () => {{
    const url = (DATA.share_url || '').replace(/\\/?$/, '/') + 'fingerprint/';
    try {{ await navigator.clipboard.writeText(new URL(url, location.origin).href); status('Copied'); }}
    catch (e) {{ window.prompt('Copy this link', url); }}
  }});
  document.getElementById('btnRevoke')?.addEventListener('click', async () => {{
    const res = await fetch('/api/runs/' + run + '/fingerprint/share', {{
      method:'POST', credentials:'same-origin', headers:{{'Content-Type':'application/json'}},
      body: JSON.stringify({{ seller_access: !DATA.seller_access }})
    }});
    if (res.ok) location.reload();
  }});
  const emailBody = (on) => {{
    const who = (document.querySelector('input[name="fpWho"]:checked') || {{}}).value || 'agent';
    return {{
      on, recipients: who,
      seller_email: document.getElementById('sellerEmail').value
    }};
  }};
  document.getElementById('btnEmail')?.addEventListener('click', async () => {{
    const res = await fetch('/api/runs/' + run + '/pulse-email', {{
      method:'POST', credentials:'same-origin', headers:{{'Content-Type':'application/json'}},
      body: JSON.stringify(emailBody(true))
    }});
    status(res.ok ? 'Weekly email on' : (await res.json().catch(()=>({{}}))).detail || 'Error');
    if (res.ok) location.reload();
  }});
  document.getElementById('btnEmailOff')?.addEventListener('click', async () => {{
    await fetch('/api/runs/' + run + '/pulse-email', {{
      method:'POST', credentials:'same-origin', headers:{{'Content-Type':'application/json'}},
      body: JSON.stringify(emailBody(false))
    }});
    location.reload();
  }});
  document.getElementById('btnRefresh')?.addEventListener('click', async () => {{
    status('Refreshing…');
    const res = await fetch('/api/runs/' + run + '/pulse-refresh', {{ method:'POST', credentials:'same-origin' }});
    if (res.ok) location.reload(); else status('Refresh failed');
  }});
  document.getElementById('exportFile')?.addEventListener('change', async (e) => {{
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    status('Uploading…');
    const fd = new FormData();
    fd.append('export_file', f);
    const res = await fetch('/api/runs/' + run + '/pulse-refresh', {{ method:'POST', credentials:'same-origin', body: fd }});
    if (res.ok) location.reload(); else status('Upload failed');
  }});
  document.getElementById('btnSold')?.addEventListener('click', async () => {{
    if (!confirm('Archive this Fingerprint? Weekly refresh and email stop.')) return;
    const res = await fetch('/api/runs/' + run + '/fingerprint/sold', {{
      method:'POST', credentials:'same-origin', headers:{{'Content-Type':'application/json'}},
      body: JSON.stringify({{ sold: true }})
    }});
    if (res.ok) location.reload();
  }});
  const starters = ((DATA.brief || {{}}).talk || {{}}).agent || [];
  document.querySelectorAll('.starter').forEach(btn => {{
    btn.addEventListener('click', () => {{
      const i = Number(btn.getAttribute('data-i'));
      const text = starters[i] || '';
      const ta = document.getElementById('agentNote');
      if (!ta || !text) return;
      const cur = (ta.value || '').trim();
      ta.value = ((cur ? cur + ' ' : '') + text).slice(0, 500);
      updateNoteCount();
    }});
  }});
  document.getElementById('agentNote')?.addEventListener('input', updateNoteCount);
  async function postNote(action) {{
    status(action === 'publish' ? 'Sharing…' : 'Saving…');
    const res = await fetch('/api/runs/' + run + '/fingerprint/note', {{
      method:'POST', credentials:'same-origin', headers:{{'Content-Type':'application/json'}},
      body: JSON.stringify({{
        action,
        as_of: document.getElementById('noteWeek').value,
        body: document.getElementById('agentNote').value,
        email: action === 'publish' && document.getElementById('noteEmailNow')?.checked
      }})
    }});
    const data = await res.json().catch(() => ({{}}));
    if (!res.ok) {{ status(data.detail || 'Could not save note'); return; }}
    if (action === 'publish') {{
      status(data.emailed ? 'Shared and emailed' : 'Shared with seller');
    }} else if (action === 'unpublish') {{
      status('Unpublished — seller no longer sees this note');
    }} else {{
      status('Draft saved');
    }}
    location.reload();
  }}
  document.getElementById('btnNoteDraft')?.addEventListener('click', () => postNote('save'));
  document.getElementById('btnNoteShare')?.addEventListener('click', () => postNote('publish'));
  document.getElementById('btnNoteUnpublish')?.addEventListener('click', () => postNote('unpublish'));
}}
function openDrawer(id) {{
  const c = byId(id);
  if (!c) return;
  const pics = (c.photos && c.photos.length ? c.photos : (c.photo_url ? [c.photo_url] : []));
  const hist = (c.status_history || []).map(h => '<li>' + esc(h.as_of) + ' · ' + esc(h.status) + ' · ' + money(h.price) + '</li>').join('');
  document.getElementById('drawerBody').innerHTML =
    (pics[0] ? '<img class="dpic" src="' + esc(pics[0]) + '" alt="">' : '') +
    '<h3>' + esc(c.address) + '</h3>' +
    '<p>' + money(c.price) + (c.delta ? ' · ' + (c.delta > 0 ? '+' : '') + money(c.delta) + ' vs lock' : '') + '</p>' +
    '<p class="meta">' + esc([c.status, c.beds ? c.beds + ' bd' : '', c.baths ? c.baths + ' ba' : '', c.sqft ? Number(c.sqft).toLocaleString() + ' sf' : '', c.dom ? c.dom + ' DOM' : ''].filter(Boolean).join(' · ')) + '</p>' +
    (hist ? '<p style="margin-top:12px;font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:#5c6675">Status</p><ul>' + hist + '</ul>' : '') +
    '<p style="margin-top:14px;font-size:.82rem">' +
      (c.zillow ? '<a href="' + esc(c.zillow) + '" target="_blank" rel="noopener">Zillow</a> · ' : '') +
      (c.realtor ? '<a href="' + esc(c.realtor) + '" target="_blank" rel="noopener">Realtor.com</a>' : '') +
    '</p>';
  const d = document.getElementById('drawer');
  d.hidden = false; d.classList.add('open');
}}
document.getElementById('drawerClose').addEventListener('click', () => {{
  const d = document.getElementById('drawer'); d.classList.remove('open'); d.hidden = true;
}});
document.getElementById('drawer').addEventListener('click', (e) => {{
  if (e.target.id === 'drawer') {{ e.currentTarget.classList.remove('open'); e.currentTarget.hidden = true; }}
}});
render();
</script>
</body>
</html>
"""
