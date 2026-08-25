"""Market Fingerprint — living after-list page (agent console + seller view)."""
from __future__ import annotations

import json
import os
from html import escape as _esc
from pathlib import Path


def _json_script(data) -> str:
    raw = json.dumps(data, default=str, ensure_ascii=False)
    return raw.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")


def _mapbox_token() -> str:
    for key in ("MAPBOX_ACCESS_TOKEN", "MAPBOX_TOKEN", "VITE_MAPBOX_TOKEN"):
        val = (os.environ.get(key) or "").strip()
        if val:
            return val
    env_path = Path(__file__).resolve().parent / ".env"
    if env_path.exists():
        try:
            for line in env_path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                name, raw = line.split("=", 1)
                if name.strip() in ("MAPBOX_ACCESS_TOKEN", "MAPBOX_TOKEN", "VITE_MAPBOX_TOKEN"):
                    return raw.strip().strip('"').strip("'")
        except OSError:
            pass
    return ""


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
    report_sub = {}
    if isinstance(view.get("report"), dict) and isinstance(view["report"].get("subject"), dict):
        report_sub = view["report"]["subject"]
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
        "photos_fetching": bool(view.get("photos_fetching")),
        "mapbox_token": _mapbox_token(),
        "subject_lat": brief.get("subject_lat") or report_sub.get("latitude") or report_sub.get("lat"),
        "subject_lng": brief.get("subject_lng") or report_sub.get("longitude") or report_sub.get("lng"),
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
<link href="https://api.mapbox.com/mapbox-gl-js/v3.9.0/mapbox-gl.css" rel="stylesheet">
<script src="https://api.mapbox.com/mapbox-gl-js/v3.9.0/mapbox-gl.js"></script>
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
  position:relative; color:#fff; border-radius:22px; overflow:hidden;
  min-height:220px; display:flex; align-items:flex-end;
  background:linear-gradient(150deg, var(--ink), #16233c);
}}
.hero img, .hero .ph {{
  position:absolute; inset:0; width:100%; height:100%; object-fit:cover;
}}
.hero .ph {{ background:#1a2a44; display:block; }}
.hero .veil {{
  position:absolute; inset:0;
  background:linear-gradient(180deg, rgba(11,18,32,.12) 15%, rgba(11,18,32,.88));
}}
.hero .copy {{ position:relative; z-index:1; padding:28px 24px 20px; width:100%; }}
.hero .kicker {{ font-size:.68rem; letter-spacing:.12em; text-transform:uppercase; color:#c9a227; font-weight:800; }}
.hero h1 {{ font-family:Fraunces,Georgia,serif; font-size:clamp(1.45rem,3vw,2.1rem); margin:4px 0 8px; }}
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
  position:fixed; inset:0; background:rgba(11,18,32,.55); z-index:40; display:none;
  align-items:center; justify-content:center; padding:20px;
}}
.drawer.open {{ display:flex; }}
.drawer .panel {{
  width:min(720px,100%); max-height:min(90vh,920px); background:#fff; overflow:auto;
  border-radius:20px; box-shadow:0 24px 60px rgba(11,18,32,.28); position:relative;
}}
.drawer .gallery {{ position:relative; background:#dfe6ef; }}
.drawer .dpic {{ width:100%; height:min(42vh,360px); object-fit:cover; display:block; background:#eef2f7; }}
.drawer .dpic.empty {{ height:120px; }}
.drawer .gal-btn {{
  position:absolute; top:50%; transform:translateY(-50%); width:36px; height:36px; border:0;
  border-radius:50%; background:rgba(11,18,32,.72); color:#fff; font-size:1.35rem; cursor:pointer; line-height:1;
}}
.drawer .gal-prev {{ left:10px; }}
.drawer .gal-next {{ right:10px; }}
.drawer .gal-count {{
  position:absolute; right:12px; bottom:10px; background:rgba(11,18,32,.7); color:#fff;
  font-size:.72rem; font-weight:700; padding:3px 8px; border-radius:99px;
}}
.drawer .panel-body {{ padding:8px 22px 22px; }}
.drawer h3 {{ font-family:Fraunces,Georgia,serif; margin:12px 0 4px; font-size:1.35rem; }}
.drawer .price-line {{ font-family:Fraunces,Georgia,serif; font-size:1.2rem; font-weight:700; }}
.drawer .close {{
  position:absolute; top:10px; right:10px; z-index:2; width:36px; height:36px; border:0;
  border-radius:50%; background:rgba(255,255,255,.92); font-size:1.4rem; cursor:pointer; line-height:1;
}}
.drawer .meta {{ color:var(--muted); font-size:.88rem; line-height:1.4; }}
.drawer ul {{ margin:6px 0 0 1.1rem; font-size:.88rem; line-height:1.45; }}
.note {{ font-size:.78rem; color:var(--muted); margin-top:8px; }}
.upload {{ display:none; }}
.weeks-wrap {{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:16px 18px; margin-bottom:18px; }}
.weeks-wrap h2 {{ font-family:Fraunces,Georgia,serif; font-size:1.15rem; margin-bottom:4px; }}
.weeks-wrap .sub {{ color:var(--muted); font-size:.82rem; margin-bottom:12px; }}
.weeks {{ display:flex; gap:6px; overflow-x:auto; padding-bottom:4px; }}
.week {{
  flex:0 0 auto; background:#f7f4ee; border:1px solid var(--line);
  border-radius:999px; padding:6px 12px; cursor:pointer; font:inherit;
  font-size:.78rem; font-weight:700; color:var(--navy);
}}
.week.is-on, .week:hover {{ border-color:var(--navy); background:#fff; }}
.from-agent {{
  background:#fff; border:1px solid var(--line); border-left:4px solid var(--gold);
  border-radius:16px; padding:16px 18px; margin:0 0 16px;
}}
.from-agent .kicker {{ font-size:.68rem; letter-spacing:.08em; text-transform:uppercase; color:var(--gold); font-weight:800; }}
.from-agent h2 {{ font-family:Fraunces,Georgia,serif; font-size:1.22rem; margin:2px 0 4px; }}
.from-agent .when {{ font-size:.75rem; color:var(--muted); margin-bottom:8px; }}
.from-agent .body {{ font-size:.95rem; line-height:1.5; }}
.from-agent .recs {{ margin:10px 0 0; }}
.from-agent .recs-k {{ font-size:.68rem; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); font-weight:800; margin-bottom:4px; }}
.from-agent .recs li {{ margin:5px 0 5px 1.1rem; font-size:.9rem; line-height:1.45; }}
.past-pick {{
  display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-top:14px;
  font-size:.78rem; font-weight:700; color:var(--navy);
}}
.past-pick select {{
  font:inherit; font-weight:600; color:var(--ink); background:#f7f4ee;
  border:1px solid var(--line); border-radius:10px; padding:6px 10px; min-width:180px;
}}
.past-note {{
  margin-top:10px; padding:10px 12px; background:#f7f4ee; border-radius:12px; font-size:.88rem; line-height:1.45;
}}
.past-note strong {{ display:block; font-size:.72rem; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); margin-bottom:4px; }}
.week-stat {{ font-size:.92rem; color:var(--ink); margin:4px 0 10px; }}
.week-stat b {{ font-family:Fraunces,Georgia,serif; font-size:1.15rem; color:var(--navy); }}
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
.week-homes {{ margin-top:8px; }}
.week-homes h3 {{ font-size:.72rem; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin-bottom:8px; }}
.week-homes .empty {{ font-size:.82rem; color:var(--muted); }}
.spark {{ margin:8px 0 14px; }}
.spark svg {{ display:block; max-width:280px; }}
.spark .cap {{ font-size:.72rem; color:var(--muted); margin-top:4px; }}
.lanes {{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:16px 18px; margin-bottom:18px; }}
.lanes h2 {{ font-family:Fraunces,Georgia,serif; font-size:1.15rem; margin-bottom:4px; }}
.lanes > .sub {{ color:var(--muted); font-size:.82rem; margin-bottom:12px; }}
.lane {{ margin-top:16px; padding-top:14px; border-top:1px solid var(--line); }}
.lanes > .lane:first-of-type {{ border-top:0; padding-top:0; margin-top:6px; }}
.lane h3 {{
  display:flex; align-items:center; gap:8px; flex-wrap:wrap;
  font-size:.8rem; letter-spacing:.04em; text-transform:uppercase; color:var(--ink);
  font-weight:800; margin-bottom:10px;
}}
.lane h3 .n {{
  display:inline-block; background:#eef2f7; color:var(--navy); border-radius:99px;
  padding:2px 9px; font-size:.72rem; letter-spacing:0; font-weight:800;
}}
.lane.is-uc h3 {{ color:#c2410c; }}
.lane.is-sold h3 {{ color:#64748b; }}
.lane.is-active h3 {{ color:var(--teal); }}
.lane-row {{ display:flex; gap:12px; overflow-x:auto; padding-bottom:6px; }}
.lane-home {{
  flex:0 0 auto; width:200px; padding:0; border:1px solid var(--line); border-radius:14px;
  overflow:hidden; background:#fff; cursor:pointer; text-align:left; font:inherit; color:inherit;
  appearance:none; -webkit-appearance:none;
}}
.lane-home.is-week {{ border-color:var(--gold); box-shadow:0 0 0 2px #c9a22755; }}
.lane-home.is-pin {{ border-color:var(--navy); box-shadow:0 0 0 2px #0c3c6e44; }}
.lane-pic {{ display:block; width:100%; height:124px; background:#dfe6ef center/cover no-repeat; }}
.lane-pic.empty {{
  background-color:#e8eef4;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='40' viewBox='0 0 48 40'><path fill='%23b7c2cf' d='M24 4l20 16h-6v16H10V20H4z'/></svg>");
  background-repeat:no-repeat;
  background-position:center 42px;
  background-size:36px 30px;
}}
.lane-meta {{ padding:10px 11px 12px; }}
.lane-meta .p {{ font-family:Fraunces,Georgia,serif; font-size:1.08rem; font-weight:700; }}
.lane-meta .a {{
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
  font-size:.8rem; font-weight:700; color:var(--ink); margin-top:4px; line-height:1.3;
  overflow:hidden;
}}
.lane-meta .m {{ font-size:.72rem; color:var(--muted); margin-top:4px; line-height:1.4; }}
.set-totals {{
  display:flex; flex-wrap:wrap; gap:8px; margin:10px 0 12px;
}}
.set-totals span {{
  background:#f7f4ee; border:1px solid var(--line); border-radius:999px;
  padding:5px 11px; font-size:.78rem; font-weight:700; color:var(--navy);
}}
.set-totals b {{ font-family:Fraunces,Georgia,serif; font-size:.95rem; }}
.photo-banner {{
  display:none; margin:0 0 14px; padding:10px 14px; border-radius:12px;
  background:#0c3c6e; color:#fff; font-size:.82rem; font-weight:600;
}}
.photo-banner.is-on {{ display:block; }}
.fp-map {{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:16px 18px; margin:0 0 18px; }}
.fp-map h2 {{ font-family:Fraunces,Georgia,serif; font-size:1.15rem; margin-bottom:4px; }}
.fp-map > .sub {{ color:var(--muted); font-size:.82rem; margin-bottom:10px; }}
.fp-map-legend {{ display:flex; flex-wrap:wrap; gap:8px 14px; font-size:.72rem; color:var(--muted); font-weight:700; margin:0 0 10px; }}
.fp-map-legend i {{ display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:5px; vertical-align:middle; box-shadow:0 0 0 2px #fff, 0 1px 3px rgba(11,18,32,.25); }}
.fp-map-legend i.is-you {{ background:var(--gold); }}
.fp-map-legend i.is-active {{ background:var(--teal); }}
.fp-map-legend i.is-uc {{ background:#e65100; }}
.fp-map-legend i.is-sold {{ background:#94a3b8; }}
.fp-map-canvas {{ height:340px; border-radius:12px; overflow:hidden; background:#e8eef4; }}
.fp-pin {{
  width:14px; height:14px; border-radius:50%; border:2px solid #fff;
  box-shadow:0 1px 4px rgba(11,18,32,.35); cursor:pointer;
}}
.fp-pin.is-you {{ width:18px; height:18px; background:var(--gold); }}
.fp-pin.is-active {{ background:var(--teal); }}
.fp-pin.is-uc {{ background:#e65100; }}
.fp-pin.is-sold {{ background:#94a3b8; }}
.mapboxgl-popup-content {{ padding:10px 12px; border-radius:12px; font-size:.78rem; line-height:1.35; max-width:240px; }}
.sorts {{ display:flex; flex-wrap:wrap; gap:6px; margin:4px 0 10px; align-items:center; }}
.sorts span {{ font-size:.68rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); margin-right:4px; }}
.sorts button {{
  width:auto; margin:0; padding:5px 10px; border-radius:99px; border:1px solid var(--line);
  background:#f7f4ee; font:inherit; font-size:.72rem; font-weight:700; cursor:pointer; color:var(--navy);
}}
.sorts button.is-on {{ background:var(--navy); color:#fff; border-color:var(--navy); }}
.board {{
  background:linear-gradient(165deg, #0b1220 0%, #10213a 55%, #0c3c6e 140%);
  color:#fff; border:1px solid #1c2c46; border-radius:20px;
  padding:22px 22px 16px; margin:0 0 20px; overflow:hidden;
}}
.board-top .kicker {{
  font-size:.68rem; letter-spacing:.14em; text-transform:uppercase; color:var(--gold); font-weight:800;
}}
.board-top h2 {{
  font-family:Fraunces,Georgia,serif; font-size:clamp(1.35rem, 2.6vw, 1.85rem);
  margin:4px 0 6px; font-weight:700;
}}
.board-top .sub {{ color:#c8d2e0; font-size:.88rem; line-height:1.45; max-width:46rem; }}
.board-panes {{
  display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:16px 0 8px;
}}
.board-pane {{
  background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.08);
  border-radius:16px; padding:14px 14px 10px;
}}
.board-pane-h {{ display:flex; justify-content:space-between; align-items:baseline; gap:8px; margin-bottom:10px; }}
.board-pane-h span {{ font-size:.72rem; letter-spacing:.08em; text-transform:uppercase; font-weight:800; color:#f0d060; }}
.board-pane-h small {{ color:#9aabc0; font-size:.72rem; }}
.board-grid {{ display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:8px; }}
.board-stat {{
  text-align:center; padding:8px 6px; border-right:1px solid rgba(255,255,255,.08);
}}
.board-stat:last-child {{ border-right:0; }}
.board-n {{ font-family:Fraunces,Georgia,serif; font-size:clamp(1.45rem, 2.6vw, 2rem); font-weight:700; line-height:1; }}
.board-l {{ font-size:.7rem; letter-spacing:.04em; text-transform:uppercase; font-weight:800; color:#e8eef6; margin-top:7px; }}
.board-h {{ font-size:.68rem; color:#9aabc0; margin-top:3px; line-height:1.35; }}
.board-stat.is-under .board-n {{ color:#f3b4b4; }}
.board-stat.is-over .board-n {{ color:#8ee0c8; }}
.board-totals {{
  display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:12px 0 4px;
}}
.board-total {{
  background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.1);
  border-radius:14px; padding:12px 14px;
}}
.board-total .k {{ font-size:.68rem; letter-spacing:.08em; text-transform:uppercase; color:#f0d060; font-weight:800; }}
.board-total .v {{ font-family:Fraunces,Georgia,serif; font-size:1.35rem; font-weight:700; margin:4px 0 2px; }}
.board-total .s {{ font-size:.78rem; color:#c8d2e0; line-height:1.4; }}
.board-table tfoot td {{ color:#f0d060; border-bottom:0; }}
.board-table-wrap {{ overflow-x:auto; margin-top:12px; }}
.board-table {{ width:100%; border-collapse:collapse; min-width:520px; }}
.board-table th, .board-table td {{ padding:9px 8px; text-align:center; font-size:.82rem; }}
.board-table th {{
  font-size:.62rem; letter-spacing:.07em; text-transform:uppercase; color:#9aabc0; font-weight:800;
  border-bottom:1px solid rgba(255,255,255,.1);
}}
.board-table th:first-child, .board-table td:first-child {{ text-align:left; }}
.board-table td {{ font-family:Fraunces,Georgia,serif; font-size:1.02rem; font-weight:700; border-bottom:1px solid rgba(255,255,255,.06); }}
.board-table td:first-child {{ font-family:Inter,system-ui,sans-serif; font-size:.82rem; color:#d5deea; }}
.board-week {{ cursor:pointer; }}
.board-week:hover td {{ background:rgba(255,255,255,.04); }}
.board-week.is-on td {{ background:rgba(201,162,39,.16); }}
.board-table .is-under {{ color:#f3b4b4; }}
.board-table .is-over {{ color:#8ee0c8; }}
@media (max-width:800px) {{
  .board-panes, .board-totals {{ grid-template-columns:1fr; }}
  .board-grid {{ grid-template-columns:repeat(3,minmax(0,1fr)); }}
  .board-stat {{ border-right:0; }}
}}
.strip {{ position:relative; height:72px; }}
.strip .tick {{ cursor:pointer; }}
.strip .tick.is-pin {{ background:var(--navy); }}
.strip-now {{
  min-height:1.4em; margin:6px 0 0; font-size:.84rem; font-weight:700; color:var(--ink); line-height:1.35;
}}
.strip-now span {{ color:var(--muted); font-weight:500; }}
.card.is-pin {{ border-color:var(--navy); box-shadow:0 0 0 2px #0c3c6e44; }}
.now-kicker {{ margin:0 0 12px; }}
.now-kicker .kicker {{ font-size:.68rem; letter-spacing:.08em; text-transform:uppercase; color:var(--navy); font-weight:800; }}
.now-kicker h2 {{ font-family:Fraunces,Georgia,serif; font-size:1.22rem; margin:2px 0 4px; }}
.now-kicker .sub {{ color:var(--muted); font-size:.82rem; line-height:1.45; }}
.sample-demo-bar {{
  display:none; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;
  background:#0b1220; color:#fff; padding:10px 18px; font-size:.86rem; margin:0 0 16px; border-radius:14px;
}}
.sample-demo-bar.is-on {{ display:flex; }}
.sample-demo-bar span {{ color:#c8d2e0; }}
.sample-demo-bar a {{
  color:#0b1220; background:var(--gold); text-decoration:none; font-weight:800; padding:8px 14px; border-radius:999px;
}}
.story {{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:16px 18px; margin:16px 0 14px; }}
.story .lead {{ font-family:Fraunces,Georgia,serif; font-size:1.28rem; line-height:1.35; }}
.story .long {{ color:var(--muted); font-size:.9rem; margin-top:6px; line-height:1.45; }}
.hero .links a {{ color:#fff; }}
.week-nums {{ display:none; }}
.since-nums {{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin:0 0 18px; }}
.since-nums .cell {{ background:#fff; border:1px solid var(--line); border-radius:14px; padding:12px 10px; text-align:center; }}
.since-nums .n {{ font-family:Fraunces,Georgia,serif; font-size:1.35rem; font-weight:700; color:var(--navy); }}
.since-nums .l {{ font-size:.68rem; color:var(--muted); margin-top:4px; font-weight:700; }}
.legend {{ display:flex; flex-wrap:wrap; gap:10px 16px; font-size:.78rem; color:var(--muted); margin:0 0 12px; }}
.legend b {{ color:var(--ink); }}
.week-grid {{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }}
@media (max-width:800px) {{
  .week-nums, .since-nums, .week-grid {{ grid-template-columns:1fr; }}
}}
.week-col h3 {{ font-size:.72rem; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin-bottom:8px; }}
.week-col .empty {{ font-size:.82rem; color:var(--muted); }}
.why {{ font-size:.82rem; color:var(--muted); margin:0 0 16px; line-height:1.45; }}
.filters {{
  background:#fff; border:1px solid var(--line); border-radius:16px;
  padding:12px 16px; margin:14px 0 10px;
  display:flex; flex-wrap:wrap; gap:8px; align-items:center;
}}
.filters-k {{ font-size:.68rem; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin-right:4px; }}
.filters-n {{ width:100%; font-size:.78rem; color:var(--muted); margin:4px 0 0; font-weight:500; }}
.chip {{
  display:inline-block; background:#fff; border:1px solid var(--line); border-radius:999px;
  padding:5px 11px; font-size:.78rem; font-weight:700; color:var(--navy);
}}
.facts {{
  display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin:0 0 18px;
}}
@media (max-width:800px) {{ .facts {{ grid-template-columns:1fr 1fr; }} }}
.fact {{ background:#fff; border:1px solid var(--line); border-radius:12px; padding:10px 12px; }}
.fact .fk {{ display:block; font-size:.62rem; letter-spacing:.07em; text-transform:uppercase; color:var(--muted); font-weight:800; }}
.fact .fv {{ display:block; font-family:Fraunces,Georgia,serif; font-size:1.05rem; font-weight:700; color:var(--navy); margin-top:3px; }}
.walk {{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:16px 18px; margin:0 0 18px; }}
.walk h2 {{ font-family:Fraunces,Georgia,serif; font-size:1.2rem; margin-bottom:4px; }}
.walk .sub {{ color:var(--muted); font-size:.84rem; margin-bottom:10px; }}
.weeks-bar {{
  position:sticky; top:0; z-index:6; background:#fff; padding:8px 0 10px; margin:0 -4px 10px;
}}
.since-line {{ font-size:.82rem; color:var(--muted); margin:8px 0 0; }}
.since-line b {{ color:var(--ink); }}
.week-homes .lane {{ margin-top:8px; }}
.week-homes .lane:first-of-type {{ border-top:0; padding-top:0; margin-top:0; }}
@media (max-width:640px) {{ .hero {{ min-height:180px; }} }}
</style>
</head>
<body class="{agent_class}">
<div class="wrap">
  <div class="sample-demo-bar" id="sampleDemoBar">
    <span>Real Greeley listing from the market file — not mock comps. Photos appear when we can match the address publicly.</span>
    <a href="/demo">Back to the listing appointment →</a>
  </div>
  <p class="photo-banner" id="photoBanner">Pulling listing photos for this similar set…</p>
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
  const url = photoUrl(c);
  const pic = url
    ? '<div class="pic" style="background-image:url(\\'' + String(url).replace(/'/g, '%27') + '\\')"></div>'
    : '<div class="pic empty">No photo</div>';
  const st = extraTag || c.status || '';
  const bits = [];
  if (c.beds) bits.push(c.beds + ' bd');
  if (c.baths) bits.push(c.baths + ' ba');
  if (c.sqft) bits.push(Number(c.sqft).toLocaleString() + ' sf');
  if (c.delta) bits.push((c.delta > 0 ? '+' : '') + money(Math.abs(c.delta)).replace('$','') + ' vs list');
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
  const pools = [b.still_active, b.new_under, b.new_over, b.baseline, b.went_pending, b.went_sold, b.cheaper_active, b.price_cuts, b.gone, b.pending_now, b.position];
  for (const pool of pools) {{
    for (const c of (pool || [])) if (c && c.id === id) return c;
  }}
  return null;
}}
function weekKey(v) {{
  return String(v || '').slice(0, 10);
}}
function listDate(c) {{
  return weekKey(c && (c.list_date || c.list_date));
}}
function photoUrl(c) {{
  if (!c) return '';
  if (c.photos && c.photos.length) return c.photos[0];
  return c.photo_url || c.photo_url || '';
}}
function statusHistory(c) {{
  return (c && (c.status_history || c.status_history)) || [];
}}
function listPrice() {{
  const b = DATA.brief || {{}};
  const d = DATA.digest || b.digest || {{}};
  const lock = DATA.lock || {{}};
  return Number(b.locked_price || lock.locked_price || d.locked_price || 0);
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
function streetLine(c) {{
  if (!c) return '';
  let a = String(c.address || '').trim();
  const city = String(c.city || '').trim();
  if (city) {{
    const at = a.toLowerCase().lastIndexOf(city.toLowerCase());
    if (at > 0) a = a.slice(0, at).replace(/[,\\s]+$/, '');
  }}
  return a || String(c.address || '').trim();
}}
function mapsHref(c) {{
  if (!c) return '';
  const lat = Number(c.lat), lng = Number(c.lng);
  if (isFinite(lat) && isFinite(lng) && !(lat === 0 && lng === 0)) {{
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(lat + ',' + lng);
  }}
  const q = [c.address, c.city, 'CO'].filter(Boolean).join(', ');
  return q ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q) : '';
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
function weekAsOf(w) {{
  return weekKey((w && (w.as_of || w.as_of)) || '');
}}
function weekWindows() {{
  const hist = ((DATA.brief || {{}}).history || []).slice().sort(function (a, b) {{
    return weekAsOf(a).localeCompare(weekAsOf(b));
  }});
  return hist.map(function (w, i) {{
    const key = weekAsOf(w);
    return {{
      as_of: key,
      as_of: key,
      start: key,
      end: hist[i + 1] ? weekAsOf(hist[i + 1]) : ''
    }};
  }});
}}
function cardMovedInWeek(c, start, end) {{
  if (!c) return false;
  const hist = c.status_history || [];
  for (let i = 0; i < hist.length; i++) {{
    const st = hist[i].status;
    if ((isUc(st) || String(st || '').toLowerCase() === 'sold') && inWeek(hist[i].as_of || hist[i].as_of, start, end)) return true;
  }}
  return !!(listDate(c) && inWeek(listDate(c), start, end));
}}
function weekCounts(asOf) {{
  const wins = weekWindows();
  const key = weekKey(asOf);
  const w = wins.find(function (x) {{ return (x.as_of || x.as_of) === key; }}) || wins[wins.length - 1];
  const out = {{ listed: 0, uc: 0, sold: 0 }};
  if (!w) return out;
    homesForWeek(w.as_of || w.as_of).forEach(function (c) {{
    if (listDate(c) && inWeek(listDate(c), w.start, w.end)) out.listed += 1;
    const hist = statusHistory(c);
    let sold = false;
    let uc = false;
    for (let i = 0; i < hist.length; i++) {{
      if (!inWeek(hist[i].as_of || hist[i].as_of, w.start, w.end)) continue;
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
  const w = wins.find(function (x) {{ return (x.as_of || x.as_of) === key; }}) || wins[wins.length - 1];
  if (!w) return [];
  const b = DATA.brief || {{}};
  const seen = {{}};
  const out = [];
  const pools = [b.baseline, b.still_active, b.new_under || b.new_under, b.new_over || b.new_over, b.went_pending, b.went_sold, b.pending_now || b.pending_now];
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
    '<p class="cap">Teal: still cheaper than you · Gold: your rank among similar actives. Same initial list.</p></div>';
}}
function laneHome(c) {{
  const pic = photoUrl(c)
    ? 'style="background-image:url(\\'' + String(photoUrl(c)).replace(/'/g, '%27') + '\\')"'
    : '';
  const street = streetLine(c);
  return '<button type="button" class="lane-home" data-id="' + esc(c.id) + '" title="' + esc(c.address || '') + '">' +
    '<span class="lane-pic' + (photoUrl(c) ? '' : ' empty') + '" ' + pic + '></span>' +
    '<span class="lane-meta"><span class="p">' + money(c.price) + '</span>' +
    (street ? '<span class="a">' + esc(street) + '</span>' : '') +
    '<span class="m">' + esc(homeBits(c)) + '</span></span></button>';
}}
function photoLane(title, sub, rows, sid) {{
  if (!rows || !rows.length) return '';
  return '<div class="lanes"' + (sid ? ' id="' + sid + '"' : '') + '><h2>' + esc(title) + '</h2>' +
    '<p class="sub">' + esc(sub) + '</p>' +
    '<div class="lane"><div class="lane-row">' + sortedRows(rows, laneSort).map(laneHome).join('') + '</div></div></div>';
}}
function nowLanesHtml() {{
  const b = DATA.brief || {{}};
  const uc = photoLane(
    'Under contract now',
    'Pending, backup, and first-right in this size band — buyers who did not wait.',
    b.pending_now || b.went_pending
  );
  const under = photoLane(
    'Listed under yours — they provide the value',
    'Similar homes listed under your price. They are offering more value to the same buyers looking at yours.',
    b.new_under
  );
  const over = photoLane(
    'Listed over yours — you provide the value',
    'Similar homes listed over your price. Your list is the value play for buyers looking at theirs.',
    b.new_over
  );
  const cuts = photoLane('Price cuts', 'Homes that dropped $1,000+ since the last look.', b.price_cuts);
  const body = uc + under + over + cuts;
  if (!body) return '';
  return '<div id="nowLanes"><div class="now-kicker"><div class="kicker">Right now</div>' +
    '<h2>What is happening around your list</h2>' +
    '<p class="sub">Who went under contract, who is beating you on value, and who you are beating. Walk this with the seller, then check where you sit.</p></div>' +
    body + '</div>';
}}
function lanesHtml() {{
  const rows = sortedRows(((DATA.brief || {{}}).baseline || (DATA.brief || {{}}).baseline || []), laneSort);
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
  function lane(title, items, kind) {{
    if (!items.length) return '';
    return '<div class="lane' + (kind ? ' is-' + kind : '') + '"><h3>' + esc(title) + ' <span class="n">' + items.length + '</span></h3><div class="lane-row">' +
      items.map(laneHome).join('') + '</div></div>';
  }}
  const when = clockKind() === 'active' ? 'when this home went active' : 'when this Fingerprint was generated';
  const total = active.length + pending.length + sold.length;
  return '<div class="lanes" id="day0Lanes"><h2>The original similar set</h2>' +
    '<p class="sub">Homes that were similar actives ' + when + ' — still active, under contract, or sold. Supporting picture of that first list, not this week’s news.</p>' +
    '<div class="set-totals">' +
      '<span><b>' + total + '</b> in this set</span>' +
      '<span><b>' + active.length + '</b> still active</span>' +
      '<span><b>' + pending.length + '</b> under contract</span>' +
      '<span><b>' + sold.length + '</b> sold</span>' +
    '</div>' +
    sortsHtml('lanes') +
    lane('Still active', active, 'active') + lane('Under contract', pending, 'uc') + lane('Sold since ' + (clockKind() === 'active' ? 'active' : 'generate'), sold, 'sold') + '</div>';
}}
function weekHomesHtml(asOf) {{
  const homes = homesForWeek(asOf);
  const wins = weekWindows();
  const key = weekKey(asOf);
  const w = wins.find(function (x) {{ return (x.as_of || x.as_of) === key; }}) || wins[wins.length - 1];
  const listed = [];
  const uc = [];
  const sold = [];
  homes.forEach(function (c) {{
    let didSold = false;
    let didUc = false;
    (statusHistory(c) || []).forEach(function (h) {{
      if (!w || !inWeek(h.as_of || h.as_of, w.start, w.end)) return;
      const st = String(h.status || '').toLowerCase();
      if (st === 'sold') didSold = true;
      else if (isUc(st)) didUc = true;
    }});
    const didList = !!(listDate(c) && w && inWeek(listDate(c), w.start, w.end));
    if (didSold) sold.push(c);
    else if (didUc) uc.push(c);
    else if (didList) listed.push(c);
    else listed.push(c);
  }});
  function col(title, rows, kind) {{
    return '<div class="lane' + (kind ? ' is-' + kind : '') + '"><h3>' + esc(title) + ' <span class="n">' + rows.length + '</span></h3>' +
      (rows.length
        ? '<div class="lane-row">' + rows.map(laneHome).join('') + '</div>'
        : '<p class="empty">None this week.</p>') + '</div>';
  }}
  if (!homes.length) {{
    return '<div class="week-homes" id="weekHomes"><p class="empty">No similar homes listed, went under contract, or sold this week.</p></div>';
  }}
  return '<div class="week-homes" id="weekHomes">' +
    col('Listed', listed, 'active') +
    col('Under contract', uc, 'uc') +
    col('Sold', sold, 'sold') +
    '</div>';
}}
function applyWeekHighlight(asOf) {{
  const wins = weekWindows();
  const key = weekKey(asOf);
  const w = wins.find(function (x) {{ return (x.as_of || x.as_of) === key; }}) || wins[wins.length - 1];
  const ids = {{}};
  if (w) {{
    homesForWeek(w.as_of || w.as_of).forEach(function (c) {{ ids[c.id] = 1; }});
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
  document.querySelectorAll('.board-week').forEach(function (el) {{
    el.classList.toggle('is-on', el.getAttribute('data-asof') === key);
  }});
  const box = document.getElementById('weekHomes');
  if (box) box.outerHTML = weekHomesHtml(key);
  const score = document.getElementById('weekScore');
  if (score) score.outerHTML = weekScoreHtml(key);
  applyWeekHighlight(key);
  document.querySelectorAll('#weekHomes .card, #weekHomes .lane-home').forEach(function (el) {{
    el.addEventListener('click', function () {{ openDrawer(el.getAttribute('data-id')); }});
  }});
  if (scroll) {{
    const bar = document.querySelector('.weeks-bar');
    if (bar) bar.scrollIntoView({{ behavior: 'smooth', block: 'nearest' }});
  }}
  if (DATA.agent) loadNoteWeek(key);
}}
function prettyDate(s) {{
  const raw = weekKey(s);
  const d = new Date(raw + 'T12:00:00');
  if (isNaN(d.getTime())) return raw || '—';
  return d.toLocaleDateString(undefined, {{ month: 'short', day: 'numeric', year: 'numeric' }});
}}
function filtersHtml() {{
  const chips = (((DATA.brief || {{}}).comp_set || {{}}).chips || []);
  if (!chips.length) return '';
  return '<div class="filters"><span class="filters-k">Similar set</span>' +
    chips.map(function (c) {{ return '<span class="chip">' + esc(c) + '</span>'; }}).join('') +
    '<p class="filters-n">Beds, baths, garage, and size a buyer would cross-shop against this home.</p></div>';
}}
function factsHtml(b, d) {{
  const chips = [];
  const listPrice = b.locked_price || b.locked_price || ((DATA.lock || {{}}).locked_price);
  chips.push(['Initial list', money(listPrice)]);
  if (DATA.active_at) chips.push(['Listed', prettyDate(DATA.active_at)]);
  if (b.days_active || b.days_active) chips.push(['Days on market', String(b.days_active || b.days_active)]);
  else if (b.days_locked || b.days_locked) chips.push(['Days since generate', String(b.days_locked || b.days_locked)]);
  if (b.as_of) chips.push(['Market as of', prettyDate(b.as_of)]);
  return '<div class="facts">' + chips.map(function (x) {{
    return '<div class="fact"><span class="fk">' + esc(x[0]) + '</span><span class="fv">' + esc(x[1]) + '</span></div>';
  }}).join('') + '</div>';
}}
function weekScoreHtml(asOf) {{
  const hist = ((DATA.brief || {{}}).history || []);
  const row = hist.find(function (w) {{ return weekAsOf(w) === weekKey(asOf); }}) || {{}};
  const wc = weekCounts(asOf);
  const listed = Number(wc.listed || row.listed_week || row.listed_week || 0);
  const uc = Number(wc.uc || row.uc_week || row.uc_week || 0);
  const sold = Number(wc.sold || row.sold_week || row.sold_week || 0);
  return '<p class="week-stat" id="weekScore"><b>' + listed + '</b> listed · <b>' +
    uc + '</b> under contract · <b>' + sold + '</b> sold</p>';
}}
function sinceLineHtml(d) {{
  return '<p class="since-line">Since listed: <b>' + Number(d.listed_since || 0) + '</b> listed · <b>' +
    Number(d.uc_since || 0) + '</b> under contract · <b>' + Number(d.sold_since || 0) + '</b> sold in this set</p>';
}}
function weeksHtml() {{
  const hist = ((DATA.brief || {{}}).history || []);
  if (!hist.length) return '';
  const current = weekKey((DATA.brief || {{}}).as_of) || weekAsOf(hist[hist.length - 1]);
  const d = DATA.digest || (DATA.brief || {{}}).digest || {{}};
  return '<div class="walk" id="walkWeeks"><h2>Walk the weeks</h2>' +
    '<p class="sub">Same similar set, week by week. Tap a date to walk listed, under contract, and sold that week.</p>' +
    '<div class="weeks-bar"><div class="weeks">' + hist.map(function (w) {{
      const asOf = weekAsOf(w);
      const on = asOf === current ? ' is-on' : '';
      return '<button type="button" class="week' + on + '" data-asof="' + esc(asOf) + '" id="week-' + esc(asOf) + '">' +
        weekLabel(asOf) + '</button>';
    }}).join('') + '</div></div>' +
    weekScoreHtml(current) +
    weekHomesHtml(current) +
    sinceLineHtml(d) + '</div>';
}}
function fromAgentHtml() {{
  const notes = (DATA.notes || []).filter(function (n) {{ return n.status === 'published' && n.body; }});
  const who = DATA.agent_name || 'your agent';
  const talk = (((DATA.brief || {{}}).talk || (DATA.brief || {{}}).talk || {{}})[DATA.agent ? 'agent' : 'seller'] || []);
  const current = weekKey((DATA.brief || {{}}).as_of);
  const sorted = notes.slice().sort(function (a, b) {{ return weekKey(b.as_of).localeCompare(weekKey(a.as_of)); }});
  const latest = sorted.find(function (n) {{ return weekKey(n.as_of) === current; }}) || sorted[0];
  const older = sorted.filter(function (n) {{ return n !== latest; }});
  if (!latest && !talk.length) return '';
  let html = '<div class="from-agent" id="note-' + esc(weekKey((latest && latest.as_of) || current)) + '">' +
    '<div class="kicker">Weekly summary</div>' +
    '<h2>This week from ' + esc(who) + '</h2>' +
    '<p class="when">Week of ' + weekLabel((latest && latest.as_of) || current) +
    (latest && latest.published_at ? ' · shared ' + weekLabel(latest.published_at) : '') + '</p>';
  if (latest && latest.body) {{
    html += '<p class="body">' + esc(latest.body) + '</p>';
  }}
  if (talk.length) {{
    html += '<div class="recs"><div class="recs-k">Recommendations this week</div><ul>' +
      talk.map(function (t) {{ return '<li>' + esc(t) + '</li>'; }}).join('') + '</ul></div>';
  }}
  if (older.length) {{
    html += '<label class="past-pick">Earlier weeks <select id="pastNotePick">' +
      '<option value="">This week</option>' +
      older.map(function (n) {{
        return '<option value="' + esc(weekKey(n.as_of)) + '">Week of ' + weekLabel(n.as_of) + '</option>';
      }}).join('') + '</select></label>' +
      '<div id="pastNotePanel" hidden></div>';
  }}
  return html + '</div>';
}}
function weekMotion(asOf) {{
  const hist = ((DATA.brief || {{}}).history || []);
  const row = hist.find(function (w) {{ return weekAsOf(w) === weekKey(asOf); }}) || {{}};
  const wins = weekWindows();
  const key = weekKey(asOf);
  const w = wins.find(function (x) {{ return (x.as_of || x.as_of) === key; }}) || wins[wins.length - 1];
  const locked = listPrice();
  const out = {{ listed: 0, under: 0, over: 0, uc: 0, sold: 0 }};
  if (w) {{
    homesForWeek(w.as_of || w.as_of).forEach(function (c) {{
      if (listDate(c) && inWeek(listDate(c), w.start, w.end)) {{
        out.listed += 1;
        const side = c.side || (c.price < locked ? 'under' : c.price > locked ? 'over' : 'at');
        if (side === 'under') out.under += 1;
        else if (side === 'over') out.over += 1;
      }}
      let sold = false;
      let uc = false;
      statusHistory(c).forEach(function (h) {{
        if (!inWeek(h.as_of || h.as_of, w.start, w.end)) return;
        const st = String(h.status || '').toLowerCase();
        if (st === 'sold') sold = true;
        else if (isUc(st)) uc = true;
      }});
      if (sold) out.sold += 1;
      else if (uc) out.uc += 1;
    }});
  }}
  if (!out.listed && !out.uc && !out.sold) {{
    out.listed = Number(row.listed_week || 0);
    out.under = Number(row.listed_under_week || 0);
    out.over = Number(row.listed_over_week || 0);
    out.uc = Number(row.uc_week || 0);
    out.sold = Number(row.sold_week || 0);
  }}
  return out;
}}
function boardHtml() {{
  const d = DATA.digest || (DATA.brief || {{}}).digest || {{}};
  const hist = ((DATA.brief || {{}}).history || []).slice().sort(function (a, b) {{
    return weekAsOf(a).localeCompare(weekAsOf(b));
  }});
  const current = weekKey((DATA.brief || {{}}).as_of) || (hist.length ? weekAsOf(hist[hist.length - 1]) : '');
  const week = weekMotion(current);
  const locked = listPrice();
  const sinceKind = clockKind() === 'active' ? 'Since you listed' : 'Since this Fingerprint';
  const since = {{
    listed: Number(d.listed_since || 0),
    under: Number(d.listed_under_since != null ? d.listed_under_since : (d.new_under || 0)),
    over: Number(d.listed_over_since != null ? d.listed_over_since : (d.new_over || 0)),
    uc: Number(d.uc_since || 0),
    sold: Number(d.sold_since || 0)
  }};
  function stats(pack) {{
    return '<div class="board-grid">' +
      '<div class="board-stat"><div class="board-n">' + pack.listed + '</div><div class="board-l">New</div><div class="board-h">Listed into this set</div></div>' +
      '<div class="board-stat is-under"><div class="board-n">' + pack.under + '</div><div class="board-l">Under list</div><div class="board-h">New lists below ' + money(locked) + '</div></div>' +
      '<div class="board-stat is-over"><div class="board-n">' + pack.over + '</div><div class="board-l">Over list</div><div class="board-h">New lists above ' + money(locked) + '</div></div>' +
      '<div class="board-stat"><div class="board-n">' + pack.uc + '</div><div class="board-l">Under contract</div><div class="board-h">Pending / backup / first-right</div></div>' +
      '<div class="board-stat"><div class="board-n">' + pack.sold + '</div><div class="board-l">Sold</div><div class="board-h">Closed in this set</div></div>' +
    '</div>';
  }}
  function totalCard(label, pack) {{
    const moved = Number(pack.listed || 0) + Number(pack.uc || 0) + Number(pack.sold || 0);
    return '<div class="board-total"><div class="k">' + esc(label) + '</div>' +
      '<div class="v">' + moved + ' homes moved</div>' +
      '<div class="s">' + pack.listed + ' listed · ' + pack.under + ' under your price · ' + pack.over +
      ' over your price · ' + pack.uc + ' under contract · ' + pack.sold + ' sold</div></div>';
  }}
  const sums = {{ listed: 0, under: 0, over: 0, uc: 0, sold: 0 }};
  hist.forEach(function (w) {{
    const m = weekMotion(weekAsOf(w));
    sums.listed += m.listed; sums.under += m.under; sums.over += m.over; sums.uc += m.uc; sums.sold += m.sold;
  }});
  const rows = hist.map(function (w) {{
    const asOf = weekAsOf(w);
    const m = weekMotion(asOf);
    const on = asOf === current ? ' is-on' : '';
    return '<tr class="board-week' + on + '" data-asof="' + esc(asOf) + '">' +
      '<td>' + weekLabel(asOf) + '</td>' +
      '<td>' + m.listed + '</td>' +
      '<td class="is-under">' + m.under + '</td>' +
      '<td class="is-over">' + m.over + '</td>' +
      '<td>' + m.uc + '</td>' +
      '<td>' + m.sold + '</td></tr>';
  }}).join('');
  return '<section class="board" id="marketBoard">' +
    '<div class="board-top"><div class="kicker">Market board</div>' +
    '<h2>What happened around your list</h2>' +
    '<p class="sub">New similar listings split under and over your initial list of <b>' + money(locked) +
    '</b>. Under contract groups pending, backup, and first-right. Tap a week to walk those homes.</p></div>' +
    '<div class="board-panes">' +
      '<div class="board-pane"><div class="board-pane-h"><span>This week</span><small>' + weekLabel(current) + '</small></div>' + stats(week) + '</div>' +
      '<div class="board-pane"><div class="board-pane-h"><span>' + esc(sinceKind) + '</span><small>Running total</small></div>' + stats(since) + '</div>' +
    '</div>' +
    '<div class="board-totals">' + totalCard('This week', week) + totalCard(sinceKind, since) + '</div>' +
    (hist.length
      ? '<div class="board-table-wrap"><table class="board-table"><thead><tr>' +
        '<th>Week</th><th>New</th><th>Under list</th><th>Over list</th><th>Under contract</th><th>Sold</th>' +
        '</tr></thead><tbody>' + rows + '</tbody>' +
        '<tfoot><tr><td>Total</td><td>' + sums.listed + '</td><td class="is-under">' + sums.under +
        '</td><td class="is-over">' + sums.over + '</td><td>' + sums.uc + '</td><td>' + sums.sold + '</td></tr></tfoot></table></div>'
      : '') +
    '</section>';
}}
function mapKind(c) {{
  const st = String((c && c.status) || '').toLowerCase();
  if (st === 'sold') return 'sold';
  if (st === 'pending' || st === 'backup' || st === 'firstright' || st.indexOf('contract') >= 0) return 'uc';
  return 'active';
}}
function mapPoints() {{
  const seen = {{}};
  const pts = [];
  function add(c, kind) {{
    if (!c || seen[c.id]) return;
    const lat = Number(c.lat), lng = Number(c.lng);
    if (!isFinite(lat) || !isFinite(lng) || (lat === 0 && lng === 0)) return;
    seen[c.id] = 1;
    pts.push({{
      id: c.id,
      lat: lat,
      lng: lng,
      kind: kind || mapKind(c),
      address: c.address || '',
      price: c.price,
      status: c.status || ''
    }});
  }}
  const b = DATA.brief || {{}};
  const subLat = Number(DATA.subject_lat || b.subject_lat);
  const subLng = Number(DATA.subject_lng || b.subject_lng);
  if (isFinite(subLat) && isFinite(subLng) && !(subLat === 0 && subLng === 0)) {{
    seen.subject = 1;
    pts.push({{
      id: 'subject',
      lat: subLat,
      lng: subLng,
      kind: 'you',
      address: b.subject_address || 'Your list',
      price: b.locked_price,
      status: 'Your list'
    }});
  }}
  [b.still_active, b.pending_now, b.went_pending, b.went_sold, b.baseline, b.new_under, b.new_over, b.position].forEach(function (pool) {{
    (pool || []).forEach(function (c) {{
      if (c && c.subject) return;
      add(c, mapKind(c));
    }});
  }});
  return pts;
}}
function mapHtml() {{
  if (!DATA.mapbox_token) return '';
  return '<section class="fp-map" id="fpMap">' +
    '<h2>Where this set sits</h2>' +
    '<p class="sub">Pins are the same similar homes from the market file. Gold is your list. Tap a pin to open the listing.</p>' +
    '<div class="fp-map-legend">' +
      '<span><i class="is-you"></i>Your list</span>' +
      '<span><i class="is-active"></i>Active</span>' +
      '<span><i class="is-uc"></i>Under contract</span>' +
      '<span><i class="is-sold"></i>Sold</span>' +
    '</div>' +
    '<div class="fp-map-canvas" id="fpMapCanvas"></div></section>';
}}
let fpMap = null;
function bindMap() {{
  const wrap = document.getElementById('fpMap');
  const el = document.getElementById('fpMapCanvas');
  const token = DATA.mapbox_token;
  if (fpMap) {{
    fpMap.remove();
    fpMap = null;
  }}
  if (!wrap || !el || typeof mapboxgl === 'undefined' || !token) {{
    if (wrap && (!token || typeof mapboxgl === 'undefined')) wrap.style.display = 'none';
    return;
  }}
  const pts = mapPoints();
  if (!pts.length) {{
    wrap.style.display = 'none';
    return;
  }}
  wrap.style.display = '';
  mapboxgl.accessToken = token;
  fpMap = new mapboxgl.Map({{
    container: el,
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [pts[0].lng, pts[0].lat],
    zoom: 12
  }});
  fpMap.addControl(new mapboxgl.NavigationControl({{ showCompass: false }}), 'top-right');
  const bounds = new mapboxgl.LngLatBounds();
  pts.forEach(function (p) {{
    bounds.extend([p.lng, p.lat]);
    const pin = document.createElement('div');
    pin.className = 'fp-pin is-' + p.kind;
    pin.title = p.address || '';
    pin.addEventListener('click', function () {{
      if (p.id && p.id !== 'subject') openDrawer(p.id);
    }});
    new mapboxgl.Marker({{ element: pin }})
      .setLngLat([p.lng, p.lat])
      .setPopup(new mapboxgl.Popup({{ offset: 12, closeButton: false }}).setHTML(
        '<strong>' + esc(p.address || 'Listing') + '</strong><div>' + money(p.price) + '</div>'
      ))
      .addTo(fpMap);
  }});
  fpMap.on('load', function () {{
    fpMap.resize();
    if (pts.length > 1) fpMap.fitBounds(bounds, {{ padding: 48, maxZoom: 14 }});
  }});
}}
function bindBoard() {{
  document.querySelectorAll('#marketBoard .board-week').forEach(function (el) {{
    el.addEventListener('click', function () {{
      selectWeek(el.getAttribute('data-asof'), true);
    }});
  }});
}}
let photosKicked = false;
function paintPhotos(photos, galleries) {{
  function compact(s) {{
    return String(s || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48);
  }}
  function lookup(store, c, whole) {{
    if (!store || !c) return '';
    const keys = [c.mls, c.id, c.address, compact(c.mls), compact(c.id), compact(c.address)];
    for (let i = 0; i < keys.length; i++) {{
      const k = keys[i];
      if (!k || !store[k]) continue;
      const v = store[k];
      if (whole) return v;
      return Array.isArray(v) ? (v[0] || '') : v;
    }}
    return '';
  }}
  function apply(c) {{
    if (!c) return;
    const url = lookup(photos, c);
    if (url) {{
      c.photo_url = c.photo_url || url;
      const gal = lookup(galleries, c, true);
      if (!c.photos || !c.photos.length) c.photos = gal ? (Array.isArray(gal) ? gal : [gal]) : [url];
    }}
  }}
  const b = DATA.brief || {{}};
  [b.still_active, b.new_under, b.new_over, b.baseline, b.went_pending, b.went_sold, b.pending_now, b.price_cuts, b.cheaper_active, b.position].forEach(function (pool) {{
    (pool || []).forEach(apply);
  }});
  document.querySelectorAll('.lane-home[data-id], .lane-home[data-id]').forEach(function (el) {{
    const c = byId(el.getAttribute('data-id') || el.getAttribute('data-id'));
    const url = photoUrl(c);
    const pic = el.querySelector('.lane-pic, .lane-pic');
    if (pic && url) {{
      pic.classList.remove('empty');
      pic.style.backgroundImage = 'url(\\'' + String(url).replace(/'/g, '%27') + '\\')';
    }}
  }});
}}
function kickPhotos() {{
  if (photosKicked) return;
  photosKicked = true;
  const run = DATA.run_id;
  if (!run) return;
  const banner = document.getElementById('photoBanner');
  if (banner && DATA.photos_fetching) banner.classList.add('is-on');
  const reloadKey = 'll-fp-photos-' + run;
  function tick(info) {{
    if (!info) return;
    paintPhotos(info.photos || {{}}, info.galleries || {{}});
    const fetching = info.status === 'fetching' || info.status === 'pending' || DATA.photos_fetching;
    if (banner) banner.classList.toggle('is-on', !!(fetching && info.status !== 'ready'));
    if (info.status === 'fetching' || info.status === 'pending') {{
      DATA.photos_fetching = true;
      setTimeout(function () {{
        fetch('/api/runs/' + encodeURIComponent(run) + '/comp-photos', {{ credentials: 'same-origin' }})
          .then(function (r) {{ return r.json(); }})
          .then(function (next) {{ DATA.photos_fetching = (next.status === 'fetching' || next.status === 'pending'); tick(next); }})
          .catch(function () {{}});
      }}, 2500);
      return;
    }}
    DATA.photos_fetching = false;
    if (banner) banner.classList.remove('is-on');
    const empty = document.querySelectorAll('.lane-pic.empty, .lane-pic.empty').length;
    if (Object.keys(info.photos || {{}}).length && empty > 2 && !sessionStorage.getItem(reloadKey)) {{
      sessionStorage.setItem(reloadKey, '1');
      location.reload();
    }}
  }}
  fetch('/api/runs/' + encodeURIComponent(run) + '/comp-photos/fetch', {{ method: 'POST', credentials: 'same-origin' }})
    .then(function (r) {{ return r.json(); }})
    .then(tick)
    .catch(function () {{ if (banner) banner.classList.remove('is-on'); }});
}}
function bindFromAgent() {{
  const pick = document.getElementById('pastNotePick');
  const panel = document.getElementById('pastNotePanel');
  if (!pick || !panel) return;
  const notes = (DATA.notes || []).filter(function (n) {{ return n.status === 'published' && n.body; }});
  pick.addEventListener('change', function () {{
    const key = weekKey(pick.value);
    if (!key) {{
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }}
    const n = notes.find(function (row) {{ return weekKey(row.as_of) === key; }});
    if (!n) {{
      panel.hidden = true;
      return;
    }}
    panel.hidden = false;
    panel.innerHTML = '<div class="past-note" id="note-' + esc(key) + '"><strong>Week of ' +
      weekLabel(n.as_of) + '</strong><p>' + esc(n.body) + '</p></div>';
  }});
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
function storyHtml(d) {{
  const listedW = Number(d.listed_week || 0);
  const ucW = Number(d.uc_week || 0);
  const soldW = Number(d.sold_week || 0);
  const bits = [];
  if (listedW) bits.push(listedW + ' similar home' + (listedW === 1 ? '' : 's') + ' listed');
  if (ucW) bits.push(ucW + ' went under contract');
  if (soldW) bits.push(soldW + ' sold');
  const lead = bits.length
    ? ('This week: ' + bits.join(', ') + '.')
    : 'Quiet this week — no similar lists, under contracts, or sales.';
  const since = sinceLabel();
  const long = since + ': ' + Number(d.listed_since || 0) + ' listed, ' +
    Number(d.uc_since || 0) + ' under contract, ' + Number(d.sold_since || 0) + ' sold in this size band.';
  const why = clockKind() === 'active'
    ? 'These are homes like yours — same size band, around your list price. Under contract means a buyer chose that home instead of waiting.'
    : 'Not listed yet. Counts run from generate until you set the listed date; then this board switches to since you listed.';
  return '<div class="story"><p class="lead">' + esc(lead) + '</p><p class="long">' + esc(long) + '</p></div>' +
    '<p class="why">' + esc(why) + '</p>';
}}
function scoreboardHtml(d) {{
  const since = sinceLabel();
  const listedSince = Number(d.listed_since != null ? d.listed_since : ((d.new_under || 0) + (d.new_over || 0)));
  const ucSince = Number(d.uc_since != null ? d.uc_since : d.went_pending || 0);
  const soldSince = Number(d.sold_since != null ? d.sold_since : d.went_sold || 0);
  function numCell(n, label, dark) {{
    return '<div class="cell"><div class="n">' + (n == null || n === '' ? '0' : n) + '</div><div class="l">' + esc(label) + '</div></div>';
  }}
  return storyHtml(d) +
    '<div class="week-nums">' +
      numCell(d.listed_week, 'Listed this week') +
      numCell(d.uc_week, 'Under contract this week') +
      numCell(d.sold_week, 'Sold this week') +
    '</div>' +
    '<div class="since-nums">' +
      numCell(listedSince, 'Listed ' + since) +
      numCell(ucSince, 'Under contract ' + since) +
      numCell(soldSince, 'Sold ' + since) +
    '</div>' +
    '<p class="legend"><b>Listed</b> new similar homes · <b>Under contract</b> pending/backup/first-right · <b>Sold</b> closed in this band</p>' +
    '<div class="score">' +
      [['v', (d.active_count != null && d.baseline_active != null) ? (d.active_count + ' / ' + d.baseline_active) : (d.active_count ?? '—'), 'Active now vs at list'],
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
    '<p class="sub">Each pin is a similar active. Hover to name it — tap to open the home. Your list is the gold pin.</p>' +
    sortsHtml('strip') +
    '<div class="strip" id="priceStrip"><div class="rail"></div>' + ticks + '</div>' +
    '<p class="strip-now" id="stripNow">Hover a pin — tap to open that home.</p></div>';
}}
function pinCaption(p) {{
  if (!p) return 'Hover a pin — tap to open that home.';
  const who = p.subject ? 'Your list' : (streetLine(p) || p.address || 'Listing');
  const bits = homeBits(p);
  return '<b>' + esc(who) + '</b> · ' + money(p.price) + (bits ? ' <span>' + esc(bits) + '</span>' : '');
}}
function positionById(id) {{
  const pos = ((DATA.brief || {{}}).position || []);
  return pos.find(function (p) {{ return String(p.id) === String(id); }}) || byId(id);
}}
function showPin(id, tickEl) {{
  const cap = document.getElementById('stripNow');
  const p = positionById(id);
  document.querySelectorAll('.tick, .lane-home, .card').forEach(function (el) {{
    el.classList.toggle('is-pin', el.getAttribute('data-id') === String(id));
  }});
  if (cap) cap.innerHTML = pinCaption(p);
}}
function hidePin() {{
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
  const talk = ((b.talk || b.talk || {{}})[DATA.agent ? 'agent' : 'seller'] || []);
  const pos = b.position || [];
  document.getElementById('main').innerHTML =
    '<div class="hero">' + photo + '<div class="veil"></div><div class="copy">' +
      '<div class="kicker">Market Fingerprint</div>' +
      '<h1>' + esc(b.subject_address || 'This listing') + '</h1>' +
      statusLine +
      '<div class="links">' +
        (b.report_url ? '<a href="' + esc(b.report_url) + '">Live Story</a>' : '') +
        (DATA.agent && DATA.share_url ? '<a href="' + esc(DATA.share_url.replace(/\\/?$/, '/')) + 'fingerprint/">Seller link</a>' : '') +
      '</div></div></div>' +
    filtersHtml() +
    factsHtml(b, d) +
    fromAgentHtml() +
    boardHtml() +
    mapHtml() +
    (DATA.stale_upload ? '<p class="note">' + (DATA.agent
      ? 'Upload this week’s MLS export to refresh. The seller still sees the last file on hand.'
      : 'This picture uses the last market file we have. Ask your agent to refresh it with this week’s export.') + '</p>' : '') +
    nowLanesHtml() +
    stripHtml(pos, d) +
    weeksHtml() +
    lanesHtml();

  if (DATA.agent) renderConsole();
  bindWeeks();
  bindFromAgent();
  bindBoard();
  bindMap();
  bindSorts();
  bindPins();
  const hist = (b.history || []);
  const current = weekKey(b.as_of) || (hist.length ? weekAsOf(hist[hist.length - 1]) : '');
  if (current) selectWeek(current, false);
  document.querySelectorAll('.card, .lane-home').forEach(el => {{
    el.addEventListener('click', () => openDrawer(el.getAttribute('data-id')));
  }});
  kickPhotos();
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
    '<label>Initial list price</label>' +
    '<input type="number" id="lockPrice" value="' + (DATA.lock.locked_price || '') + '" step="1000">' +
    '<button type="button" class="btn-gold" id="btnLock">Update list price</button>' +
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
    status('Saving list price…');
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
let galPics = [];
let galIdx = 0;
function closeDrawer() {{
  const d = document.getElementById('drawer');
  if (!d) return;
  d.classList.remove('open');
  d.hidden = true;
  galPics = [];
  galIdx = 0;
}}
function paintGallery() {{
  const img = document.getElementById('galPic');
  const count = document.getElementById('galCount');
  if (!img || !galPics.length) return;
  img.src = galPics[galIdx];
  if (count) count.textContent = (galIdx + 1) + ' / ' + galPics.length;
}}
function bindGallery() {{
  const prev = document.getElementById('galPrev');
  const next = document.getElementById('galNext');
  if (prev) prev.addEventListener('click', function (ev) {{
    ev.stopPropagation();
    if (!galPics.length) return;
    galIdx = (galIdx + galPics.length - 1) % galPics.length;
    paintGallery();
  }});
  if (next) next.addEventListener('click', function (ev) {{
    ev.stopPropagation();
    if (!galPics.length) return;
    galIdx = (galIdx + 1) % galPics.length;
    paintGallery();
  }});
}}
function openDrawer(id) {{
  const c = byId(id);
  if (!c) return;
  galPics = (c.photos && c.photos.length ? c.photos : (c.photo_url ? [c.photo_url] : [])).filter(Boolean);
  galIdx = 0;
  const hist = (c.status_history || []).map(h => '<li>' + esc(h.as_of) + ' · ' + esc(h.status) + ' · ' + money(h.price) + '</li>').join('');
  const maps = mapsHref(c);
  const links = [];
  if (maps) links.push('<a href="' + esc(maps) + '" target="_blank" rel="noopener">Map</a>');
  if (c.zillow) links.push('<a href="' + esc(c.zillow) + '" target="_blank" rel="noopener">Zillow</a>');
  if (c.realtor) links.push('<a href="' + esc(c.realtor) + '" target="_blank" rel="noopener">Realtor.com</a>');
  const gal = galPics.length
    ? '<div class="gallery"><img class="dpic" id="galPic" src="' + esc(galPics[0]) + '" alt="">' +
      (galPics.length > 1
        ? '<button type="button" class="gal-btn gal-prev" id="galPrev" aria-label="Previous photo">‹</button>' +
          '<button type="button" class="gal-btn gal-next" id="galNext" aria-label="Next photo">›</button>' +
          '<div class="gal-count" id="galCount">1 / ' + galPics.length + '</div>'
        : '') +
      '</div>'
    : '<div class="gallery"><div class="dpic empty"></div></div>';
  document.getElementById('drawerBody').innerHTML =
    gal +
    '<div class="panel-body">' +
    '<h3>' + esc(c.address) + '</h3>' +
    (c.city ? '<p class="meta">' + esc(c.city) + '</p>' : '') +
    '<p class="price-line">' + money(c.price) + (c.delta ? ' · ' + (c.delta > 0 ? '+' : '') + money(c.delta) + ' vs list' : '') + '</p>' +
    '<p class="meta">' + esc([c.status, c.beds ? c.beds + ' bd' : '', c.baths ? c.baths + ' ba' : '', c.sqft ? Number(c.sqft).toLocaleString() + ' sf' : '', c.dom ? c.dom + ' DOM' : ''].filter(Boolean).join(' · ')) + '</p>' +
    (hist ? '<p class="meta" style="margin-top:14px;text-transform:uppercase;letter-spacing:.06em;font-size:.72rem;">Status</p><ul>' + hist + '</ul>' : '') +
    (links.length ? '<p style="margin-top:14px;font-size:.88rem">' + links.join(' · ') + '</p>' : '') +
    '</div>';
  const d = document.getElementById('drawer');
  d.hidden = false; d.classList.add('open');
  bindGallery();
}}
document.getElementById('drawerClose').addEventListener('click', closeDrawer);
document.getElementById('drawer').addEventListener('click', (e) => {{
  if (e.target.id === 'drawer') closeDrawer();
}});
document.addEventListener('keydown', function (e) {{
  if (e.key === 'Escape') closeDrawer();
}});
(function () {{
  const sample = DATA.run_id === 'sample-2845' || /[?&]sample=1(?:&|$)/.test(location.search);
  const bar = document.getElementById('sampleDemoBar');
  if (bar && sample) bar.classList.add('is-on');
}})();
render();
</script>
</body>
</html>
"""
