"""Interactive ListLogic presentation — dashboard + Path-to-price spine."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any
from urllib.parse import quote as url_quote

ROOT = Path(__file__).resolve().parent


def _mapbox_token() -> str:
    """Public Mapbox token for report maps (pk.*). Prefer env; fall back to .env."""
    for key in ("MAPBOX_ACCESS_TOKEN", "MAPBOX_TOKEN", "VITE_MAPBOX_TOKEN"):
        val = (os.environ.get(key) or "").strip()
        if val:
            return val
    env_path = ROOT / ".env"
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


def _clean(obj: Any) -> Any:
    if isinstance(obj, float):
        if obj != obj or obj in (float("inf"), float("-inf")):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_clean(v) for v in obj]
    return obj


def render_interactive_html(report: dict) -> str:
    report = _clean(report)
    s = report["stats"]
    pos = report.get("positioning") or {}
    subject = report.get("subject") or {}
    meta = report.get("meta") or {}
    story = report.get("story") or {}
    full_table = report.get("full_table") or []
    all_cols = report.get("table_columns") or []
    default_cols = report.get("default_columns") or [
        "Status", "MLSNumber", "Address", "DisplayPrice", "LivingArea",
        "Beds", "Baths", "YearBuilt", "DOM", "PPSF",
    ]
    yoy = report.get("chart_yoy") or {}

    inv = float(s.get("months_of_inventory") or story.get("months_of_inventory") or 0)
    odds_pct = (s.get("odds_of_selling") or story.get("market_odds") or 0) * 100
    rec = float(pos.get("recommended_price") or 0)
    low = float(pos.get("price_low") or 0)
    high = float(pos.get("price_high") or 0)
    exp_dom = float(pos.get("expected_dom") or 0)
    active_n = int(story.get("active_on_market") or report.get("active_count") or s.get("active_count") or 0)
    with_yours = int(story.get("with_your_home") or (active_n + 1))
    uc_n = int(story.get("under_contract") or report.get("under_contract_count") or s.get("pending_count") or 0)
    sales_mo = float(story.get("sales_per_month") or s.get("absorption_rate") or 0)
    home_rating = int(story.get("home_rating") or 5)
    top_mkt = float(story.get("top_of_market_pct") or 50)
    top_stmt = story.get("top_percent_statement") or ""
    objections = story.get("objection_cards") or []
    median_dom = float(story.get("median_dom") or s.get("median_dom") or 45)
    ask = story.get("seller_questions") or {}
    price_bands = report.get("chart_active_price_bands") or {}
    band_insight = price_bands.get("insight") or ""
    lf = report.get("listing_flow") or {}
    lf_chart = report.get("chart_listing_flow") or lf.get("chart") or {}
    lf_new_pm = float(lf.get("new_listings_per_month") or 0)
    lf_sales_pm = float(lf.get("sales_per_month") or sales_mo)
    lf_pressure = float(lf.get("supply_pressure") or 0)
    lf_net = float(lf.get("net_inventory_per_month") or 0)
    lf_below_pm = float(lf.get("new_below_recommended_per_month") or 0)
    lf_active_below = int(lf.get("active_below_recommended_now") or 0)
    lf_insight = lf.get("insight") or ""
    lf_overprice = lf.get("overprice_insight") or ""
    lf_wait_fresh = float(lf.get("fresh_during_median_dom") or 0)
    lf_wait_dom = float(lf.get("median_dom_for_wait") or median_dom or 0)
    if not lf_wait_fresh and lf_below_pm > 0 and median_dom > 0:
        lf_wait_fresh = round(lf_below_pm * (median_dom / 30.44), 1)
        lf_wait_dom = median_dom
    show_listing_flow = bool(lf_new_pm > 0 or (lf_chart.get("labels")))
    if lf_pressure >= 1.15:
        lf_pressure_tone = "building"
        lf_pressure_headline = "Supply Is Building"
        lf_pressure_blurb = "New listings are arriving faster than this segment clears — inventory pressure rises while a home sits."
    elif lf_pressure >= 0.85:
        lf_pressure_tone = "balanced"
        lf_pressure_headline = "Supply Is Roughly Balanced"
        lf_pressure_blurb = "New listings and sales are roughly keeping pace — pricing still decides who buyers tour first."
    else:
        lf_pressure_tone = "draining"
        lf_pressure_headline = "Inventory Is Draining"
        lf_pressure_blurb = "Sales are outpacing new listings — well-priced homes have more leverage right now."
    lf_flow_total = lf_new_pm + lf_sales_pm
    lf_new_share = round(100 * lf_new_pm / lf_flow_total, 1) if lf_flow_total else 50.0
    lf_sale_share = round(100 - lf_new_share, 1)
    llm_on = bool(report.get("llm_enhanced"))

    temp_label = (
        "Strong Seller's Market" if inv < 2.5 else
        "Seller-Favorable" if inv < 4 else
        "Balanced Market" if inv < 6 else
        "Buyer-Favorable"
    )
    temp_class = "hot" if inv < 2.5 else "warm"

    # Prefer recent sales first so the map stays readable when capped
    raw_points = [p for p in report.get("scatter_points", []) if p.get("LivingArea") and p.get("SoldPrice")]
    def _sold_key(p):
        sd = p.get("SoldDate")
        return str(sd) if sd is not None else ""
    raw_points.sort(key=_sold_key, reverse=True)
    points = raw_points[:280]
    scatter_pts = []
    for p in points:
        sd = p.get("SoldDate")
        if hasattr(sd, "strftime"):
            sold_date = sd.strftime("%Y-%m-%d")
        else:
            sold_date = str(sd or "")[:10]
        scatter_pts.append({
            "x": p["LivingArea"],
            "y": p["SoldPrice"],
            "label": (p.get("Address") or "")[:32],
            "sold_date": sold_date,
        })
    actives = story.get("active_scatter") or []
    trend = report.get("scatter_trend") or {"slope": 0, "intercept": 0}
    xs = [p["x"] for p in scatter_pts]
    trend_pts = (
        [
            {"x": min(xs), "y": trend["slope"] * min(xs) + trend["intercept"]},
            {"x": max(xs), "y": trend["slope"] * max(xs) + trend["intercept"]},
        ]
        if xs else []
    )
    subject_pt = None
    if subject.get("living_area") and rec:
        subject_pt = {
            "x": subject["living_area"],
            "y": subject.get("list_price") or rec,
            "label": subject.get("address") or "Your Home",
        }

    monthly = report.get("chart_monthly_sales") or {"labels": [], "values": []}
    yearly = report.get("chart_yearly_sales") or {"labels": [], "values": []}
    monthly_price = report.get("chart_monthly_price") or {"labels": [], "values": []}
    monthly_price_bands = report.get("chart_monthly_price_bands") or {}
    monthly_dom = report.get("chart_monthly_dom") or {"labels": [], "values": []}
    dom_dist = report.get("chart_dom") or {"labels": [], "values": [], "median": 0}
    scenarios = pos.get("price_scenarios") or []
    comps = pos.get("closest_comps") or []
    advantages = pos.get("advantages") or ["Solid fundamentals"]
    risks = pos.get("risks") or ["Overpricing risk"]
    adv_text = "\n".join(advantages)
    risk_text = "\n".join(risks)
    obj_text = "\n".join(
        f"{c.get('title', 'Note')}|{c.get('body', '')}" for c in objections
    ) if objections else ""
    exec_sum = report.get("executive_summary") or ""
    copy_ledes = report.get("copy_ledes") if isinstance(report.get("copy_ledes"), dict) else {}
    lede_comps = copy_ledes.get("comps") or (
        "Ranked by similarity to your home — size, beds/baths, age, garage, and how recently it sold, "
        "inside a comp-supported price band. Tap a home for the full gallery."
    )
    lede_condition = copy_ledes.get("condition") or (
        "Look at the comps above. Condition, updates, and curb appeal change what buyers will pay. "
        "Lock a band — or fine-tune 1–10 — and we’ll apply it when we set the list."
    )
    lede_close = copy_ledes.get("close") or (
        "We'll fine-tune condition, lock the list, and launch with a plan buyers can believe."
    )

    agent_line = meta.get("agent_name") or ""
    if meta.get("brokerage"):
        agent_line += f" · {meta['brokerage']}"
    agent_name_only = (meta.get("agent_name") or "Agent").strip()
    agent_initials = "".join(p[0] for p in agent_name_only.split()[:2] if p).upper() or "A"
    contact_bits = []
    if meta.get("agent_phone"):
        contact_bits.append(str(meta["agent_phone"]))
    if meta.get("agent_email"):
        contact_bits.append(str(meta["agent_email"]))
    agent_contact = " · ".join(contact_bits)

    brand_primary = meta.get("brand_primary") or "#0c3c6e"
    brand_accent = meta.get("brand_accent") or "#1a5f9e"
    logo_url = meta.get("logo_url") or "/saas/listlogic-logo.png"
    area = report.get("area") or ""
    link_city = meta.get("city") or (area.split(",")[0].strip() if area else "Greeley")
    link_state = meta.get("state") or "CO"
    generated = meta.get("generated") or report.get("generated_at") or ""

    subject_line = ""
    if subject:
        bits = [subject.get("address") or "Subject"]
        if subject.get("living_area"):
            bits.append(f"{subject['living_area']:,.0f} sf")
        if subject.get("beds"):
            bits.append(f"{subject['beds']:.0f}/{subject.get('baths', 0):.0f}")
        if subject.get("year_built"):
            bits.append(str(subject["year_built"]))
        subject_line = " · ".join(bits)

    hero_title = subject.get("address") or "Market Pricing Presentation"
    chip_bits = []
    if subject.get("living_area"):
        chip_bits.append(f"{subject['living_area']:,.0f} sq ft")
    if subject.get("beds"):
        chip_bits.append(f"{subject['beds']:.0f} bed · {subject.get('baths', 0):.0f} bath")
    if subject.get("year_built"):
        chip_bits.append(f"Built {subject['year_built']:.0f}" if isinstance(subject["year_built"], float) else f"Built {subject['year_built']}")
    if area:
        chip_bits.append(area)
    hero_chips = "".join(f'<span class="chip">{b}</span>' for b in chip_bits)

    comps_payload = []
    sub_sqft = float(subject.get("living_area") or 0)
    sub_beds = float(subject.get("beds") or 0)
    sub_baths = float(subject.get("baths") or 0)
    sub_year = float(subject.get("year_built") or 0) if subject.get("year_built") not in (None, "") else 0
    sub_gar = float(subject.get("garage_spaces") or 0)
    raw_scores = [float(c.get("distance_score") or 0) for c in comps]
    best_score = min(raw_scores) if raw_scores else 0.0
    for c in comps:
        city = c.get("city") or link_city
        addr = c.get("address") or ""
        addr_q = url_quote(f"{addr} {city} {link_state}")
        lat, lng = c.get("latitude"), c.get("longitude")
        dist = float(c.get("distance_score") or 0)
        # Lower distance_score = closer match. Best on this report maps to ~99%.
        if best_score <= 0 and dist <= 0:
            match_pct = 99
        else:
            match_pct = int(max(55, min(99, round(99 * (best_score + 0.08) / (dist + 0.08)))))
        reasons = []
        c_sqft = float(c.get("living_area") or 0)
        if sub_sqft and c_sqft:
            dsf = int(round(c_sqft - sub_sqft))
            if abs(dsf) < 50:
                reasons.append("similar size")
            else:
                reasons.append(f"{'+' if dsf > 0 else ''}{dsf} sqft")
        c_beds = float(c.get("beds") or 0)
        c_baths = float(c.get("baths") or 0)
        if sub_beds and c_beds == sub_beds and abs(c_baths - sub_baths) < 0.3:
            reasons.append("same bed/bath")
        elif sub_beds:
            reasons.append(f"{c_beds:.0f}/{c_baths:.0f} bed/bath")
        c_year = float(c.get("year_built") or 0) if c.get("year_built") not in (None, "") else 0
        if sub_year and c_year:
            dy = int(round(c_year - sub_year))
            if abs(dy) <= 5:
                reasons.append("same era")
            else:
                reasons.append(f"{'+' if dy > 0 else ''}{dy} yrs")
        c_gar = float(c.get("garage_spaces") or 0)
        if sub_gar and abs(c_gar - sub_gar) < 0.5:
            reasons.append("same garage")
        sold_date = (c.get("sold_date") or "")[:10]
        if sold_date:
            try:
                from datetime import date as _date
                age = (_date.today() - _date.fromisoformat(sold_date)).days
                if age <= 45:
                    reasons.append("sold recently")
                elif age <= 120:
                    reasons.append(f"sold {age // 7} wks ago")
                else:
                    reasons.append(f"sold {age // 30} mo ago")
            except Exception:
                pass
        comps_payload.append({
            "address": addr,
            "sold_date": sold_date,
            "sold_price": c.get("sold_price") or 0,
            "living_area": c.get("living_area") or 0,
            "beds": c.get("beds") or 0,
            "baths": c.get("baths") or 0,
            "year_built": c.get("year_built") or "",
            "garage": c.get("garage_spaces") or 0,
            "lot_size": c.get("lot_size") or 0,
            "acres": c.get("acres") or 0,
            "dom": c.get("dom") or 0,
            "ppsf": c.get("price_per_sqft") or 0,
            "mls": c.get("mls_number") or "",
            "subdivision": c.get("subdivision") or "",
            "lat": lat,
            "lng": lng,
            "city": city,
            "zillow": f"https://www.zillow.com/homes/{addr_q}_rb/",
            "realtor": f"https://www.realtor.com/realestateandhomes-search/{addr_q}",
            "photo": c.get("photo_url") or "",
            "photos": c.get("photos") or ([c.get("photo_url")] if c.get("photo_url") else []),
            "auto": True,
            "score": dist,
            "match_pct": match_pct,
            "reasons": reasons[:4],
        })

    # Rank auto comps by similarity (best match first) for the rail order
    comps_payload.sort(key=lambda row: (row.get("score") if row.get("score") is not None else 99))
    subject_snapshot = {
        "address": subject.get("address") or hero_title,
        "living_area": subject.get("living_area") or 0,
        "beds": subject.get("beds") or 0,
        "baths": subject.get("baths") or 0,
        "year_built": subject.get("year_built") or "",
        "garage": subject.get("garage_spaces") or 0,
        "lot_size": subject.get("lot_size") or (subject.get("extra") or {}).get("lot_size") or 0,
        "acres": subject.get("acres") or (subject.get("extra") or {}).get("acres") or 0,
        "dom": subject.get("dom") or 0,
        "rec": rec,
        "photo": subject.get("photo_url") or subject.get("photo") or "",
        "photos": subject.get("photos") or (
            [subject.get("photo_url") or subject.get("photo")]
            if (subject.get("photo_url") or subject.get("photo")) else []
        ),
    }

    def _carousel(photos: list, alt: str, fade_inner: str) -> str:
        urls = [u for u in (photos or []) if u]
        if not urls:
            return (
                f'<div class="comp-visual needs-photo"><div class="comp-photo-empty">{fade_inner}</div></div>'
            )
        slides = "".join(
            f'<img class="comp-photo{" is-on" if i == 0 else ""}" src="{u}" alt="{alt}" '
            f'loading="{"eager" if i == 0 else "lazy"}" data-slide="{i}">'
            for i, u in enumerate(urls)
        )
        nav = ""
        if len(urls) > 1:
            nav = (
                f'<button type="button" class="car-btn car-prev" aria-label="Previous photo">‹</button>'
                f'<button type="button" class="car-btn car-next" aria-label="Next photo">›</button>'
                f'<div class="car-count">1 / {len(urls)}</div>'
            )
        return (
            f'<div class="comp-visual has-photo">'
            f'<div class="comp-carousel" data-slide="0">{slides}{nav}</div>'
            f'<div class="comp-photo-fade">{fade_inner}</div></div>'
        )

    def _comp_card(i: int, c: dict) -> str:
        sold = c.get("sold_price") or 0
        photos = c.get("photos") or ([c.get("photo")] if c.get("photo") else [])
        delta = sold - rec if rec else 0
        if abs(delta) < 500:
            delta_html = '<span class="comp-delta same">Recent sale</span>'
        elif delta > 0:
            delta_html = f'<span class="comp-delta up">Sold higher</span>'
        else:
            delta_html = f'<span class="comp-delta down">Sold lower</span>'
        sqft = c.get("living_area") or 0
        sub_sqft = subject_snapshot.get("living_area") or 0
        sqft_note = ""
        if sqft and sub_sqft:
            dsf = sqft - sub_sqft
            if abs(dsf) >= 50:
                sqft_note = f' · {dsf:+.0f} sf'
        fade = (
            f'<div class="cph-price">${sold:,.0f}</div>'
            f'<div class="cph-meta">Sold {(c.get("sold_date") or "—")}{sqft_note}</div>'
            f'{delta_html}'
        )
        visual = _carousel(photos, f'Listing photo of {(c.get("address") or "comp")[:40]}', fade)
        badge = (
            f'#{i+1} · {c.get("match_pct") or "—"}% match'
            if c.get("auto", True) else "Manual pick"
        )
        why = " · ".join(c.get("reasons") or [])
        why_html = f'<div class="match-why">{why}</div>' if why else ""
        return (
            f'<article class="comp-card" data-comp-idx="{i}" data-mls="{c.get("mls") or ""}">'
            f'{visual}'
            f'<div class="cb">'
            f'<div class="ca">{(c.get("address") or "")[:40]}</div>'
            f'<div class="cm"><span class="match-badge">{badge}</span> · MLS {c.get("mls") or "—"}</div>'
            f'{why_html}'
            f'<div class="cf">'
            f'<div><span>Sq ft</span><br><strong>{c.get("living_area", 0):.0f}</strong></div>'
            f'<div><span>Bd / Ba</span><br><strong>{c.get("beds", 0):.0f} / {c.get("baths", 0):.0f}</strong></div>'
            f'<div><span>Year · Gar</span><br><strong>{c.get("year_built") or "—"} · {c.get("garage", 0):.0f}</strong></div>'
            f'<div><span>DOM · $/SF</span><br><strong>{c.get("dom", 0):.0f}d · ${c.get("ppsf", 0):.0f}</strong></div>'
            f'</div></div></article>'
        )

    sub_photos = subject_snapshot.get("photos") or (
        [subject_snapshot.get("photo")] if subject_snapshot.get("photo") else []
    )
    sub_fade = (
        f'<div class="cph-price">Your home</div>'
        f'<div class="cph-meta">Anchor · compare the sales</div>'
        f'<span class="comp-delta same">Subject</span>'
    )
    if sub_photos:
        subject_card = (
            f'<article class="comp-card subject-card">'
            f'{_carousel(sub_photos, "Your home", sub_fade)}'
            f'<div class="cb"><div class="ca">{(subject_snapshot.get("address") or "Your home")[:40]}</div>'
            f'<div class="cm">Your home</div>'
            f'<div class="cf">'
            f'<div><span>Sq ft</span><br><strong>{subject_snapshot.get("living_area", 0):.0f}</strong></div>'
            f'<div><span>Bd / Ba</span><br><strong>{subject_snapshot.get("beds", 0):.0f} / {subject_snapshot.get("baths", 0):.0f}</strong></div>'
            f'<div><span>Year · Gar</span><br><strong>{subject_snapshot.get("year_built") or "—"} · {subject_snapshot.get("garage", 0):.0f}</strong></div>'
            f'<div><span>Role</span><br><strong>Yours</strong></div>'
            f'</div></div></article>'
        )
    else:
        subject_card = (
            f'<article class="comp-card subject-card">'
            f'<div class="comp-visual needs-photo"><div class="comp-photo-empty">{sub_fade}</div></div>'
            f'<div class="cb"><div class="ca">{(subject_snapshot.get("address") or "Your home")[:40]}</div>'
            f'<div class="cm">Your home</div>'
            f'<div class="cf">'
            f'<div><span>Sq ft</span><br><strong>{subject_snapshot.get("living_area", 0):.0f}</strong></div>'
            f'<div><span>Bd / Ba</span><br><strong>{subject_snapshot.get("beds", 0):.0f} / {subject_snapshot.get("baths", 0):.0f}</strong></div>'
            f'<div><span>Year · Gar</span><br><strong>{subject_snapshot.get("year_built") or "—"} · {subject_snapshot.get("garage", 0):.0f}</strong></div>'
            f'<div><span>Role</span><br><strong>Yours</strong></div>'
            f'</div></div></article>'
        )

    comps_cards = "".join(_comp_card(i, c) for i, c in enumerate(comps_payload))
    comps_print_more = "".join(
        _comp_card(i, c) for i, c in enumerate(comps_payload[4:], start=4)
    ) if len(comps_payload) > 4 else ""
    subject_slot = subject_card
    comps_rows = "".join(
        f"<tr data-comp-idx=\"{i}\">"
        f"<td>{(c.get('address') or '')[:32]}</td>"
        f"<td>{(c.get('sold_date') or '')[:10]}</td>"
        f"<td>${c.get('sold_price', 0):,.0f}</td>"
        f"<td>{c.get('living_area', 0):.0f}</td>"
        f"<td>{c.get('beds', 0):.0f}/{c.get('baths', 0):.0f}</td>"
        f"<td>{c.get('year_built', '')}</td>"
        f"<td>{c.get('garage', 0):.0f}</td>"
        f"<td>{c.get('dom', 0):.0f}</td>"
        f"<td>${c.get('ppsf', 0):.0f}</td></tr>"
        for i, c in enumerate(comps_payload)
    )
    whatif_scenarios = list(scenarios or [])
    whatif_n = max(1, len(whatif_scenarios))

    def _whatif_short_label(label: str) -> str:
        short = {
            "Aggressive": "Aggressive",
            "Competitive Low": "Comp low",
            "Balanced (Recommended)": "Balanced",
            "Competitive High": "Comp high",
            "Premium / Aspirational": "Premium",
        }
        return short.get(label or "", (label or "")[:14])

    whatif_cards = "".join(
        (
            f'<button type="button" class="whatif-card{" active" if "Balanced" in (sc.get("label") or "") else ""}" '
            f'data-price="{int(sc.get("list_price") or 0)}" data-label="{sc.get("label") or ""}" '
            f'title="{sc.get("label") or ""}">'
            f'<div class="wf-label">{_whatif_short_label(sc.get("label") or "")}</div>'
            f'<div class="wf-price">${sc.get("list_price", 0):,.0f}</div>'
            f'<div class="wf-meta">~{sc.get("expected_dom", 0):.0f}d · {(sc.get("odds_30_day") or 0) * 100:.0f}%</div>'
            f'</button>'
        )
        for sc in whatif_scenarios
    )
    sens_rows = "".join(
        f"<tr class=\"{'rec' if 'Balanced' in (sc.get('label') or '') else ''}\">"
        f"<td>{sc.get('label')}</td><td>${sc.get('list_price', 0):,.0f}</td>"
        f"<td>~{sc.get('expected_dom', 0):.0f}d</td><td>{(sc.get('odds_30_day') or 0) * 100:.0f}%</td></tr>"
        for sc in scenarios
    )
    if not all_cols and full_table:
        all_cols = list(full_table[0].keys())
    col_checks = "\n".join(
        f'<label class="col-check"><input type="checkbox" data-col="{c}" '
        f'{"checked" if c in default_cols else ""}> {c}</label>'
        for c in all_cols
    )
    rating_buttons = "".join(
        f'<button type="button" class="rate-btn{" active" if i == home_rating else ""}" data-rating="{i}">{i}</button>'
        for i in range(1, 11)
    )
    obj_list = list(objections or [
        {"title": "Inventory", "body": "Pricing outside the band extends DOM."},
        {"title": "Overpricing", "body": "Buyers compare you to recent closes."},
        {"title": "Condition", "body": "Rate the home honestly vs comps."},
    ])
    while len(obj_list) % 3 and len(obj_list) > 0:
        obj_list.append(None)
    obj_cards = "".join(
        (
            f'<div class="obj-card"><div class="obj-t">{c.get("title", "")}</div>'
            f'<div class="obj-b">{c.get("body", "")}</div></div>'
        ) if c else '<div class="obj-card empty" aria-hidden="true"></div>'
        for c in obj_list
    )
    yoy_summary = yoy.get("summary") or []
    yoy_n = max(1, len(yoy_summary))
    yoy_kpi = "".join(
        f'<div class="kpi"><div class="v">{y.get("year")}</div>'
        f'<div class="l">{y.get("sales", 0)} sales · '
        f'${(y.get("median_price") or 0)/1000:.0f}k med · '
        f'{(y.get("median_dom") or 0):.0f}d DOM</div></div>'
        for y in yoy_summary
    )
    # Keep YoY year tiles even (pad to 2)
    if yoy_summary and len(yoy_summary) % 2:
        yoy_kpi += '<div class="kpi" style="visibility:hidden" aria-hidden="true"><div class="v">—</div><div class="l">—</div></div>'
        yoy_n = len(yoy_summary) + 1

    def _pct_delta(new, old):
        try:
            if old is None or new is None or float(old) == 0:
                return None
            return (float(new) - float(old)) / float(old) * 100.0
        except (TypeError, ValueError, ZeroDivisionError):
            return None

    insight_pace = "Sales volume by year shows whether this segment is heating up or cooling off."
    insight_price = "Median sold price is what buyers actually paid — the facts behind the recommended list."
    insight_timing = f"Homes in this set typically go under contract in about <strong>{median_dom:.0f} days</strong> when priced with the market."
    if len(yoy_summary) >= 2:
        prior, latest = yoy_summary[-2], yoy_summary[-1]
        sales_d = _pct_delta(latest.get("sales"), prior.get("sales"))
        price_d = _pct_delta(latest.get("median_price"), prior.get("median_price"))
        dom_d = _pct_delta(latest.get("median_dom"), prior.get("median_dom"))
        y0, y1 = prior.get("year"), latest.get("year")
        if sales_d is not None:
            direction = "up" if sales_d > 3 else ("down" if sales_d < -3 else "flat")
            if direction == "up":
                insight_pace = (
                    f"<strong>{y1}</strong> is running <strong>{sales_d:+.0f}%</strong> more sales than {y0} "
                    f"({int(latest.get('sales') or 0)} vs {int(prior.get('sales') or 0)}). More closes = more proof of what buyers will pay."
                )
            elif direction == "down":
                insight_pace = (
                    f"<strong>{y1}</strong> sales are <strong>{sales_d:.0f}%</strong> vs {y0} "
                    f"({int(latest.get('sales') or 0)} vs {int(prior.get('sales') or 0)}). A thinner market means pricing accuracy matters more."
                )
            else:
                insight_pace = (
                    f"Sales pace is steady {y0} → {y1} "
                    f"({int(prior.get('sales') or 0)} vs {int(latest.get('sales') or 0)} closes). Consistency favors a clear, market-anchored list."
                )
        if price_d is not None:
            if price_d > 2:
                insight_price = (
                    f"Median sold price moved <strong>{price_d:+.1f}%</strong> from {y0} to {y1} "
                    f"(${(prior.get('median_price') or 0)/1000:.0f}k → ${(latest.get('median_price') or 0)/1000:.0f}k). "
                    f"List with that momentum — not last year’s memory."
                )
            elif price_d < -2:
                insight_price = (
                    f"Median sold price eased <strong>{price_d:.1f}%</strong> from {y0} to {y1} "
                    f"(${(prior.get('median_price') or 0)/1000:.0f}k → ${(latest.get('median_price') or 0)/1000:.0f}k). "
                    f"Buyers are paying today’s number — stretch asks stall."
                )
            else:
                insight_price = (
                    f"Median sold price is holding near "
                    f"<strong>${(latest.get('median_price') or 0)/1000:.0f}k</strong> year over year. "
                    f"Stability is your friend — price into the heart of recent closes."
                )
        if dom_d is not None and latest.get("median_dom") is not None:
            if dom_d > 8:
                insight_timing = (
                    f"Median days on market stretched to <strong>{latest.get('median_dom'):.0f} days</strong> "
                    f"({dom_d:+.0f}% vs {y0}). Overpricing costs weeks — and creates comps that help sell other homes."
                )
            elif dom_d < -8:
                insight_timing = (
                    f"Homes are moving faster — median DOM is <strong>{latest.get('median_dom'):.0f} days</strong> "
                    f"({dom_d:.0f}% vs {y0}). Well-priced listings get attention quickly."
                )
            else:
                insight_timing = (
                    f"Time-to-contract is steady around <strong>{latest.get('median_dom'):.0f} days</strong>. "
                    f"Price with the market and you should land near that pace."
                )
    ym = yoy.get("monthly_sales") or {}
    if (ym.get("this_year") or []) and (ym.get("last_year") or []):
        ty = sum(ym.get("this_year") or [])
        ly = sum(ym.get("last_year") or [])
        if ly and ty:
            md = (ty - ly) / ly * 100
            insight_pace += (
                f" Same months YTD: <strong>{ty}</strong> sales this year vs <strong>{ly}</strong> last year "
                f"({md:+.0f}%)."
            )
    mdef = report.get("market_definition") or story.get("market_definition") or {}
    dns = report.get("did_not_sell") or story.get("did_not_sell") or {}
    chip_list = [c for c in (mdef.get("chips") or []) if c]
    mdef_chips = "".join(f'<span class="md-chip">{c}</span>' for c in chip_list)
    if not mdef_chips:
        mdef_chips = '<span class="md-chip">Matched to your home</span>'
    agent_notes_html = ""
    if mdef.get("agent_notes"):
        agent_notes_html = f'<div class="md-notes"><strong>Agent criteria:</strong> {mdef["agent_notes"]}</div>'
    subject_ctx = f'<div class="md-notes">{mdef["subject_line"]}</div>' if mdef.get("subject_line") else ""
    dns_true = int(dns.get("true_did_not_sell") or 0)
    dns_churn = int(dns.get("likely_relist_churn") or 0)
    dns_exp = int(dns.get("expired_count") or 0)
    dns_wd = int(dns.get("withdrawn_count") or 0)
    cf_bits = []
    if subject.get("living_area"):
        cf_bits.append(f"{subject['living_area']:,.0f} sq ft")
    if subject.get("garage_spaces"):
        cf_bits.append(f"{subject['garage_spaces']:.0f}-car garage")
    if subject.get("beds"):
        cf_bits.append(f"{subject['beds']:.0f} bed")
    cf_subject_desc = " · ".join(cf_bits) if cf_bits else "your home's size and features"
    cf_market_label = mdef.get("label") or area or "this market"
    dns_window = int(dns.get("relist_window_days", 45) or 45)
    dns_tip_true = (
        f'{dns_true} did not sell ({dns_exp} expired · {dns_wd} withdrawn). '
        f'Excludes {dns_churn} that came back within {dns_window} days.'
    )
    dns_tip_churn = (
        f'{dns_churn} left the market and returned within {dns_window} days — '
        f'set aside so they are not counted as true “didn’t sell.”'
    )
    dns_kpi_true = (
        f'<div class="kpi has-tip" tabindex="0">'
        f'<div class="v">{dns_true}</div>'
        f'<div class="l">Didn\'t Sell <span class="tip-i" aria-hidden="true">?</span></div>'
        f'<div class="tip" role="tooltip">{dns_tip_true}</div></div>'
    )
    dns_kpi_churn = (
        f'<div class="kpi has-tip" tabindex="0">'
        f'<div class="v">{dns_churn}</div>'
        f'<div class="l">Back on Market Soon <span class="tip-i" aria-hidden="true">?</span></div>'
        f'<div class="tip" role="tooltip">{dns_tip_churn}</div></div>'
    )

    market_def_html = f'''
    <div class="market-def">
      <div class="md-row">
        <div>
          <div class="md-label">Your competitive market</div>
          <div class="md-title">{mdef.get("label") or area or "Custom market"}</div>
        </div>
        <div class="md-chips">{mdef_chips}</div>
      </div>
      {agent_notes_html}
      {subject_ctx}
    </div>'''

    chart_js_path = Path(__file__).resolve().parent / "saas" / "vendor" / "chart.umd.min.js"
    # Always load Chart.js from /saas/vendor — never inline. Portal reports embed large
    # TABLE JSON; inlining ~200KB of Chart.js on top has broken charts/map boot in browsers.
    if chart_js_path.exists():
        chart_tag = '<script src="/saas/vendor/chart.umd.min.js"></script>'
    else:
        chart_tag = '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>'

    logo_html = (
        f'<img src="{logo_url}" alt="ListLogic" style="height:30px;margin-right:10px;vertical-align:middle;background:#fff;border-radius:6px;padding:3px 8px">'
        if logo_url else ""
    )
    brand_text = "Pricing Story" if logo_html else "ListLogic · Pricing Story"
    meta_html = agent_line
    if agent_contact:
        meta_html += f"<br>{agent_contact}"
    meta_html += f"<br>{generated} · {area}"

    payload = {
        "scatter": scatter_pts,
        "actives": actives,
        "trend": trend_pts,
        "subject": subject_pt,
        "monthlySales": monthly,
        "yearlySales": yearly,
        "monthlyPrice": monthly_price,
        "monthlyPriceBands": monthly_price_bands,
        "monthlyDom": monthly_dom,
        "domDist": {"labels": dom_dist.get("labels") or [], "values": dom_dist.get("values") or []},
        "yoy": yoy,
        "soldPrices": story.get("sold_prices") or [float(p["SoldPrice"]) for p in points if p.get("SoldPrice")],
        "rec": rec,
        "low": low,
        "high": high,
        "dom": exp_dom,
        "homeRating": home_rating,
        "topMkt": top_mkt,
        "marketOdds": (s.get("odds_of_selling") or 0),
        "medianDom": median_dom,
        "inv": inv,
        "soldCount": int(s.get("sold_count") or 0),
        "linkCity": link_city,
        "linkState": link_state,
        "scenarios": [
            {
                "label": sc.get("label"),
                "price": sc.get("list_price"),
                "dom": sc.get("expected_dom"),
                "odds": sc.get("odds_30_day"),
            }
            for sc in scenarios
        ],
        "comps": comps_payload,
        "autoComps": [c.get("mls") for c in comps_payload if c.get("mls")],
        "subjectSnap": subject_snapshot,
        "priceBands": {
            "labels": price_bands.get("labels") or [],
            "values": price_bands.get("values") or [],
            "subjectIndex": price_bands.get("subject_band_index"),
            "insight": band_insight,
        },
        "listingFlow": {
            "newPm": lf_new_pm,
            "salesPm": lf_sales_pm,
            "supplyPressure": lf_pressure,
            "netPm": lf_net,
            "newBelowRecPm": lf_below_pm,
            "activeBelowRec": lf_active_below,
            "freshDuringMedianDom": lf_wait_fresh,
            "medianDomForWait": lf_wait_dom,
            "thresholdPrice": float(lf.get("threshold_price") or rec or 0),
            "subjectSqft": float(lf.get("subject_living_area") or subject.get("living_area") or 0),
            "samples": lf.get("samples") or [],
            "insight": lf_insight,
            "chart": {
                "labels": lf_chart.get("labels") or [],
                "newListings": lf_chart.get("new_listings") or [],
                "sales": lf_chart.get("sales") or [],
            },
        },
        "priceResponse": report.get("price_response") or {},
        "llmEnhanced": llm_on,
    }
    defaults = {
        "rec": rec, "low": low, "high": high, "dom": exp_dom,
        "bl": exec_sum, "adv": adv_text, "risk": risk_text, "obj": obj_text,
        "rating": 5,
        "ledes": {"comps": lede_comps, "condition": lede_condition, "close": lede_close},
    }

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ListLogic · {area}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
{chart_tag}
<link href="https://api.mapbox.com/mapbox-gl-js/v3.9.0/mapbox-gl.css" rel="stylesheet">
<script src="https://api.mapbox.com/mapbox-gl-js/v3.9.0/mapbox-gl.js"></script>
<style>
:root {{
  --navy:{brand_primary}; --blue:{brand_accent}; --bg:#f4f1ea; --card:#fff;
  --text:#0b1220; --muted:#5c6675; --border:#e6e0d4; --rec:#e7f3ef;
  --hot:#fae8e2; --hot-t:#b3541e; --warm:#fdf3e7; --warm-t:#9a5a1e;
  --panel:#0b1220; --brand-primary:{brand_primary}; --brand-accent:{brand_accent};
  --gold:#c9a227; --gold-2:#e0b83a; --teal:#0e7a6d;
}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);font-size:14px;line-height:1.55;-webkit-font-smoothing:antialiased}}
.report-shell{{max-width:1400px;margin:0 auto}}
.report-side{{
  background:#fff;border:1px solid var(--border);border-radius:16px;
  padding:12px 10px 16px;margin:0 0 12px;box-shadow:0 8px 24px -12px rgba(11,18,32,.14);
}}
.rs-brand{{font-size:.68rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);padding:2px 10px 10px}}
.rs-label{{font-size:.62rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:6px 10px 8px}}
.rs-app a,.spine a{{
  display:flex;align-items:center;gap:8px;width:100%;text-align:left;
  font-size:.78rem;font-weight:600;color:var(--text);text-decoration:none;
  padding:8px 10px;border-radius:10px;margin-bottom:2px;
}}
.rs-app a:hover,.spine a:hover{{background:#f4f1ea;color:var(--brand-primary)}}
.spine a.active{{background:var(--brand-primary);color:#fff}}
.rs-sep{{height:1px;background:var(--border);margin:8px 6px 10px}}
.rs-app[hidden],.rs-app a[hidden],.spine a[hidden]{{display:none!important}}
@media(min-width:980px){{
  .report-shell{{display:grid;grid-template-columns:216px minmax(0,1fr);align-items:start;gap:8px;padding:12px 12px 0}}
  .report-side{{
    position:sticky;top:12px;max-height:calc(100vh - 24px);overflow:auto;
    margin:0;
  }}
  .page{{max-width:1160px;margin:0 auto;padding:6px 16px 80px 8px}}
}}
@media(max-width:979px){{
  .report-side{{position:sticky;top:0;z-index:50;margin:10px 12px 0;backdrop-filter:blur(8px);background:rgba(255,255,255,.96)}}
  .rs-app,.spine{{display:flex;flex-wrap:wrap;gap:4px}}
  .rs-app a,.spine a{{width:auto;margin:0;padding:6px 10px;font-size:.72rem}}
  .rs-label,.rs-sep,.rs-brand{{display:none}}
  .page{{max-width:1160px;margin:0 auto;padding:18px 20px 80px}}
}}
.hero{{position:relative;overflow:hidden;background:linear-gradient(150deg,#0b1220 0%,#101a2e 55%,var(--brand-primary) 130%);color:#fff;border-radius:22px;padding:34px 34px 30px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:14px;box-shadow:0 24px 60px -20px rgba(11,18,32,.5)}}
.hero::after{{content:'';position:absolute;inset:0;background:radial-gradient(600px 300px at 85% 0%,rgba(201,162,39,.22),transparent 60%);pointer-events:none}}
.hero .brand{{font-size:.68rem;letter-spacing:.16em;opacity:.75;text-transform:uppercase;font-weight:700;position:relative;z-index:1}}
.hero h1{{font-family:'Fraunces',Georgia,serif;font-size:clamp(1.7rem,3.6vw,2.5rem);font-weight:700;letter-spacing:-.02em;margin-top:8px;position:relative;z-index:1;line-height:1.1}}
.hero-chips{{display:flex;gap:7px;flex-wrap:wrap;margin-top:14px;position:relative;z-index:1}}
.chip{{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);padding:4px 12px;border-radius:999px;font-size:.72rem;font-weight:600;backdrop-filter:blur(4px)}}
.hero .meta{{font-size:.78rem;opacity:.9;text-align:right;position:relative;z-index:1}}
.verdict .big,.market-duo .n,.kpi .v,.co-stat .cv,.price-block .amt{{font-variant-numeric:tabular-nums}}
.step{{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,var(--brand-primary),var(--brand-accent));color:#fff;font-size:.72rem;font-weight:800;flex:none;box-shadow:0 4px 10px -3px rgba(12,60,110,.5)}}
.section h2 .ttl{{flex:1;display:flex;align-items:center;gap:8px}}
@media (prefers-reduced-motion:no-preference){{
  .reveal{{opacity:0;transform:translateY(16px);transition:opacity .55s ease,transform .55s ease}}
  .reveal.in{{opacity:1;transform:none}}
}}
@media print{{.reveal{{opacity:1!important;transform:none!important}}}}
.share-bar{{display:none}}
.top-bar{{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap}}
.view-modes{{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 10px;background:#fff;border:1px solid var(--border);border-radius:10px;flex:1;min-width:220px}}
.view-modes .vm-label{{font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-right:4px}}
.view-modes a,.view-modes span.vm,.view-modes button.vm{{border:1px solid var(--border);background:#f8fafc;padding:6px 12px;border-radius:999px;font-size:.75rem;font-weight:700;color:var(--brand-primary);text-decoration:none;font:inherit;cursor:pointer;line-height:1.2}}
.view-modes span.vm.on{{background:var(--brand-primary);color:#fff;border-color:var(--brand-primary)}}
.view-modes a:hover,.view-modes button.vm:hover{{background:#e8f0fa}}
.view-modes .vm-status{{border:none;background:transparent;padding:0 4px;font-size:.72rem;color:var(--muted);font-weight:600}}
.photo-fetch-banner{{
  display:none;align-items:center;gap:10px;flex-wrap:wrap;
  margin:0 0 12px;padding:10px 14px;border-radius:12px;
  background:linear-gradient(90deg,#eef6ff,#f7fafc);border:1px solid #cfe0f5;
  color:var(--brand-primary);font-size:.86rem;font-weight:600;
}}
.photo-fetch-banner.on{{display:flex}}
.photo-fetch-banner .spin{{
  width:14px;height:14px;border-radius:50%;
  border:2px solid #c5d8ef;border-top-color:var(--brand-primary);
  animation:photoSpin .8s linear infinite;
}}
@keyframes photoSpin{{to{{transform:rotate(360deg)}}}}
.photo-fetch-banner .pf-msg{{flex:1;min-width:160px}}
.photo-fetch-banner .pf-count{{font-size:.75rem;color:var(--muted);font-weight:700}}
.agent-menu-wrap{{position:fixed;top:16px;right:16px;z-index:95;visibility:hidden}}
.agent-menu-wrap.ll-shown{{visibility:visible}}
.agent-chip{{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(12,60,110,.12);background:rgba(255,255,255,.97);backdrop-filter:blur(10px);border-radius:999px;padding:5px 12px 5px 5px;cursor:pointer;box-shadow:0 10px 30px rgba(15,40,70,.16);transition:box-shadow .15s ease,border-color .15s ease,transform .15s ease,opacity .15s ease;font:inherit;color:var(--text)}}
.agent-chip:hover,.agent-chip.menu-open{{border-color:var(--brand-primary);box-shadow:0 12px 34px rgba(12,60,110,.2)}}
.agent-chip:hover{{transform:translateY(-1px)}}
.agent-chip .agent-avatar{{width:32px;height:32px;border-radius:50%;background:linear-gradient(145deg,var(--brand-primary),var(--brand-accent));color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:800;letter-spacing:.02em;flex:none}}
.agent-chip .agent-chip-text{{display:flex;flex-direction:column;align-items:flex-start;line-height:1.1;padding-right:2px}}
.agent-chip .agent-chip-text strong{{font-size:.76rem;color:var(--brand-primary)}}
.agent-chip .agent-chip-text span{{font-size:.6rem;color:var(--muted);font-weight:600}}
.agent-chip .agent-caret{{color:var(--muted);font-size:.8rem;margin-left:2px}}
.agent-menu{{position:absolute;top:calc(100% + 8px);right:0;min-width:252px;background:#fff;border:1px solid var(--border);border-radius:14px;box-shadow:0 18px 40px rgba(15,40,70,.18);padding:8px;display:none;z-index:96}}
.agent-menu.open{{display:block}}
.agent-menu a,.agent-menu button.mi{{display:flex;width:100%;align-items:flex-start;gap:10px;text-align:left;border:0;background:transparent;padding:10px 12px;border-radius:10px;cursor:pointer;font:inherit;color:var(--text);text-decoration:none}}
.agent-menu a:hover,.agent-menu button.mi:hover{{background:#f4f7fb}}
.agent-menu .mi-ico{{width:28px;height:28px;border-radius:8px;background:#eef3f9;color:var(--brand-primary);display:inline-flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:800;flex:none}}
.agent-menu .mi-copy{{display:flex;flex-direction:column;gap:1px;min-width:0}}
.agent-menu .mi-copy strong{{font-size:.82rem;color:var(--brand-primary);font-weight:700}}
.agent-menu .mi-copy span{{font-size:.68rem;color:var(--muted);line-height:1.3}}
.agent-menu .mi-sep{{height:1px;background:var(--border);margin:6px 4px}}
@media(max-width:560px){{
  .agent-menu-wrap{{top:auto;bottom:18px;right:14px}}
  .agent-chip .agent-chip-text,.agent-chip .agent-caret{{display:none}}
  .agent-chip{{padding:5px}}
  .agent-menu{{top:auto;bottom:calc(100% + 8px)}}
}}
.fab{{display:none}}
.panel-overlay{{display:none;position:fixed;inset:0;background:rgba(8,18,32,.48);backdrop-filter:blur(2px);z-index:1001}}
.panel-overlay.open{{display:block}}
body.ll-agent [data-lede],body.ll-agent [data-edit]{{outline:1px dashed transparent;border-radius:4px;cursor:text}}
body.ll-agent [data-lede]:hover,body.ll-agent [data-edit]:hover,body.ll-agent #advList li:hover,body.ll-agent #riskList li:hover{{outline-color:rgba(12,60,110,.28)}}
body.ll-agent [data-lede]:focus,body.ll-agent [data-edit]:focus,body.ll-agent #advList li:focus,body.ll-agent #riskList li:focus{{outline-color:var(--brand-primary)}}
.agent-panel{{position:fixed;top:0;right:0;width:min(400px,100vw);height:100vh;background:#f4f7fb;z-index:1002;box-shadow:-12px 0 40px rgba(8,20,40,.22);transform:translateX(105%);transition:transform .28s cubic-bezier(.22,1,.36,1);display:flex;flex-direction:column}}
.agent-panel.open{{transform:translateX(0)}}
.agent-chip.panel-open{{opacity:.28;pointer-events:none}}
.panel-header{{background:linear-gradient(135deg,#0c2238 0%,#143556 100%);color:#fff;padding:16px 16px 14px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex:none}}
.panel-header .ph-who{{display:flex;align-items:center;gap:10px;min-width:0}}
.panel-header .ph-avatar{{width:36px;height:36px;border-radius:50%;background:rgba(253,230,138,.18);color:#fde68a;display:inline-flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:800;flex:none}}
.panel-header .ph-copy{{min-width:0}}
.panel-header .ph-copy strong{{display:block;font-size:.95rem;letter-spacing:-.01em}}
.panel-header .ph-copy span{{display:block;font-size:.68rem;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
.panel-header #closePanel{{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#fff;width:32px;height:32px;border-radius:10px;cursor:pointer;flex:none;font-size:1.05rem;line-height:1;display:inline-flex;align-items:center;justify-content:center;padding:0}}
.panel-header #closePanel:hover{{background:rgba(255,255,255,.16)}}
.panel-tabs{{display:flex;gap:4px;padding:10px 12px 0;background:#f4f7fb;flex:none;overflow-x:auto;scrollbar-width:none}}
.panel-tabs::-webkit-scrollbar{{display:none}}
.panel-tab{{flex:1;min-width:0;border:none;background:transparent;color:var(--muted);font:inherit;font-size:.72rem;font-weight:700;padding:9px 8px;border-radius:10px 10px 0 0;cursor:pointer;white-space:nowrap}}
.panel-tab:hover{{color:var(--brand-primary);background:rgba(12,60,110,.05)}}
.panel-tab.active{{color:var(--brand-primary);background:#fff;box-shadow:0 -1px 0 #fff}}
.panel-body{{flex:1;overflow-y:auto;padding:0 12px 16px;background:#f4f7fb}}
.panel-pane{{display:none;background:#fff;border:1px solid var(--border);border-radius:0 14px 14px 14px;padding:14px 14px 12px;box-shadow:0 4px 16px rgba(15,40,70,.05)}}
.panel-pane.active{{display:block}}
.panel-pane .pane-lead{{font-size:.78rem;color:var(--muted);line-height:1.4;margin:0 0 12px}}
.panel-pane .field-grid{{display:grid;grid-template-columns:1fr 1fr;gap:8px}}
.panel-pane .field-grid .span2{{grid-column:1 / -1}}
.panel-pane label{{display:block;font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:0 0 4px}}
.panel-pane input,.panel-pane textarea{{width:100%;padding:9px 11px;border:1px solid var(--border);border-radius:10px;font-size:.88rem;margin:0;background:#f8fafc;font:inherit;color:var(--text);transition:border-color .15s,box-shadow .15s,background .15s}}
.panel-pane input:focus,.panel-pane textarea:focus{{outline:none;border-color:var(--brand-primary);background:#fff;box-shadow:0 0 0 3px rgba(12,60,110,.12)}}
.panel-pane textarea{{min-height:84px;resize:vertical;line-height:1.4}}
.panel-pane textarea.tall{{min-height:120px}}
.panel-pane .field{{margin-bottom:10px}}
.panel-pane .field:last-child{{margin-bottom:0}}
.panel-soft{{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}}
.panel-soft .btn-soft{{flex:1;min-width:120px;padding:9px 12px;border-radius:10px;border:1px solid var(--border);background:#f8fafc;color:var(--brand-primary);font:inherit;font-size:.78rem;font-weight:700;cursor:pointer}}
.panel-soft .btn-soft:hover{{background:#eef4fa;border-color:#c5d6ea}}
.panel-soft .btn-soft:disabled{{opacity:.55;cursor:wait}}
.panel-soft .btn-soft.primary{{background:var(--brand-primary);color:#fff;border-color:var(--brand-primary)}}
.panel-soft .btn-soft.primary:hover{{filter:brightness(1.05)}}
.panel-toast{{display:none;margin-top:10px;padding:8px 10px;border-radius:10px;font-size:.75rem;line-height:1.35;background:#ecfdf5;color:#047857;border:1px solid #a7f3d0}}
.panel-toast.show{{display:block}}
.panel-toast.err{{background:#fef2f2;color:#b91c1c;border-color:#fecaca}}
.panel-toast.busy{{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe}}
.panel-pill{{display:inline-flex;align-items:center;gap:6px;font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:3px 8px;border-radius:999px;background:#eef4fa;color:var(--brand-primary);margin-bottom:8px}}
.panel-pill.private{{background:#fff7ed;color:#c2410c}}
.panel-meta{{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-radius:12px;background:#f8fafc;border:1px solid var(--border);font-size:.8rem;color:var(--muted)}}
.panel-meta strong{{color:var(--text)}}
.panel-actions{{padding:12px 12px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--border);display:flex;gap:8px;background:#fff;flex:none}}
.panel-actions button{{flex:1;padding:11px;border-radius:12px;font-weight:700;border:none;cursor:pointer;font:inherit;font-size:.88rem}}
.btn-apply{{background:var(--brand-primary);color:#fff}}
.btn-apply:hover{{filter:brightness(1.05)}}
.btn-reset{{background:#eef2f6;color:var(--text)}}
.btn-reset:hover{{background:#e2e8f0}}
.subject{{background:#e4eef8;border:1px solid #c5d6ea;border-radius:8px;padding:7px 14px;margin-bottom:10px;font-size:.88rem}}
.bottom-line{{background:transparent;border-left:3px solid var(--gold);border-radius:0;padding:6px 0 6px 12px;margin:4px 0 10px;font-size:.78rem;line-height:1.4;color:var(--muted);box-shadow:none}}
.bottom-line strong{{color:var(--ink);font-size:.72rem;letter-spacing:.04em;text-transform:uppercase}}
.verdict{{position:relative;overflow:hidden;background:linear-gradient(150deg,#0b1220 0%,var(--brand-primary) 90%,var(--brand-accent) 130%);color:#fff;border-radius:16px;padding:16px 20px 14px;margin:4px 0 8px;box-shadow:0 16px 40px -16px rgba(11,18,32,.45)}}
.verdict::after{{content:'';position:absolute;inset:0;background:radial-gradient(420px 200px at 88% 0%,rgba(201,162,39,.22),transparent 60%);pointer-events:none}}
.verdict .eyebrow{{font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;opacity:.8;position:relative;z-index:1;margin:0}}
.verdict .big{{font-family:'Fraunces',Georgia,serif;font-size:clamp(1.9rem,4vw,2.6rem);font-weight:700;line-height:1.05;margin-top:2px;letter-spacing:-.02em;position:relative;z-index:1}}
.verdict .sub{{margin-top:4px;font-size:.88rem;opacity:.95;position:relative;z-index:1}}
.verdict .top{{display:none}}
.verdict .pos-bar,.verdict .pos-labels{{display:none}}
#spine-strategy > .sub{{margin-bottom:6px}}
#spine-strategy .price-controls{{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:12px 14px 10px;margin:0 0 10px;box-shadow:0 8px 22px -14px rgba(11,18,32,.18)}}
#spine-strategy .slider-wrap{{margin:0 0 8px}}
#spine-strategy .slider-wrap label{{font-size:.72rem;font-weight:700;color:var(--brand-primary);text-transform:uppercase;letter-spacing:.04em}}
#spine-strategy .whatif-grid{{margin:0}}
#spine-strategy .confront-out{{margin-top:0;padding:12px;height:100%;box-sizing:border-box}}
#spine-strategy .wyw{{margin-top:0;padding:12px 14px;height:100%;box-sizing:border-box}}
#spine-strategy .wyw-grid{{margin:6px 0}}
#spine-strategy .wyw-sub{{font-size:.72rem}}
#spine-strategy .response-grid{{display:grid;grid-template-columns:1fr;gap:10px;margin-top:10px}}
@media (min-width:900px){{
  #spine-strategy .response-grid{{grid-template-columns:1fr 1.15fr;align-items:stretch}}
}}
#spine-strategy .custom-toggle,#spine-strategy .custom-box{{display:none!important}}
.share-toast{{font-size:.72rem;color:var(--teal);font-weight:700;margin-left:6px}}
.pos-bar{{position:relative;height:12px;border-radius:6px;margin-top:14px;background:linear-gradient(90deg,#16a34a 0%,#84cc16 30%,#facc15 55%,#f97316 75%,#dc2626 100%)}}
.pos-marker{{position:absolute;top:-5px;width:4px;height:22px;background:#fff;border-radius:2px;box-shadow:0 0 0 2px rgba(12,60,110,.55);transition:left .5s cubic-bezier(.22,1,.36,1)}}
.pos-labels{{display:flex;justify-content:space-between;font-size:.62rem;letter-spacing:.05em;text-transform:uppercase;opacity:.75;margin-top:5px}}
.market-duo{{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:4px 0 14px}}
.market-duo .duo{{background:#fff;border:1px solid var(--border);border-radius:14px;padding:22px 18px;text-align:center;box-shadow:0 4px 14px rgba(15,40,70,.06)}}
.market-duo .duo.yours{{background:linear-gradient(145deg,var(--brand-primary),var(--brand-accent));color:#fff;border:none;box-shadow:0 8px 22px rgba(12,60,110,.28)}}
.market-duo .n{{font-family:'Fraunces',Georgia,serif;font-size:clamp(2.4rem,5vw,3.2rem);font-weight:700;line-height:1;letter-spacing:-.02em}}
.market-duo .t{{margin-top:8px;font-size:.78rem;text-transform:uppercase;letter-spacing:.05em;opacity:.88;font-weight:700}}
.ask-trio{{display:grid;grid-template-columns:1fr;gap:8px;margin:0 0 12px}}
@media(min-width:720px){{.ask-trio{{grid-template-columns:repeat(3,1fr)}}}}
.supply-section .sub{{margin-bottom:12px}}
.supply-hero{{display:grid;grid-template-columns:1fr;gap:12px;margin:0 0 14px}}
@media(min-width:860px){{.supply-hero{{grid-template-columns:1.15fr .85fr}}}}
.supply-balance{{background:linear-gradient(165deg,#0c2238 0%,#143556 55%,#0f2d4a 100%);color:#fff;border-radius:16px;padding:18px 18px 16px;box-shadow:0 12px 28px rgba(8,30,55,.28)}}
.supply-balance .sb-title{{font-size:.72rem;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:rgba(253,230,138,.9);margin:0 0 10px}}
.supply-balance .sb-pair{{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}}
.supply-balance .sb-n{{font-size:clamp(1.8rem,4vw,2.4rem);font-weight:800;letter-spacing:-.03em;line-height:1}}
.supply-balance .sb-l{{font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;opacity:.78;font-weight:700;margin-top:4px}}
.supply-balance .sb-bar{{display:flex;height:12px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.12)}}
.supply-balance .sb-bar .new{{background:#38bdf8;height:100%}}
.supply-balance .sb-bar .sold{{background:#fde68a;height:100%}}
.supply-balance .sb-legend{{display:flex;justify-content:space-between;gap:8px;margin-top:8px;font-size:.72rem;opacity:.88}}
.supply-pressure{{border:1px solid var(--border);border-radius:16px;padding:16px 16px 14px;background:#fff}}
.supply-pressure .sp-tone{{display:inline-block;font-size:.65rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:4px 8px;border-radius:999px;margin-bottom:8px}}
.supply-pressure .sp-tone.building{{background:#fef2f2;color:#b91c1c}}
.supply-pressure .sp-tone.balanced{{background:#fff7ed;color:#c2410c}}
.supply-pressure .sp-tone.draining{{background:#ecfdf5;color:#047857}}
.supply-pressure .sp-h{{font-size:1.15rem;font-weight:800;color:var(--navy);margin:0 0 6px;letter-spacing:-.02em}}
.supply-pressure .sp-b{{font-size:.84rem;line-height:1.45;color:var(--muted);margin:0}}
.supply-pressure .sp-metric{{margin-top:12px;display:flex;flex-wrap:wrap;gap:8px}}
.supply-pressure .sp-m{{background:#f8fafc;border:1px solid var(--border);border-radius:10px;padding:8px 10px;min-width:5rem}}
.supply-pressure .sp-m .mv{{font-size:1.2rem;font-weight:800;color:var(--navy);line-height:1}}
.supply-pressure .sp-m .ml{{font-size:.58rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;margin-top:3px}}
.supply-wait{{display:grid;grid-template-columns:1fr;gap:10px;margin:0 0 14px}}
@media(min-width:720px){{.supply-wait{{grid-template-columns:repeat(3,1fr)}}}}
.supply-wait .sw{{border:1px solid var(--border);border-radius:14px;padding:14px 14px 12px;background:#fff}}
.supply-wait .sw.accent{{background:linear-gradient(180deg,#fff7ed,#fff);border-color:#fed7aa}}
.supply-wait .sw-t{{font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--brand-primary);margin-bottom:6px}}
.supply-wait .sw-v{{font-size:1.55rem;font-weight:800;color:var(--navy);letter-spacing:-.02em;line-height:1}}
.supply-wait .sw-d{{font-size:.8rem;line-height:1.4;color:var(--muted);margin-top:6px}}
.supply-wait .sw-d strong{{color:var(--text)}}
.supply-line{{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 16px;margin:0 0 12px;padding:12px 14px;border-radius:14px;border:1px solid #c5d8ec;background:linear-gradient(180deg,#f0f7ff,#fff)}}
.supply-line .sl-k{{font-size:.65rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--brand-primary);margin-bottom:2px}}
.supply-line .sl-v{{font-size:1.35rem;font-weight:800;color:var(--navy);letter-spacing:-.02em}}
.supply-line .sl-d{{flex:1;min-width:200px;font-size:.8rem;line-height:1.4;color:var(--muted)}}
.supply-line .sl-d strong{{color:var(--text)}}
.supply-chart-wrap{{margin:0 0 8px}}
.supply-chart-wrap .chart-box{{height:240px}}
.supply-insight{{font-size:.86rem;color:var(--muted);margin:8px 0 0;line-height:1.45}}
.supply-insight strong{{color:var(--text)}}
.ask-card{{background:#fff;border:1px solid var(--border);border-radius:12px;padding:12px 14px}}
.ask-card .aq{{font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--brand-primary);margin-bottom:6px}}
.ask-card .aa{{font-size:.88rem;line-height:1.4;color:var(--text)}}
.ask-card .aa b{{color:var(--brand-primary)}}
.band-wrap{{margin:4px 0 12px}}
.band-wrap h3{{font-size:.85rem;margin:0 0 4px;color:var(--brand-primary)}}
.band-wrap .band-insight{{font-size:.8rem;color:var(--muted);margin:6px 0 0;line-height:1.35}}
.kpis{{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:10px}}
.kpis.market-kpis{{grid-template-columns:repeat(2,1fr)}}
@media(min-width:640px){{
  .kpis.market-kpis{{grid-template-columns:repeat(5,1fr)}}
}}
.kpi{{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px 8px;text-align:center;min-height:72px;display:flex;flex-direction:column;justify-content:center;position:relative}}
.kpi .v{{font-family:'Fraunces',Georgia,serif;font-size:1.3rem;font-weight:700;color:var(--brand-primary);line-height:1.1}}
.kpi .l{{font-size:.62rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-top:4px;line-height:1.25}}
.kpi.has-tip{{cursor:help}}
.kpi .tip-i{{display:inline-flex;align-items:center;justify-content:center;width:12px;height:12px;border-radius:50%;background:#dbe7f3;color:var(--brand-primary);font-size:.55rem;font-weight:800;margin-left:3px;vertical-align:1px}}
.kpi .tip{{display:none;position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%);width:min(260px,70vw);padding:10px 12px;background:#0f2740;color:#fff;border-radius:10px;font-size:.72rem;font-weight:500;line-height:1.4;text-align:left;text-transform:none;letter-spacing:0;z-index:20;box-shadow:0 10px 24px rgba(8,30,55,.35)}}
.kpi .tip::after{{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);border:6px solid transparent;border-top-color:#0f2740}}
.kpi.has-tip:hover .tip,.kpi.has-tip:focus .tip,.kpi.has-tip:focus-within .tip{{display:block}}
.dns-note{{display:none}}
.data-search-bar{{display:flex;flex-wrap:wrap;gap:8px;align-items:stretch;margin-bottom:10px}}
.data-search-bar .search-wrap{{flex:1 1 240px;position:relative;min-width:200px}}
.data-search-bar .search-wrap input{{width:100%;padding:10px 72px 10px 12px;border:1px solid var(--border);border-radius:10px;font-size:.9rem}}
.data-search-bar .search-clear{{position:absolute;right:8px;top:50%;transform:translateY(-50%);border:none;background:#e2e8f0;color:var(--brand-primary);border-radius:6px;padding:4px 8px;font-size:.68rem;font-weight:700;cursor:pointer}}
.data-search-bar select,.data-search-bar .price-filter{{padding:10px 10px;border:1px solid var(--border);border-radius:10px;font-size:.82rem;background:#fff;min-width:110px}}
.data-search-bar .price-filter{{width:110px}}
.data-search-bar .tb-btn{{padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:#fff;font-size:.78rem;font-weight:700;cursor:pointer;color:var(--brand-primary)}}
.data-hint{{font-size:.75rem;color:var(--muted);margin:0 0 8px}}
.data-hint strong{{color:var(--brand-primary)}}
.comp-find{{display:flex;gap:8px;flex:1 1 220px;min-width:200px}}
.comp-find input{{flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:.82rem}}
.comp-find button{{border:1px solid var(--border);background:#fff;border-radius:8px;padding:5px 10px;font-size:.72rem;font-weight:700;cursor:pointer;color:var(--brand-primary);white-space:nowrap}}
.temp{{display:inline-block;padding:3px 10px;border-radius:12px;font-size:.7rem;font-weight:600}}
.temp.hot{{background:var(--hot);color:var(--hot-t)}}
.temp.warm{{background:var(--warm);color:var(--warm-t)}}
.section{{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:20px 22px;margin-bottom:14px;box-shadow:0 10px 30px -14px rgba(11,18,32,.14);transition:box-shadow .2s ease}}
.section:hover{{box-shadow:0 16px 40px -16px rgba(11,18,32,.2)}}
.section h2{{font-family:'Fraunces',Georgia,serif;font-size:1.15rem;color:var(--text);letter-spacing:-.01em;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px}}
.section .sub{{font-size:.78rem;color:var(--muted);margin-bottom:8px}}
.story-note{{background:#f0f7ff;border:1px solid #c5d8ec;border-radius:8px;padding:10px 12px;margin:8px 0;font-size:.85rem;line-height:1.45}}
.market-def{{background:#f8fafc;border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:10px}}
.market-def .md-row{{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;justify-content:space-between}}
.market-def .md-label{{font-size:.62rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:700}}
.market-def .md-title{{font-size:.95rem;font-weight:800;color:var(--brand-primary);margin-top:1px;line-height:1.2}}
.market-def .md-notes{{font-size:.75rem;margin-top:6px;line-height:1.35;color:var(--muted)}}
.market-def .md-chips{{display:flex;flex-wrap:wrap;gap:5px;justify-content:flex-end;max-width:100%}}
@media(min-width:640px){{.market-def .md-chips{{justify-content:flex-end}}}}
@media(min-width:900px){{.market-def .md-chips{{justify-content:flex-end}}}}
.market-def .md-chip{{display:inline-flex;align-items:center;background:#fff;border:1px solid var(--border);color:var(--brand-primary);border-radius:999px;padding:3px 9px;font-size:.68rem;font-weight:700;line-height:1.2;white-space:nowrap}}
.market-def .md-chip.empty,.market-def .md-d.empty{{display:none}}
.market-def .md-details{{display:none}}
.market-def .md-d{{display:none}}
.market-def .md-d .l{{display:none}}
.market-def .md-d .v{{display:none}}
.kpis.yoy-kpis{{grid-template-columns:repeat(2,1fr)}}
@media(min-width:640px){{.kpis.yoy-kpis{{grid-template-columns:repeat(var(--yoy-cols,2),1fr)}}}}
.rate-live{{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:10px}}
.rate-live .rl{{background:linear-gradient(145deg,var(--brand-primary),var(--brand-accent));color:#fff;border-radius:10px;padding:14px;text-align:center;min-height:88px;display:flex;flex-direction:column;justify-content:center}}
.rate-live .rl .amt{{font-family:'Fraunces',Georgia,serif;font-size:clamp(1.3rem,2.6vw,1.8rem);font-weight:700;letter-spacing:-.02em}}
.rate-live .rl .lbl,.rate-live .rs .lbl{{font-size:.62rem;text-transform:uppercase;letter-spacing:.05em;opacity:.85}}
.rate-live .rs{{background:#f8fafc;border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;min-height:88px;display:flex;flex-direction:column;justify-content:center}}
.rate-live .rs .amt{{font-size:1.15rem;font-weight:800;color:var(--brand-primary);margin-top:2px}}
.whatif-grid{{display:grid;grid-template-columns:repeat(var(--whatif-cols, 5), minmax(0, 1fr));gap:6px;margin:10px 0}}
.whatif-card{{border:1px solid var(--border);border-radius:10px;padding:8px 4px;background:#fff;cursor:pointer;text-align:center;transition:transform .15s,box-shadow .15s,border-color .15s;font:inherit;color:inherit;min-height:68px;display:flex;flex-direction:column;justify-content:center;min-width:0}}
.whatif-card:hover{{transform:translateY(-2px);box-shadow:0 6px 16px rgba(12,60,110,.12)}}
.whatif-card.active{{border-color:var(--brand-primary);background:linear-gradient(180deg,#f0f7ff,#fff);box-shadow:0 0 0 2px rgba(12,60,110,.2)}}
.whatif-card .wf-label{{font-size:.58rem;font-weight:800;text-transform:uppercase;letter-spacing:.03em;color:var(--muted);line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
.whatif-card.active .wf-label{{color:var(--brand-primary)}}
.whatif-card .wf-price{{font-size:1.05rem;font-weight:800;margin:2px 0;color:var(--brand-primary);line-height:1.1;white-space:nowrap}}
.whatif-card .wf-meta{{font-size:.6rem;color:var(--muted);white-space:nowrap;line-height:1.2}}
.net-grid{{display:grid;grid-template-columns:1.15fr .85fr;gap:16px;margin-top:14px;align-items:stretch}}
@media(max-width:900px){{.net-grid{{grid-template-columns:1fr}}}}
.net-lines{{background:#fff;border:1px solid var(--border);border-radius:14px;overflow:hidden}}
.net-row{{display:grid;grid-template-columns:1fr 118px 108px;gap:10px;align-items:center;padding:9px 14px;border-bottom:1px solid var(--border);font-size:.86rem}}
.net-row:last-child{{border-bottom:none}}
.net-row .nl{{font-weight:600;color:var(--ink);line-height:1.25}}
.net-row .nl small{{display:block;font-weight:400;color:var(--muted);font-size:.68rem;margin-top:1px}}
.net-row .ni{{position:relative}}
.net-row .ni input{{width:100%;padding:6px 20px 6px 8px;border:1px solid var(--border);border-radius:8px;font:inherit;font-size:.84rem;text-align:right;background:#fff}}
.net-row .ni input:focus{{outline:2px solid rgba(12,60,110,.25);border-color:var(--brand-primary)}}
.net-row .nu{{position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:.72rem;color:var(--muted);pointer-events:none}}
.net-row .nv{{text-align:right;font-weight:700;color:var(--brand-primary);font-variant-numeric:tabular-nums;white-space:nowrap}}
.net-row.net-total{{background:#f4f1ea}}
.net-row.net-total .nl,.net-row.net-total .nv{{font-weight:800;color:var(--ink)}}
.net-row.net-subtotal{{background:#faf9f6}}
.net-row.net-subtotal .nl,.net-row.net-subtotal .nv{{font-weight:700;color:var(--ink)}}
.net-subhead{{padding:10px 14px 6px;font-size:.66rem;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--brand-primary);background:#f8f6f1;border-bottom:1px solid var(--border)}}
.net-subhead span{{color:var(--muted);font-weight:600;letter-spacing:.02em;text-transform:none}}
.net-row .ni input[type="date"]{{padding-right:4px;font-size:.8rem}}
.net-row .nv-days{{font-weight:600;color:var(--muted);font-size:.74rem}}
.net-summary{{background:linear-gradient(150deg,var(--brand-primary),var(--brand-accent));color:#fff;border-radius:14px;padding:22px 20px;display:flex;flex-direction:column;justify-content:center;gap:7px;text-align:center}}
.net-summary .ns-eyebrow{{font-size:.66rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.85}}
.net-summary .ns-big{{font-family:'Fraunces',serif;font-size:2.5rem;font-weight:700;line-height:1.05;font-variant-numeric:tabular-nums;white-space:nowrap}}
.net-summary .ns-sub{{font-size:.86rem;opacity:.92}}
.net-summary .ns-bar{{height:8px;border-radius:99px;background:rgba(255,255,255,.25);overflow:hidden;margin:4px 0}}
.net-summary .ns-fill{{height:100%;background:#e9c46a;border-radius:99px;transition:width .3s ease}}
.net-summary .ns-note{{font-size:.8rem;font-weight:600}}
.net-summary .ns-deductions{{font-size:.78rem;opacity:.9;line-height:1.45;margin-top:2px}}
.net-summary .ns-fine{{font-size:.68rem;opacity:.75;line-height:1.45;margin-top:4px}}
.price-row{{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0}}
.price-block{{background:#f8fafc;border:1px solid var(--border);border-radius:10px;padding:14px 11px;text-align:center;min-height:84px;display:flex;flex-direction:column;justify-content:center}}
.price-block.main{{background:var(--brand-primary);color:#fff;border-color:var(--brand-primary)}}
.price-block .lbl{{font-size:.6rem;text-transform:uppercase;letter-spacing:.05em;opacity:.85}}
.price-block .amt{{font-family:'Fraunces',Georgia,serif;font-size:1.3rem;font-weight:700;margin-top:4px}}
.co-stats{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:10px}}
.co-stat{{border-radius:10px;padding:10px 6px;text-align:center;border:1px solid var(--border);background:#fff;transition:transform .2s ease;min-height:72px;display:flex;flex-direction:column;justify-content:center;min-width:0}}
.obj-grid{{display:grid;grid-template-columns:repeat(1,1fr);gap:10px}}
@media(min-width:700px){{.obj-grid{{grid-template-columns:repeat(3,1fr)}}}}
.obj-card{{background:#f8fafc;border:1px solid var(--border);border-radius:10px;padding:14px;min-height:110px}}
.obj-card.empty{{visibility:hidden;pointer-events:none;border:none;background:transparent}}
.rate-bands{{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:10px 0 4px}}
@media(min-width:700px){{.rate-bands{{grid-template-columns:repeat(4,1fr)}}}}
.rate-band{{border:1px solid var(--border);border-radius:10px;padding:12px;background:#f8fafc;cursor:pointer;text-align:left;transition:border-color .15s,box-shadow .15s;min-height:120px}}
.rate-band:hover,.rate-band.active{{border-color:var(--brand-primary);box-shadow:0 4px 14px rgba(12,60,110,.12)}}
.rate-band .rb-t{{font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--brand-primary)}}
.rate-band .rb-r{{font-size:.72rem;color:var(--muted);margin-top:2px}}
.rate-band .rb-d{{font-size:.78rem;margin-top:6px;line-height:1.35}}
.dns-note{{background:#fff8f0;border:1px solid #f0d9b8;border-radius:10px;padding:10px 12px;margin-top:10px;font-size:.84rem;line-height:1.45}}
.rate-row{{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0}}
.rate-btn{{width:44px;height:44px;border-radius:10px;border:1px solid var(--border);background:#f8fafc;font-weight:700;font-size:1rem;cursor:pointer;color:var(--brand-primary);transition:transform .15s ease,box-shadow .15s ease,background .15s ease}}
.rate-btn:hover{{transform:translateY(-2px);box-shadow:0 4px 10px rgba(12,60,110,.15)}}
.rate-btn.active{{background:linear-gradient(145deg,var(--brand-primary),var(--brand-accent));color:#fff;transform:scale(1.08);box-shadow:0 6px 14px rgba(12,60,110,.3)}}
.slider-wrap{{margin:12px 0 4px}}
.slider-track-wrap{{position:relative;padding:18px 0 2px}}
.slider-wrap input[type=range]{{width:100%;accent-color:var(--brand-primary);position:relative;z-index:2;margin:0}}
.rec-tick{{position:absolute;top:0;bottom:8px;width:0;transform:translateX(-50%);z-index:1;pointer-events:none;display:flex;flex-direction:column;align-items:center}}
.rec-tick-label{{font-size:.58rem;font-weight:800;letter-spacing:.02em;text-transform:uppercase;color:var(--brand-primary);background:#fff;border:1px solid rgba(12,60,110,.25);border-radius:999px;padding:1px 7px;white-space:nowrap;line-height:1.3;box-shadow:0 1px 3px rgba(12,60,110,.08)}}
.rec-tick-line{{flex:1;width:2px;margin-top:3px;background:var(--brand-primary);opacity:.55;border-radius:1px;min-height:14px}}
.slider-scale{{display:flex;justify-content:space-between;font-size:.65rem;color:var(--muted);margin-top:2px}}
.slider-scale #slideMid{{color:var(--brand-primary);font-weight:700}}
/* While You Wait — queue cost of overpricing */
.wyw{{margin-top:14px;border:1px solid #f0d9b8;border-radius:14px;background:linear-gradient(180deg,#fffaf2,#fff6e8);padding:16px 18px;box-shadow:0 8px 22px -12px rgba(179,84,30,.25)}}
.wyw-head{{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:4px}}
.wyw-title{{font-family:'Fraunces',Georgia,serif;font-size:1.05rem;font-weight:700;color:#8a4a12;letter-spacing:-.01em}}
.wyw-sub{{font-size:.78rem;color:#9a6a3a}}
.wyw-lede{{font-size:.78rem;color:#7c5426;line-height:1.45;margin:0 0 4px}}
.wyw-grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}}
.wyw-cell{{background:#fff;border:1px solid #f0e2c8;border-radius:10px;padding:12px 8px;text-align:center;min-height:78px;display:flex;flex-direction:column;justify-content:center;cursor:help}}
.wyw-cell.hot{{background:linear-gradient(160deg,#b3541e,#8a3c10);color:#fff;border-color:transparent}}
.wyw-cell .wv{{font-size:1.3rem;font-weight:800;color:#8a4a12;line-height:1.1}}
.wyw-cell.hot .wv{{color:#fff}}
.wyw-cell .wl{{font-size:.6rem;text-transform:uppercase;letter-spacing:.05em;color:#9a6a3a;font-weight:700;margin-top:4px}}
.wyw-cell.hot .wl{{color:rgba(255,255,255,.85)}}
.wyw-tip{{display:inline-block;margin-left:3px;width:14px;height:14px;line-height:14px;border-radius:50%;border:1px solid #d4b896;color:#9a6a3a;font-size:.58rem;font-weight:800;vertical-align:middle;cursor:help}}
.wyw-cell.hot .wyw-tip{{border-color:rgba(255,255,255,.45);color:rgba(255,255,255,.9)}}
.wyw-bar-wrap{{margin:6px 0 2px}}
.wyw-bar-label{{display:flex;justify-content:space-between;font-size:.68rem;font-weight:700;color:#8a4a12;margin-bottom:4px}}
.wyw-bar{{position:relative;height:14px;border-radius:7px;background:#f3e6cf;overflow:hidden}}
.wyw-bar .fill{{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#e0a458,#b3541e);border-radius:7px;transition:width .3s ease}}
.wyw-bar .marker{{position:absolute;top:-3px;bottom:-3px;width:3px;background:#0c3c6e;border-radius:2px;box-shadow:0 0 0 1px #fff}}
.wyw-note{{font-size:.78rem;color:#7c5426;line-height:1.5;margin-top:8px}}
.wyw-note b{{color:#8a4a12}}
.match-pill{{display:inline-block;padding:2px 8px;border-radius:10px;font-size:.65rem;font-weight:700;background:#e8f0fa;color:var(--brand-primary)}}
.comp-open{{border:1px solid var(--border);background:#fff;color:var(--brand-primary);padding:4px 10px;border-radius:8px;font-size:.72rem;font-weight:700;cursor:pointer}}
.comp-open:hover{{background:var(--brand-primary);color:#fff}}
.listing-drawer{{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(.96);width:min(1120px,96vw);height:min(90vh,860px);max-height:90vh;background:#fff;z-index:1100;box-shadow:0 28px 70px rgba(0,0,0,.32);border-radius:18px;opacity:0;pointer-events:none;transition:opacity .2s ease,transform .2s ease;display:flex;flex-direction:column;overflow:hidden}}
.listing-drawer.open{{opacity:1;pointer-events:auto;transform:translate(-50%,-50%) scale(1)}}
.listing-drawer .ld-head{{background:var(--panel);color:#fff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex:none}}
.listing-drawer .ld-head strong{{font-size:.98rem;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}
.listing-drawer .ld-head-actions{{display:flex;gap:8px;align-items:center;flex:none;flex-wrap:wrap;justify-content:flex-end}}
.listing-drawer .ld-head a,.listing-drawer .ld-head button{{background:transparent;border:1px solid rgba(255,255,255,.35);color:#fff;padding:6px 12px;border-radius:8px;cursor:pointer;font-weight:600;font-size:.78rem;text-decoration:none;display:inline-flex;align-items:center}}
.listing-drawer .ld-head a:hover,.listing-drawer .ld-head button:hover{{background:rgba(255,255,255,.12)}}
.listing-drawer .ld-body{{padding:0;overflow:hidden;flex:1;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(320px,.95fr);background:#fff;min-height:0}}
@media(max-width:820px){{
  .listing-drawer{{height:min(96vh,920px);max-height:96vh}}
  .listing-drawer .ld-body{{grid-template-columns:1fr;overflow:auto}}
}}
.ld-gallery{{display:flex;flex-direction:column;min-height:0;background:#0b1220;border-right:1px solid rgba(255,255,255,.08);overflow:hidden}}
@media(max-width:820px){{.ld-gallery{{border-right:none;border-bottom:1px solid var(--border);min-height:260px;max-height:42vh}}}}
.ld-hero{{position:relative;flex:1;min-height:180px;background:#0b1220}}
.ld-hero .comp-carousel{{position:absolute;inset:0}}
.ld-hero .comp-photo{{object-fit:contain;background:#0b1220}}
.ld-hero .car-btn{{width:40px;height:40px;font-size:1.4rem;background:rgba(8,20,36,.7)}}
.ld-hero .car-dots{{bottom:12px}}
.ld-hero .car-count{{top:12px;right:12px;font-size:.72rem;padding:4px 9px}}
.ld-hero-empty{{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.7);padding:24px;text-align:center;font-size:.9rem}}
.ld-thumbs{{display:flex;gap:6px;overflow-x:auto;padding:10px 12px;background:#0b1220;border-top:1px solid rgba(255,255,255,.08);flex:none;scrollbar-width:thin}}
.ld-thumbs button{{flex:0 0 58px;height:44px;padding:0;border:2px solid transparent;border-radius:6px;overflow:hidden;cursor:pointer;background:#1a2332;opacity:.65}}
.ld-thumbs button.on{{border-color:#fde68a;opacity:1}}
.ld-thumbs img{{width:100%;height:100%;object-fit:cover;display:block}}
.ld-compare-pane{{padding:14px 16px 16px;overflow-x:hidden;overflow-y:auto;min-height:0;min-width:0;background:#fff;display:flex;flex-direction:column}}
.ld-addr{{font-size:clamp(1rem,1.8vw,1.25rem);font-weight:800;color:var(--brand-primary);margin:0 0 4px;letter-spacing:-.02em;line-height:1.2}}
.ld-meta{{font-size:.78rem;color:var(--muted);margin:0 0 10px}}
.ld-sold-line{{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:0 0 12px;padding-bottom:10px;border-bottom:1px solid var(--border);flex:none}}
.ld-sold-line .ld-sold{{font-size:clamp(1.35rem,2.4vw,1.75rem);font-weight:800;color:var(--brand-primary);letter-spacing:-.03em;line-height:1}}
.ld-sold-line .ld-sold-note{{font-size:.72rem;color:var(--muted);font-weight:600}}
.ld-vs{{margin:0 0 6px;font-size:.66rem;text-transform:uppercase;letter-spacing:.08em;font-weight:800;color:var(--muted);flex:none}}
.ld-vs-table{{width:100%;border-collapse:collapse;font-size:.82rem;table-layout:fixed}}
.ld-vs-table col.c-metric{{width:26%}}
.ld-vs-table col.c-you{{width:37%}}
.ld-vs-table col.c-sale{{width:37%}}
.ld-vs-table th{{font-size:.6rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;text-align:left;padding:0 6px 6px;border-bottom:1px solid var(--border)}}
.ld-vs-table th:nth-child(2),.ld-vs-table th:nth-child(3),.ld-vs-table td:nth-child(2),.ld-vs-table td:nth-child(3){{text-align:right}}
.ld-vs-table th.you{{color:var(--brand-primary)}}
.ld-vs-table td{{padding:7px 6px;border-bottom:1px solid #eef2f6;vertical-align:top;word-break:break-word}}
.ld-vs-table tr:last-child td{{border-bottom:none}}
.ld-vs-table .metric{{color:var(--muted);font-weight:600;font-size:.74rem}}
.ld-vs-table .val{{font-weight:800;color:var(--text);line-height:1.25}}
.ld-vs-table .val.you{{color:var(--brand-primary)}}
.ld-delta{{display:block;margin-top:2px;margin-left:0;font-size:.65rem;font-weight:700}}
.ld-delta.up{{color:#0d7a4f}}
.ld-delta.down{{color:#b91c1c}}
.ld-delta.same{{color:var(--muted)}}
.ld-takeaway{{margin-top:10px;padding:10px 12px;border-radius:10px;background:#f8fafc;border:1px solid var(--border);font-size:.78rem;line-height:1.4;color:var(--text);flex:none}}
.ld-takeaway strong{{color:var(--brand-primary)}}
.listing-overlay{{display:none;position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:1099}}
.listing-overlay.open{{display:block}}
.comp-subject{{margin:0 0 12px}}
.comp-subject .comp-card.subject-card{{display:grid;grid-template-columns:minmax(180px,280px) 1fr;cursor:default;outline:2px solid var(--brand-primary);outline-offset:-1px}}
.comp-subject .comp-card.subject-card:hover{{transform:none;box-shadow:0 4px 14px rgba(15,40,70,.07)}}
.comp-subject .comp-visual{{height:100%;min-height:140px}}
.comp-subject .comp-card .cb{{display:flex;flex-direction:column;justify-content:center;padding:14px 16px}}
.comp-subject .comp-card .ca{{min-height:0;font-size:1.05rem}}
.comp-subject .comp-card .cf{{grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}}
@media(max-width:700px){{
  .comp-subject .comp-card.subject-card{{grid-template-columns:1fr}}
  .comp-subject .comp-visual{{min-height:180px;height:180px}}
  .comp-subject .comp-card .cf{{grid-template-columns:1fr 1fr}}
}}
.comp-rail{{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:4px 0 10px;overflow:visible}}
.comp-map-wrap{{margin:8px 0 14px;background:#fff;border:1px solid var(--border);border-radius:14px;overflow:hidden;box-shadow:0 4px 14px rgba(15,40,70,.06)}}
.comp-map-head{{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid var(--border)}}
.comp-map-head strong{{font-size:.82rem;color:var(--brand-primary)}}
.comp-map-legend{{display:flex;gap:8px;flex-wrap:wrap;font-size:.68rem;color:var(--muted);font-weight:600;align-items:center}}
.comp-map-legend span{{display:inline-flex;align-items:center;gap:5px}}
.comp-map-legend i{{width:10px;height:10px;border-radius:50%;display:inline-block}}
.comp-map-legend i.you{{background:var(--brand-primary);border:2px solid #fde68a;box-sizing:border-box}}
.comp-map-legend i.comp{{background:#0e7a6d}}
.comp-map-legend i.sold{{background:#94a3b8}}
.comp-map-legend i.active{{background:#c9a227}}
.comp-map-legend i.uc{{background:#e65100}}
.comp-map-legend i.off{{background:#a8a29e}}
.comp-map-legend .map-kind{{
  display:inline-flex;align-items:center;gap:5px;font:inherit;font-weight:700;color:var(--ink,#16324f);
  background:#f4f1ea;border:1px solid var(--border);border-radius:999px;padding:3px 10px;cursor:pointer;
  transition:opacity .15s ease, background .15s ease;
}}
.comp-map-legend .map-kind b{{font-weight:800;color:var(--muted)}}
.comp-map-legend .map-kind:hover{{background:#eae4d6}}
.comp-map-legend .map-kind:not(.on){{opacity:.42}}
.comp-map-legend .map-kind:not(.on) i{{background:transparent;border:2px solid currentColor;box-sizing:border-box}}
.comp-map-foot{{padding:8px 14px;font-size:.72rem;color:var(--muted);border-top:1px solid var(--border);background:#faf8f3}}
.map-comp-btn{{
  display:inline-block;margin:8px 0 2px;font:inherit;font-size:.74rem;font-weight:700;cursor:pointer;
  color:#0c3c6e;background:#f0f5fb;border:1px solid #d5e2f0;border-radius:999px;padding:4px 12px;
}}
.map-comp-btn:hover{{background:#e2ecf7}}
.map-comp-btn.in{{color:#0e7a6d;border-color:#cde5dd;background:#e7f3ef}}
#compMap{{height:min(420px,52vh);width:100%;background:#e8eef5;border-radius:0 0 14px 14px}}
.mapboxgl-map{{font:inherit}}
.mapboxgl-popup-content{{padding:10px 12px;border-radius:12px;box-shadow:0 12px 28px -10px rgba(8,30,55,.35);font-size:.78rem;line-height:1.35;max-width:260px}}
.mapboxgl-popup-close-button{{font-size:16px;padding:2px 6px}}
.map-hover-tip .mapboxgl-popup-content{{
  background:#0f2740;color:#fff;padding:7px 10px;border-radius:10px;font-size:.72rem;
  box-shadow:0 10px 24px -8px rgba(8,30,55,.45);pointer-events:none
}}
.map-hover-tip .mapboxgl-popup-tip{{border-top-color:#0f2740}}
.map-hover-tip .mt-addr{{font-weight:700;display:block;max-width:240px;overflow:hidden;text-overflow:ellipsis}}
.map-hover-tip .mt-meta{{opacity:.88;font-size:.68rem;margin-top:2px;display:block}}
.listing-overlay{{cursor:pointer}}
@media(max-width:980px){{.comp-rail{{grid-template-columns:repeat(2,1fr)}}}}
@media(max-width:520px){{.comp-rail{{grid-template-columns:1fr}}}}
@media(max-width:700px){{#compMap{{height:300px}}}}
.comp-card{{background:#fff;border:1px solid var(--border);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 4px 14px rgba(15,40,70,.07);cursor:pointer;transition:box-shadow .15s ease,transform .15s ease;min-width:0;width:100%}}
.comp-card:hover{{box-shadow:0 8px 22px rgba(15,40,70,.14);transform:translateY(-2px)}}
.comp-card.subject-card{{outline:2px solid var(--brand-primary);outline-offset:-1px;cursor:default}}
.comp-card.subject-card:hover{{transform:none}}
.comp-visual{{position:relative;height:200px;background:linear-gradient(135deg,#0f2740,#1a4568)}}
.comp-visual.has-photo{{background:#1a2332}}
.comp-carousel{{position:absolute;inset:0}}
.comp-photo{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .2s ease;pointer-events:none}}
.comp-photo.is-on{{opacity:1;pointer-events:auto}}
.car-btn{{position:absolute;top:50%;transform:translateY(-50%);z-index:3;width:32px;height:32px;border:none;border-radius:50%;background:rgba(8,20,36,.55);color:#fff;font-size:1.2rem;line-height:1;cursor:pointer}}
.car-prev{{left:8px}} .car-next{{right:8px}}
.car-dots{{position:absolute;left:0;right:0;bottom:56px;z-index:3;display:flex;justify-content:center;gap:5px;pointer-events:auto}}
.car-dot{{width:7px;height:7px;border-radius:50%;border:none;padding:0;background:rgba(255,255,255,.45);cursor:pointer}}
.car-dot.on{{background:#fff}}
/* Comp rail cards: arrows only — no pagination dots */
.comp-card .car-dots{{display:none!important}}
.car-count{{position:absolute;top:10px;right:10px;z-index:3;font-size:.68rem;font-weight:700;color:#fff;background:rgba(8,20,36,.55);padding:3px 8px;border-radius:999px}}
.comp-photo-fade{{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:14px;background:linear-gradient(transparent,rgba(8,20,36,.9));color:#fff;pointer-events:none}}
.comp-photo-fade .cph-price,.comp-photo-empty .cph-price{{font-size:1.45rem;font-weight:800;letter-spacing:-.02em;line-height:1}}
.comp-photo-fade .cph-meta,.comp-photo-empty .cph-meta{{font-size:.72rem;opacity:.9;margin-top:5px}}
.comp-delta{{display:inline-block;margin-top:8px;font-size:.68rem;font-weight:700;padding:3px 8px;border-radius:999px;background:rgba(255,255,255,.16)}}
.comp-delta.up{{background:rgba(185,28,28,.85)}}
.comp-delta.down{{background:rgba(13,122,79,.85)}}
.comp-delta.same{{background:rgba(255,255,255,.2)}}
.comp-photo-empty{{position:absolute;inset:0;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end;padding:14px;color:#fff}}
.comp-card .cb{{padding:12px}}
.comp-card .ca{{font-size:.88rem;font-weight:800;color:var(--brand-primary);line-height:1.25;min-height:2.4em}}
.comp-card .cm{{font-size:.72rem;color:var(--muted);margin:3px 0 8px}}
.comp-card .match-badge{{display:inline-block;font-weight:800;color:var(--brand-primary);background:#eef5fb;border-radius:999px;padding:2px 8px;font-size:.68rem}}
.comp-card .match-why{{font-size:.68rem;color:var(--muted);line-height:1.35;margin:-2px 0 8px}}
.comp-rank-how{{margin:0 0 12px;border:1px solid var(--border);border-radius:10px;background:#f8fafc;padding:0 12px}}
.comp-rank-how summary{{cursor:pointer;font-size:.78rem;font-weight:700;color:var(--brand-primary);padding:9px 0;list-style:none}}
.comp-rank-how summary::-webkit-details-marker{{display:none}}
.comp-rank-how p{{font-size:.78rem;color:var(--muted);margin:0 0 10px;line-height:1.45}}
.section-hidden{{display:none!important}}
#spine a.spine-dim{{opacity:.35;text-decoration:line-through}}
.sections-modal{{position:fixed;inset:0;z-index:1300;display:none;align-items:center;justify-content:center;padding:16px}}
.sections-modal.open{{display:flex}}
.sections-modal .sm-backdrop{{position:absolute;inset:0;background:rgba(15,23,42,.5)}}
.sections-modal .sm-card{{position:relative;z-index:1;width:min(420px,96vw);background:#fff;border-radius:14px;padding:18px;box-shadow:0 20px 50px rgba(0,0,0,.28)}}
.sections-modal .sm-head{{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}}
.sections-modal .sm-head strong{{font-size:1rem;color:var(--brand-primary)}}
.sections-modal .sm-head button{{border:none;background:transparent;font-size:1.4rem;cursor:pointer;line-height:1;color:var(--muted)}}
.sections-modal .sm-lead{{font-size:.8rem;color:var(--muted);margin:0 0 12px;line-height:1.4}}
.sections-modal .sm-list{{display:grid;gap:6px;margin-bottom:14px}}
.sections-modal .sm-list label{{display:flex;align-items:center;gap:10px;font-size:.88rem;font-weight:600;padding:7px 8px;border-radius:8px;background:#f8fafc;border:1px solid var(--border);cursor:pointer}}
.sections-modal .sm-list input{{width:auto;margin:0}}
.sections-modal .sm-reset{{width:100%;padding:10px;border-radius:10px;border:1px solid var(--border);background:#fff;font-weight:700;color:var(--brand-primary);cursor:pointer}}
@media print{{
  .section-hidden{{display:none!important}}
  .sections-modal{{display:none!important}}
}}
.comp-card .cf{{display:grid;grid-template-columns:1fr 1fr;gap:4px 8px;margin-top:4px;font-size:.72rem}}
.comp-card .cf span{{color:var(--muted)}}
.comp-card .cf strong{{color:var(--text)}}
.photo-modal{{position:fixed;inset:0;z-index:1200;display:none;align-items:center;justify-content:center;padding:16px}}
.photo-modal.open{{display:flex}}
.photo-modal .pm-backdrop{{position:absolute;inset:0;background:rgba(15,23,42,.55)}}
.photo-modal .pm-card{{position:relative;z-index:1;width:min(440px,96vw);background:#fff;border-radius:14px;padding:18px;box-shadow:0 20px 50px rgba(0,0,0,.28)}}
.photo-modal h3{{font-size:1rem;color:var(--brand-primary);margin:0 0 6px}}
.photo-modal p{{font-size:.82rem;color:var(--muted);margin:0 0 12px;line-height:1.4}}
.photo-modal input[type=url]{{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;font-size:.88rem;margin-bottom:10px}}
.photo-modal .pm-actions{{display:flex;flex-wrap:wrap;gap:8px}}
.photo-modal .pm-actions button,.photo-modal .pm-actions label{{padding:9px 12px;border-radius:10px;font-size:.78rem;font-weight:700;cursor:pointer;border:1px solid var(--border);background:#f8fafc;color:var(--brand-primary)}}
.photo-modal .pm-actions .primary{{background:var(--brand-primary);color:#fff;border-color:var(--brand-primary)}}
.photo-modal .pm-actions input[type=file]{{display:none}}
.visual-board{{display:none;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:10px 0 14px}}
.visual-board.open{{display:grid}}
.vb-card{{border:1px solid var(--border);border-radius:12px;overflow:hidden;background:#fff}}
.vb-card img{{width:100%;height:150px;object-fit:cover;display:block;background:#dbe4ee}}
.vb-card .vb-body{{padding:10px}}
.vb-card .vb-price{{font-weight:800;font-size:1.05rem;color:var(--brand-primary)}}
.vb-card .vb-addr{{font-size:.75rem;color:var(--muted);margin-top:2px}}
.vb-card.subject{{outline:2px solid var(--brand-primary)}}
.vb-empty{{height:150px;display:flex;align-items:center;justify-content:center;background:#f1f5f9;color:var(--muted);font-size:.78rem;text-align:center;padding:12px}}
.comp-toolbar{{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin:0 0 10px;padding:10px 12px;background:#f8fafc;border:1px solid var(--border);border-radius:10px;font-size:.8rem}}
.comp-toolbar strong{{color:var(--brand-primary)}}
.comp-toolbar button{{border:1px solid var(--border);background:#fff;border-radius:8px;padding:5px 10px;font-size:.72rem;font-weight:700;cursor:pointer;color:var(--brand-primary)}}
.comp-toolbar button:hover{{background:var(--brand-primary);color:#fff}}
.btn-as-comp{{border:1px solid var(--border);background:#fff;color:var(--brand-primary);border-radius:6px;padding:3px 9px;font-size:.68rem;font-weight:700;cursor:pointer;white-space:nowrap;transition:background .12s ease,color .12s ease,border-color .12s ease}}
.btn-as-comp:hover{{background:#f1f5f9}}
.btn-as-comp.on{{background:#0b1220;border-color:#0b1220;color:#fff;box-shadow:0 1px 0 rgba(0,0,0,.12)}}
.btn-as-comp.on:hover{{background:#1a2332;border-color:#1a2332;color:#fde68a}}
.btn-as-comp:disabled{{opacity:.45;cursor:not-allowed}}
tr.comp-picked{{background:#eef2f7}}
tr.comp-picked td:first-child{{box-shadow:inset 3px 0 0 var(--brand-primary)}}
.fulldata-head{{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;cursor:pointer;user-select:none}}
.fulldata-head h2{{margin:0}}
.fulldata-toggle{{border:1px solid var(--border);background:#f8fafc;border-radius:8px;padding:6px 12px;font-size:.75rem;font-weight:700;cursor:pointer;color:var(--brand-primary);flex:none}}
.fulldata-toggle:hover{{background:#fff}}
.fulldata-body.collapsed{{display:none}}
.fulldata-sub{{margin:6px 0 0}}
.data-toolbar .tb-btn.on{{background:var(--brand-primary);color:#fff;border-color:var(--brand-primary)}}
.comp-table-toggle{{margin-top:8px;font-size:.75rem;font-weight:600;color:var(--brand-primary);background:none;border:none;cursor:pointer}}
.comp-table-wrap{{display:none;margin-top:8px}}
.comp-table-wrap.open{{display:block}}
@media(max-width:740px){{
  .ld-compare{{grid-template-columns:1fr}}
  .ld-embed-wrap{{min-height:240px}}
}}
.confront{{display:grid;grid-template-columns:1fr;gap:12px}}
.confront-out{{background:#f8fafc;border:1px solid var(--border);border-radius:10px;padding:14px;font-size:.88rem}}
.co-stat .cv{{font-size:1.2rem;font-weight:800;line-height:1.1}}
.co-stat .cl{{font-size:.58rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-top:3px;line-height:1.2}}
.co-good .cv{{color:#15803d}} .co-warn .cv{{color:#b45309}} .co-bad .cv{{color:#b91c1c}}
.co-good{{background:#f0fdf4;border-color:#bbf7d0}} .co-warn{{background:#fffbeb;border-color:#fde68a}} .co-bad{{background:#fef2f2;border-color:#fecaca}}
.co-position{{font-weight:600;margin-bottom:6px}}
.co-note{{font-size:.78rem;color:var(--muted)}}
.scenario-row{{display:flex;gap:6px;margin-top:8px}}
.scenario-row input{{flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:8px}}
.scenario-list{{list-style:none;margin-top:8px;font-size:.8rem}}
.scenario-list li{{padding:6px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:8px}}
.custom-toggle{{font-size:.75rem;color:var(--brand-primary);background:none;border:none;cursor:pointer;font-weight:600;padding:0;margin-top:6px}}
.custom-box{{display:none;margin-top:8px}}
.custom-box.open{{display:block}}
.custom-box input{{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:1.05rem;font-weight:700}}
.obj-t{{font-size:.78rem;font-weight:700;color:var(--brand-primary);text-transform:uppercase;margin-bottom:4px}}
.obj-b{{font-size:.82rem;line-height:1.4}}
.controls button{{border:1px solid var(--border);background:#f8fafc;padding:3px 11px;border-radius:14px;font-size:.72rem;cursor:pointer;font-weight:500}}
.controls button.active{{background:var(--brand-primary);color:#fff}}
.scatter-series{{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}}
.scatter-series button{{border:1px solid var(--border);background:#fff;padding:6px 12px;border-radius:10px;font-size:.78rem;font-weight:700;cursor:pointer;color:var(--muted)}}
.scatter-series button.active.series-sold{{background:rgba(12,60,110,.12);border-color:var(--brand-primary);color:var(--brand-primary)}}
.scatter-series button.active.series-active{{background:rgba(14,165,233,.12);border-color:#0ea5e9;color:#0369a1}}
.scatter-series button.active.series-home{{background:rgba(185,28,28,.12);border-color:#b91c1c;color:#b91c1c}}
.scatter-series button:not(.active){{opacity:.55;text-decoration:line-through}}
.chart-box{{position:relative;width:100%;height:320px}}
.chart-box.short{{height:240px}}
.chart-box.scatter-tall{{height:min(520px,62vh);min-height:420px}}
.chart-box img.print-chart{{display:none}}
@media(max-width:740px){{.chart-box.scatter-tall{{height:380px;min-height:340px}}}}
table{{width:100%;border-collapse:collapse;font-size:.8rem}}
th{{text-align:left;font-size:.62rem;text-transform:uppercase;color:var(--muted);padding:5px 7px;border-bottom:1px solid var(--border);white-space:nowrap}}
td{{padding:6px 7px;border-bottom:1px solid var(--border);white-space:nowrap}}
tr.rec{{background:var(--rec);font-weight:600}}
tr.excluded{{opacity:.35;text-decoration:line-through}}
.two-col{{display:grid;grid-template-columns:1fr 1fr;gap:12px}}
.split{{display:grid;grid-template-columns:1fr 1fr;gap:12px}}
.split ul{{padding-left:16px;font-size:.85rem}}
.muted{{color:var(--muted);font-size:.78rem}}
footer{{text-align:center;color:var(--muted);font-size:.72rem;margin-top:20px;padding-top:16px;border-top:1px solid var(--border)}}
.data-toolbar{{display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;align-items:center}}
.data-toolbar:not(.data-search-bar) input{{flex:1;min-width:140px;padding:6px 8px;border:1px solid var(--border);border-radius:6px}}
.data-toolbar:not(.data-search-bar) button,.data-toolbar:not(.data-search-bar) select{{padding:5px 10px;border-radius:6px;border:1px solid var(--border);background:#f8fafc;cursor:pointer;font-size:.72rem}}
.col-picker{{display:none;background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px;max-height:200px;overflow:auto}}
.col-picker.open{{display:block}}
.col-picker-grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:4px}}
.col-check{{font-size:.72rem;display:flex;align-items:center;gap:4px;cursor:pointer}}
.data-wrap{{max-height:720px;overflow:auto;border:1px solid var(--border);border-radius:8px}}
.data-wrap th{{position:sticky;top:0;background:#f1f5f9;z-index:1;cursor:pointer;user-select:none}}
.data-wrap th:hover{{background:#e2e8f0}}
.data-wrap th .sort-ind{{margin-left:3px;color:var(--brand-primary)}}
.data-wrap th[data-sort="__comp__"]{{min-width:7.5rem}}
.yoy-charts{{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px}}
.yoy-charts.stacked{{grid-template-columns:1fr}}
.yoy-charts.stacked .chart-box.short{{height:300px}}
.md-panel{{margin-top:18px;padding:16px 16px 14px;border:1px solid var(--border);border-radius:16px;background:linear-gradient(180deg,#fff,#f8fafc)}}
.md-panel:first-of-type{{margin-top:12px}}
.md-panel-head{{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:8px}}
.md-panel-head h3{{margin:0;font-size:1.05rem;font-family:'Fraunces',Georgia,serif;font-weight:700;color:var(--ink);letter-spacing:-.01em}}
.md-panel-head .md-tag{{font-size:.62rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--brand-primary);background:#eef5fb;border-radius:999px;padding:4px 10px}}
.md-talk{{font-size:.9rem;line-height:1.5;color:var(--text);margin:0 0 12px;padding:10px 12px;border-left:3px solid var(--brand-primary);background:#f4f8fc;border-radius:0 10px 10px 0}}
.md-talk strong{{color:var(--brand-primary)}}
.md-chart-grid{{display:grid;grid-template-columns:1fr 1fr;gap:14px}}
.md-chart-grid.solo{{grid-template-columns:1fr}}
.md-chart-block h4{{margin:0 0 6px;font-size:.78rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}}
.md-chart-block .chart-box{{height:280px}}
.md-chart-block .chart-box.short{{height:240px}}
.md-chart-block .chart-box.feature{{height:320px}}
@media(max-width:800px){{
  .md-chart-grid{{grid-template-columns:1fr}}
  .md-chart-block .chart-box,.md-chart-block .chart-box.short,.md-chart-block .chart-box.feature{{height:240px}}
}}
.print-only{{display:none}}
.section-kicker{{font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 4px}}
a.link{{color:var(--blue);text-decoration:none;font-weight:500;margin-right:3px}}
.status-pill{{display:inline-block;padding:1px 7px;border-radius:10px;font-size:.68rem;font-weight:600}}
.st-Sold{{background:#e8f5e9;color:#0d7a4f}}
.st-Active{{background:#e3f2fd;color:#1565c0}}
.st-Pending,.st-Backup,.st-FirstRight{{background:#fff3e0;color:#e65100}}
.st-Expired,.st-Withdrawn{{background:#fce4ec;color:#c62828}}
.core-facts{{position:relative;overflow:hidden;background:linear-gradient(165deg,#0c2238 0%,#143556 55%,#0f2d4a 100%);color:#fff;border-radius:16px;padding:26px 26px 28px;margin-bottom:14px;box-shadow:0 16px 40px rgba(8,30,55,.35)}}
.core-facts::before{{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 80% 50% at 100% -10%,rgba(253,230,138,.12),transparent 55%),radial-gradient(ellipse 60% 40% at -5% 100%,rgba(143,184,221,.1),transparent 50%);pointer-events:none}}
.core-facts .cf-head{{position:relative;z-index:1;text-align:center;margin:0 auto 22px;max-width:100%;padding:0 4px}}
.core-facts .cf-eyebrow{{font-family:'Fraunces',Georgia,serif;font-size:clamp(1.05rem,2.6vw,1.6rem);letter-spacing:-.01em;text-transform:none;color:#fff;font-weight:700;line-height:1.15;white-space:nowrap}}
@media(max-width:520px){{.core-facts .cf-eyebrow{{font-size:clamp(0.72rem,3.1vw,0.95rem);letter-spacing:.01em}}}}
.cf-grid{{display:grid;grid-template-columns:1fr;gap:10px;position:relative;z-index:1}}
@media(min-width:640px){{.cf-grid{{grid-template-columns:repeat(2,1fr)}}}}
@media(min-width:980px){{.cf-grid{{grid-template-columns:repeat(3,1fr)}}}}
.cf-card{{display:flex;flex-direction:column;gap:8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:16px 16px 14px;min-height:168px;transition:background .2s ease,border-color .2s ease,transform .2s ease}}
.cf-card:hover{{background:rgba(255,255,255,.1);border-color:rgba(253,230,138,.35);transform:translateY(-1px)}}
.cf-card .cf-top{{display:flex;align-items:center;gap:10px}}
.cf-card .cf-n{{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:#fde68a;color:#0c2238;font-size:.8rem;font-weight:800;box-shadow:0 2px 8px rgba(253,230,138,.35)}}
.cf-card .cf-t{{font-size:.95rem;font-weight:800;color:#fff;line-height:1.25;letter-spacing:-.01em}}
.cf-card .cf-b{{font-size:.8rem;line-height:1.45;color:rgba(255,255,255,.8);margin:0;flex:1}}
.cf-card .cf-b strong{{color:#fde68a;font-weight:700}}
.cf-card .cf-metric{{margin-top:auto;display:flex;flex-wrap:wrap;gap:6px;padding-top:4px}}
.cf-card .cf-m{{display:inline-flex;flex-direction:column;align-items:flex-start;padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.12);min-width:4.5rem}}
.cf-card .cf-m .mv{{font-size:1.15rem;font-weight:800;letter-spacing:-.02em;color:#fde68a;line-height:1}}
.cf-card .cf-m .ml{{font-size:.58rem;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.65);font-weight:700;margin-top:4px}}
.cf-card.cf-key{{background:rgba(253,230,138,.1);border-color:rgba(253,230,138,.32)}}
@media(max-width:740px){{
  .two-col,.confront,.market-duo,.split{{grid-template-columns:1fr}}
  .price-row,.rate-live,.obj-grid{{grid-template-columns:repeat(1,1fr)}}
  .rate-bands{{grid-template-columns:repeat(2,1fr)}}
  #spine-strategy .whatif-grid{{
    display:flex;flex-wrap:nowrap;gap:5px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:thin;padding-bottom:2px
  }}
  #spine-strategy .whatif-card{{flex:1 1 0;min-width:68px}}
  #spine-strategy .co-stats{{grid-template-columns:repeat(3,minmax(0,1fr))}}
  .kpis,.kpis.market-kpis,.kpis.yoy-kpis{{grid-template-columns:repeat(2,1fr)}}
}}
@media print{{
  @page{{size:11in 8.5in;margin:0}}
  *{{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  .fab,.agent-menu-wrap,.agent-chip,.agent-panel,.panel-overlay,.view-modes,.top-bar,.spine,.report-side,
  .listing-drawer,.listing-overlay,.photo-modal,.controls,.scatter-series,
  #spine-fulldata,.share-bar,.price-controls .slider-wrap,
  .slider-track-wrap,input[type=range],.slider-scale,
  .comp-toolbar,.comp-table-toggle,.comp-table-wrap,.car-btn,.car-count,
  #confrontOut,.rate-row,.kpi .tip,.comp-photo-fade,.photo-fetch-banner,
  .page > .two-col,
  .page > .section:not([id]),
  #spine-strategy .response-grid .confront-out{{display:none!important}}
  html,body{{background:#fff!important;margin:0;padding:0}}
  .report-shell{{display:block;max-width:none;padding:0;margin:0}}
  .page{{max-width:none;width:11in;padding:0;margin:0}}

  /* One landscape sheet per spine section — inset box so printer margins cannot clip */
  /* marker: print-page-spine */
  /* marker: print-fit-v5 */
  .page > .hero,
  .page > .core-facts,
  .page > .section[id^="spine-"]:not(#spine-fulldata){{
    box-sizing:border-box;
    width:10.5in;height:7.9in;max-height:7.9in;min-height:7.9in;
    margin:0.3in auto;
    padding:0.22in 0.34in;
    border:none;border-radius:0;box-shadow:none!important;
    overflow:hidden;
    page-break-after:always;break-after:page;
    page-break-inside:avoid;break-inside:avoid;
    display:flex;flex-direction:column;
  }}
  .page > .hero{{
    padding:0.5in 0.5in;display:flex;align-items:center;
  }}
  .page > .core-facts,
  #spine-rating{{
    display:flex;flex-direction:column;justify-content:center;
  }}
  #spine-supply[style*="display:none"]{{display:none!important}}
  #spine-comps-more[hidden]{{display:none!important}}
  .section:hover{{box-shadow:none!important}}

  /* Nested blocks never become their own print pages */
  .section .section,
  .section .verdict,
  .two-col .section{{
    height:auto!important;min-height:0!important;max-height:none!important;
    page-break-after:auto!important;break-after:auto!important;
    page-break-before:auto!important;break-before:auto!important;
    overflow:visible;padding:0;margin:0;
  }}

  /* ——— Keep every sheet inside the printable box ——— */
  .section-kicker{{display:none!important}}
  .page > footer{{display:none!important}}
  h2{{font-size:.98rem!important;margin-bottom:4px!important;line-height:1.2}}
  .sub{{font-size:.7rem!important;margin-bottom:6px!important;line-height:1.35;
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}}
  .ask-card .aa{{
    display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;
    font-size:.68rem!important;line-height:1.3
  }}
  .ask-card .aq{{font-size:.62rem!important}}
  .ask-trio{{gap:6px!important;margin-bottom:6px!important}}
  .market-duo .n{{font-size:2rem!important}}
  .market-duo .duo{{padding:10px 8px!important}}

  /* Market: primary KPIs only + compact band chart */
  #spine-market .kpis.market-kpis .kpi:nth-child(n+5){{display:none!important}}
  #spine-market .kpis.market-kpis{{grid-template-columns:repeat(4,1fr)!important;gap:6px!important;flex:none}}
  #spine-market .band-wrap{{flex:1 1 auto;min-height:0;margin-top:6px!important;display:flex;flex-direction:column}}
  #spine-market .band-wrap h3{{font-size:.78rem;margin:0 0 2px}}
  #spine-market .band-wrap > .sub{{display:none!important}}
  #spine-market .band-insight{{
    font-size:.68rem!important;margin:4px 0 0;flex:none;
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden
  }}
  #spine-market .band-wrap .chart-box{{flex:1 1 auto;min-height:120px!important;max-height:none!important}}
  #spine-market .market-def,#spine-market .mdef{{
    font-size:.68rem;margin-bottom:4px;
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden
  }}

  /* Supply: drop long copy, keep metrics + chart */
  #spine-supply > .sub{{display:none!important}}
  #spine-supply .supply-line .sl-d{{
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:.68rem
  }}
  #spine-supply .sw-d,#spine-supply .sp-b{{
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:.66rem
  }}
  #spine-supply .supply-chart-wrap{{flex:1 1 auto;min-height:0}}
  #spine-supply .supply-chart-wrap .chart-box{{flex:1 1 auto;min-height:140px!important}}

  /* Comps: all 8 on one landscape page (4×2) */
  #spine-comps .comp-map-wrap,
  #spine-comps .comp-subject,
  #spine-comps .comp-rank-how,
  #spine-comps .comp-toolbar,
  #spine-comps .comp-table-toggle,
  #spine-comps .comp-table-wrap,
  #spine-comps-more,
  .print-only{{display:none!important}}
  #spine-comps .comp-rail{{
    display:grid!important;
    grid-template-columns:repeat(4,1fr);
    grid-template-rows:1fr 1fr;
    gap:7px;
    padding:0;
    flex:1 1 auto;
    min-height:0;
    align-content:stretch;
  }}
  #spine-comps .comp-rail .comp-card{{
    display:flex!important;flex-direction:column;min-height:0;height:100%;
    box-shadow:none;border-radius:10px;
  }}
  #spine-comps .comp-visual{{height:70px!important;flex:none}}
  #spine-comps .comp-card .cb{{padding:5px 7px 7px;flex:1}}
  #spine-comps .comp-card .ca{{font-size:.68rem;min-height:0;line-height:1.15;margin:0}}
  #spine-comps .comp-card .cm{{margin:2px 0 3px;font-size:.58rem}}
  #spine-comps .comp-card .match-why{{display:none}}
  #spine-comps .comp-card .cf{{font-size:.56rem;gap:2px 5px;margin-top:2px}}
  #spine-comps .comp-card .match-badge{{font-size:.54rem;padding:1px 5px}}
  #spine-comps .cph-price{{font-size:1rem!important}}
  #spine-comps .cph-meta{{font-size:.58rem!important}}
  #spine-comps .comp-delta{{display:none}}
  #spine-comps > .sub{{margin-bottom:4px;font-size:.68rem}}
  #spine-comps > h2{{margin-bottom:2px}}

  /* Charts: snapshot images must use height:auto — % height on auto parent collapses to 0 */
  .chart-box{{
    height:auto!important;min-height:140px!important;max-height:none!important;
    flex:1 1 auto;
  }}
  .chart-box.short{{height:auto!important;min-height:120px!important;max-height:none!important}}
  .chart-box canvas{{display:none!important}}
  .chart-box img.print-chart{{
    display:block!important;width:100%!important;height:auto!important;
    max-height:3.35in!important;object-fit:contain!important;
  }}
  .chart-box.scatter-tall img.print-chart{{max-height:4.5in!important}}
  .chart-box:not(:has(img.print-chart)) canvas{{display:block!important;width:100%!important;height:auto!important;max-height:3.35in!important}}

  #spine-position .scatter-series{{display:none!important}}
  #spine-position .chart-box.scatter-tall{{
    flex:1 1 auto!important;min-height:280px!important;height:auto!important;max-height:none!important;
  }}
  #spine-position .story-note{{
    font-size:.78rem;margin-top:8px;flex:none;
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden
  }}
  #spine-position .sub{{margin-bottom:4px}}

  #spine-yoy .md-panel,
  #spine-prices .md-panel,
  #spine-timing .md-panel{{
    flex:1 1 auto;display:flex;flex-direction:column;min-height:0;
    margin:2px 0 0;padding:8px 10px;border-radius:10px;background:#fff;
  }}
  #spine-yoy .md-talk,
  #spine-prices .md-talk,
  #spine-timing .md-talk{{
    font-size:.72rem;margin-bottom:6px;padding:6px 8px;flex:none;
    display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden
  }}
  #spine-yoy .md-chart-grid,
  #spine-prices .md-chart-grid,
  #spine-timing .md-chart-grid{{
    flex:1 1 auto;display:grid;grid-template-columns:1fr 1fr;gap:10px;min-height:0;align-items:stretch;
  }}
  #spine-timing .md-chart-grid.solo{{grid-template-columns:1fr;margin-top:8px;flex:0.85 1 auto}}
  #spine-yoy .md-chart-block,
  #spine-prices .md-chart-block,
  #spine-timing .md-chart-block{{
    display:flex;flex-direction:column;min-height:0;
  }}
  #spine-yoy .md-chart-block .chart-box,
  #spine-prices .md-chart-block .chart-box,
  #spine-timing .md-chart-block .chart-box,
  #spine-yoy .md-chart-block .chart-box.short,
  #spine-prices .md-chart-block .chart-box.short,
  #spine-timing .md-chart-block .chart-box.short,
  #spine-yoy .md-chart-block .chart-box.feature,
  #spine-prices .md-chart-block .chart-box.feature,
  #spine-timing .md-chart-block .chart-box.feature{{
    flex:1 1 auto!important;min-height:170px!important;height:auto!important;max-height:none!important;
  }}
  #spine-yoy .yoy-kpis{{display:none!important}}
  #spine-yoy .md-panel-head .md-tag,
  #spine-prices .md-panel-head .md-tag,
  #spine-timing .md-panel-head .md-tag{{display:none}}

  #spine-market .band-wrap{{flex:1 1 auto;display:flex;flex-direction:column;min-height:0;margin-top:6px}}
  #spine-supply .supply-chart-wrap{{flex:1 1 auto;display:flex;flex-direction:column;min-height:0}}

  #spine-rating{{justify-content:flex-start!important}}
  #spine-rating .rate-bands{{flex:1;align-content:center;gap:10px;margin:8px 0}}
  #spine-rating .rate-band{{min-height:110px;padding:14px 12px}}
  #spine-rating .rate-live{{margin-top:auto}}

  /* Strategy: keep recommendation + lanes + while-you-wait inside the sheet */
  #spine-strategy > .sub{{display:none!important}}
  #spine-strategy .bottom-line{{
    font-size:.68rem!important;line-height:1.3;margin:2px 0 6px!important;padding:4px 0 4px 10px!important;
    display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;flex:none
  }}
  #spine-strategy .verdict{{flex:none;padding:10px 14px!important;margin:0 0 6px!important}}
  #spine-strategy .verdict .big{{font-size:1.85rem!important}}
  #spine-strategy .verdict .sub{{font-size:.78rem!important;-webkit-line-clamp:2}}
  #spine-strategy .price-controls{{flex:none;padding:8px 10px!important;margin:0 0 6px!important}}
  #spine-strategy .slider-wrap{{display:none!important}}
  #spine-strategy .wyw-lede,#spine-strategy .wyw-note,#spine-strategy .wyw-bar-wrap{{display:none!important}}
  #spine-strategy .wyw{{padding:8px 10px!important}}
  #spine-strategy .response-grid{{flex:1 1 auto;min-height:0;margin-top:4px!important}}
  #spine-strategy .whatif-grid{{gap:6px!important}}
  #spine-strategy .whatif-card{{padding:6px 4px!important;font-size:.68rem}}

  #spine-net > .sub{{display:none!important}}
  #spine-net .net-grid{{flex:1 1 auto;align-items:stretch;min-height:0;gap:8px!important}}
  #spine-net .net-lines{{overflow:hidden}}
  #spine-net .net-summary{{display:flex;flex-direction:column;justify-content:center;padding:10px!important}}
  #spine-net .net-summary .ns-big{{font-size:1.55rem!important}}
  #spine-net .net-summary .ns-fine{{display:none}}
  #spine-net .net-row{{padding:3px 8px!important;font-size:.72rem!important}}
  #spine-net .net-row .ni input{{border:none;background:transparent;padding:0 12px 0 0;font-size:.72rem}}

  #compMap{{height:240px!important}}
  .comp-map-foot{{display:none!important}}
  .comp-map-legend .map-kind{{border:none;background:transparent;padding:0;cursor:default}}
  .net-grid{{grid-template-columns:1.15fr .85fr;gap:8px}}
  a[href]::after{{content:none!important}}
  .whatif-grid{{display:grid!important;grid-template-columns:repeat(var(--whatif-cols,5),minmax(0,1fr))!important;overflow:visible!important;gap:6px}}
  .price-controls{{display:block!important;margin-top:4px}}
  .market-duo,.ask-trio,.supply-wait,.supply-hero,.cf-grid,.comp-card,.verdict,.wyw,.response-grid{{page-break-inside:avoid}}
  .kpis,.kpis.market-kpis,.kpis.yoy-kpis{{gap:5px}}
  .kpi{{padding:6px 4px}}
  .kpi .v{{font-size:1.05rem}}
  .kpi .l{{font-size:.55rem}}
}}
body.print-leavebehind .fab,
body.print-leavebehind .agent-menu-wrap,
body.print-leavebehind .agent-chip,
body.print-leavebehind .agent-panel,
body.print-leavebehind .panel-overlay,
body.print-leavebehind .top-bar,
body.print-leavebehind .spine,
body.print-leavebehind .report-side,
body.print-leavebehind .listing-drawer,
body.print-leavebehind .listing-overlay,
body.print-leavebehind #spine-fulldata,
body.print-leavebehind .page > .two-col,
body.print-leavebehind .page > .section:not([id]),
body.print-leavebehind .page > footer,
body.print-leavebehind #spine-comps-more,
body.print-leavebehind .print-only{{display:none!important}}
body.print-leavebehind .page{{padding-bottom:0}}
</style>
</head>
<body>
<div class="report-shell">
<aside class="report-side" id="reportSide" aria-label="Report navigation">
  <div class="rs-brand">ListLogic</div>
  <div class="rs-app" id="reportAppNav" hidden>
    <div class="rs-label">Workspace</div>
    <a href="/saas/app.html">Dashboard</a>
    <a href="/saas/app.html#generate">Generate</a>
    <a href="/saas/app.html#reports">Reports</a>
    <a href="/saas/app.html#team" id="reportNavTeam" hidden>Team</a>
    <a href="/saas/onboarding.html">Settings</a>
    <a href="/saas/admin.html" id="reportNavOwner" hidden>Owner console</a>
    <div class="rs-sep"></div>
  </div>
  <div class="rs-label">This report</div>
  <nav class="spine" id="spine">
    <a href="#spine-corefacts" data-spine="corefacts">How It Works</a>
    <a href="#spine-market" data-spine="market">1 · Market</a>
    <a href="#spine-supply" data-spine="supply"{'' if show_listing_flow else ' hidden'}>2 · Supply</a>
    <a href="#spine-comps" data-spine="comps">3 · Comps</a>
    <a href="#spine-rating" data-spine="rating">4 · Your Home</a>
    <a href="#spine-position" data-spine="position">5 · Position</a>
    <a href="#spine-yoy" data-spine="yoy">6 · Pace</a>
    <a href="#spine-prices" data-spine="prices">6b · Prices</a>
    <a href="#spine-timing" data-spine="timing">6c · Timing</a>
    <a href="#spine-strategy" data-spine="strategy">7 · Price It</a>
    <a href="#spine-net" data-spine="net">8 · Net Sheet</a>
    <a href="#spine-fulldata" data-spine="fulldata">Full Market Data</a>
  </nav>
</aside>
<div class="page">
  <div class="hero">
    <div>
      <div class="brand">{logo_html}{brand_text}</div>
      <h1>{hero_title}</h1>
      <div class="hero-chips">{hero_chips}</div>
    </div>
    <div class="meta">{meta_html}</div>
  </div>

  <div class="top-bar">
    <div class="view-modes" id="viewModes">
      <span class="vm-label">Presentation</span>
      <span class="vm on">Live story</span>
      <button type="button" class="vm" id="btnPrintLeavebehind" title="Print the Live Story — one section per page">Print leave-behind</button>
      <a id="deckLink" href="#" style="display:none">Flipbook</a>
      <a id="pdfLink" href="#" style="display:none">Packet PDF</a>
      <a id="storyPdfLink" href="#" style="display:none">Story PDF</a>
      <button type="button" class="vm" id="btnCopyShare" style="display:none">Share with client</button>
      <span class="vm-status" id="shareStatus"></span>
    </div>
  </div>
  <div class="photo-fetch-banner" id="photoFetchBanner" aria-live="polite">
    <span class="spin" aria-hidden="true"></span>
    <span class="pf-msg" id="photoFetchMsg">Fetching listing photos…</span>
    <span class="pf-count" id="photoFetchCount"></span>
  </div>

  <div class="agent-menu-wrap" id="agentMenuWrap">
    <button type="button" class="agent-chip" id="fab" aria-haspopup="menu" aria-expanded="false" aria-controls="agentMenu" title="Account menu">
      <span class="agent-avatar">{agent_initials}</span>
      <span class="agent-chip-text"><strong>{agent_name_only}</strong><span>Menu</span></span>
      <span class="agent-caret" aria-hidden="true">▾</span>
    </button>
    <div class="agent-menu" id="agentMenu" role="menu" hidden>
      <a href="/saas/app.html" role="menuitem">
        <span class="mi-ico">⌂</span>
        <span class="mi-copy"><strong>Dashboard</strong><span>Saved reports &amp; new generate</span></span>
      </a>
      <a href="/saas/app.html#generate" role="menuitem">
        <span class="mi-ico">＋</span>
        <span class="mi-copy"><strong>New presentation</strong><span>Upload MLS &amp; build another</span></span>
      </a>
      <button type="button" class="mi" id="menuOpenTools" role="menuitem">
        <span class="mi-ico">✎</span>
        <span class="mi-copy"><strong>Edit this report</strong><span>Price, story, coach, photos</span></span>
      </button>
      <button type="button" class="mi" id="menuSections" role="menuitem">
        <span class="mi-ico">☰</span>
        <span class="mi-copy"><strong>Sections</strong><span>Include or hide report steps</span></span>
      </button>
      <div class="mi-sep"></div>
      <a href="/saas/pricing.html" role="menuitem">
        <span class="mi-ico">$</span>
        <span class="mi-copy"><strong>Plans &amp; billing</strong><span>Upgrade or manage plan</span></span>
      </a>
      <a href="/saas/onboarding.html" role="menuitem">
        <span class="mi-ico">◎</span>
        <span class="mi-copy"><strong>Settings</strong><span>Password, branding, brokerage</span></span>
      </a>
      <a href="/saas/admin.html" role="menuitem" id="menuAdminLink" hidden>
        <span class="mi-ico">⚙</span>
        <span class="mi-copy"><strong>Owner console</strong><span>Users, reports &amp; AI chats</span></span>
      </a>
      <button type="button" class="mi" id="menuSignOut" role="menuitem">
        <span class="mi-ico">⎋</span>
        <span class="mi-copy"><strong>Sign out</strong><span>End this browser session</span></span>
      </button>
    </div>
  </div>

  <section class="core-facts" id="spine-corefacts">
    <div class="cf-head">
      <div class="cf-eyebrow">Core Facts of ListLogic — Data Driven Pricing</div>
    </div>
    <div class="cf-grid">
      <article class="cf-card">
        <div class="cf-top"><span class="cf-n">1</span><div class="cf-t">The Market Is Custom-Fit to This Home</div></div>
        <p class="cf-b">We don’t price against the whole city. Size, garage, area, and timeframe are filtered so the comparison is <strong>apples to apples</strong> — what a buyer would actually put side-by-side with yours.</p>
      </article>
      <article class="cf-card cf-key">
        <div class="cf-top"><span class="cf-n">2</span><div class="cf-t">Absorption Sets the Pace</div></div>
        <p class="cf-b">How fast this segment sells vs. how many are for sale. That ratio — months of inventory — is the clearest read on seller vs. buyer leverage.</p>
        <div class="cf-metric">
          <div class="cf-m"><span class="mv">{inv:.1f}</span><span class="ml">Months inv.</span></div>
          <div class="cf-m"><span class="mv">{active_n}</span><span class="ml">Active</span></div>
          <div class="cf-m"><span class="mv">{sales_mo:.1f}</span><span class="ml">Sales / mo</span></div>
        </div>
      </article>
      <article class="cf-card">
        <div class="cf-top"><span class="cf-n">3</span><div class="cf-t">Competition Is Who’s for Sale Now</div></div>
        <p class="cf-b">Only <strong>Active</strong> listings compete for buyers. Pending and Backup are already spoken for. List yours, and buyers choose among this many homes — including you.</p>
        <div class="cf-metric">
          <div class="cf-m"><span class="mv">{with_yours}</span><span class="ml">If you list</span></div>
          <div class="cf-m"><span class="mv">{active_n}</span><span class="ml">Active now</span></div>
        </div>
      </article>
      <article class="cf-card">
        <div class="cf-top"><span class="cf-n">4</span><div class="cf-t">Buyers Set Value — Closes Prove It</div></div>
        <p class="cf-b">Asking prices are opinions. <strong>Sold prices are facts.</strong> The recommended list is anchored to what buyers just paid for the closest recent comparables — not what neighbors hope to get.</p>
      </article>
      <article class="cf-card">
        <div class="cf-top"><span class="cf-n">5</span><div class="cf-t">Location Is Fixed — Condition Moves the Number</div></div>
        <p class="cf-b">Within your segment, updates and presentation decide where you land in the band. We’ll rate the home <strong>together, 1–10</strong>, and the list price responds live to that rating.</p>
      </article>
      <article class="cf-card">
        <div class="cf-top"><span class="cf-n">6</span><div class="cf-t">Price Buys Time — and Odds</div></div>
        <p class="cf-b">Priced with the market, homes here go under contract in about this many days. Overpriced homes linger — and become the listing that <strong>helps sell everyone else’s house</strong>.</p>
        <div class="cf-metric">
          <div class="cf-m"><span class="mv">{median_dom:.0f}</span><span class="ml">Median days</span></div>
        </div>
      </article>
    </div>
  </section>

  <section class="section" id="spine-market">
    <h2><span class="ttl"><span class="step">1</span>Homes on the Market</span><span class="temp {temp_class}">{temp_label} · {inv:.1f} mo inventory</span></h2>
    {market_def_html}
    <p class="sub">Competition = <strong>Active only</strong>. Pending + Backup are under contract — already spoken for, not inventory.</p>
    <div class="market-duo">
      <div class="duo"><div class="n">{active_n}</div><div class="t">Active on Market</div></div>
      <div class="duo yours"><div class="n">{with_yours}</div><div class="t">With Your Home Included</div></div>
    </div>
    <div class="ask-trio">
      <div class="ask-card"><div class="aq">How Long Should It Take?</div><div class="aa">{ask.get("how_long") or f"Typical time to contract is about <b>{median_dom:.0f} days</b>."}</div></div>
      <div class="ask-card"><div class="aq">What Are the Odds?</div><div class="aa">{ask.get("odds") or f"About <b>{odds_pct:.0f}%</b> chance of going under contract in ~30 days when priced well."}</div></div>
      <div class="ask-card"><div class="aq">When Is the Market Most Active?</div><div class="aa">{ask.get("when_active") or f"Homes are absorbing at about <b>{sales_mo:.1f}</b> sales per month."}</div></div>
    </div>
    <div class="band-wrap" id="bandWrap" style="{'display:none' if not (price_bands.get('labels')) else ''}">
      <h3>Active Competition by List-Price Band</h3>
      <p class="sub" style="margin-bottom:6px">Where today’s Active homes sit by asking price — the highlighted band is the market-supported value line from comps.</p>
      <div class="chart-box short"><canvas id="priceBandChart"></canvas></div>
      <p class="band-insight" id="bandInsight">{band_insight}</p>
    </div>
    <div class="kpis market-kpis">
      <div class="kpi"><div class="v">{uc_n}</div><div class="l">Under Contract</div></div>
      <div class="kpi"><div class="v">{sales_mo:.1f}</div><div class="l">Sales / Month</div></div>
      <div class="kpi"><div class="v">{inv:.1f}</div><div class="l">Months of Inventory</div></div>
      <div class="kpi"><div class="v">{odds_pct:.0f}%</div><div class="l">30-Day Market Odds</div></div>
      <div class="kpi"><div class="v">{s.get("sold_count", 0)}</div><div class="l">Recently Closed</div></div>
      {dns_kpi_true}
      {dns_kpi_churn}
      <div class="kpi"><div class="v">${(s.get("median_sold_price") or 0)/1000:.0f}k</div><div class="l">Median Sold Price</div></div>
      <div class="kpi"><div class="v">{(s.get("median_dom") or 0):.0f}</div><div class="l">Median Days on Market</div></div>
      <div class="kpi"><div class="v">${(s.get("median_price_per_sqft") or 0):.0f}</div><div class="l">Median $ / Sq Ft</div></div>
    </div>
  </section>

  <section class="section supply-section" id="spine-supply" style="{'display:none' if not show_listing_flow else ''}">
    <h2><span class="ttl"><span class="step">2</span>The Supply Stream</span>
      <span class="temp {'hot' if lf_pressure_tone == 'building' else 'warm'}">{lf_pressure_headline} · {lf_pressure:.2f}×</span>
    </h2>
    <p class="sub">Active competition is a snapshot. The supply stream is the <strong>pipeline</strong> — new homes that keep arriving while yours sits. Price above the market-supported value line, and fresher listings underneath yours become the ones buyers tour first.</p>
    <div class="supply-line" id="supplyLine">
      <div>
        <div class="sl-k">Market-Supported Value Line</div>
        <div class="sl-v" id="supplyLinePrice">${rec:,.0f}</div>
      </div>
      <div class="sl-d" id="supplyLineCopy">From recent comps for similar homes — not your final ask yet. We use this line to count how many listings are already cheaper, and how many more arrive while a typical sale takes ~{lf_wait_dom:.0f} days. Agent tools can override the line later if needed.</div>
    </div>
    <div class="supply-hero">
      <div class="supply-balance">
        <div class="sb-title">New Listings vs Sales · Recent Pace</div>
        <div class="sb-pair">
          <div><div class="sb-n">{lf_new_pm:.1f}</div><div class="sb-l">New / month</div></div>
          <div><div class="sb-n">{lf_sales_pm:.1f}</div><div class="sb-l">Sales / month</div></div>
        </div>
        <div class="sb-bar" aria-hidden="true">
          <div class="new" style="width:{lf_new_share}%"></div>
          <div class="sold" style="width:{lf_sale_share}%"></div>
        </div>
        <div class="sb-legend">
          <span>New listings {lf_new_share:.0f}%</span>
          <span>Sales {lf_sale_share:.0f}%</span>
        </div>
      </div>
      <div class="supply-pressure">
        <span class="sp-tone {lf_pressure_tone}">{lf_pressure_tone}</span>
        <div class="sp-h">{lf_pressure_headline}</div>
        <p class="sp-b">{lf_pressure_blurb}</p>
        <div class="sp-metric">
          <div class="sp-m"><div class="mv">{lf_pressure:.2f}×</div><div class="ml">Supply pressure</div></div>
          <div class="sp-m"><div class="mv">{('+' if lf_net >= 0 else '')}{lf_net:.1f}</div><div class="ml">Net / month</div></div>
        </div>
      </div>
    </div>
    <div class="supply-wait">
      <div class="sw">
        <div class="sw-t">Cheaper New Listings</div>
        <div class="sw-v" id="supplyBelowPm">{lf_below_pm:.1f}<span style="font-size:.85rem;font-weight:700;color:var(--muted)"> / mo</span></div>
        <div class="sw-d" id="supplyBelowPmCopy">Similar-size homes that <strong>come on market under</strong> <span class="supply-line-ref">${rec:,.0f}</span> each month — the better-value stream buyers see first.</div>
      </div>
      <div class="sw">
        <div class="sw-t">Already Cheaper Today</div>
        <div class="sw-v" id="supplyActiveBelow">{lf_active_below}</div>
        <div class="sw-d" id="supplyActiveBelowCopy"><strong>Active</strong> homes right now asking less than <span class="supply-line-ref">${rec:,.0f}</span> — already on the buyer tour list.</div>
      </div>
      <div class="sw accent">
        <div class="sw-t">During a typical ~{lf_wait_dom:.0f}-day sale</div>
        <div class="sw-v" id="supplyWaitFresh">~{lf_wait_fresh:.1f}</div>
        <div class="sw-d" id="supplyWaitCopy">Extra similar homes expected to <strong>list under that line</strong> before a well-priced home usually goes under contract — on top of what’s Active today.</div>
      </div>
    </div>
    <div class="supply-chart-wrap">
      <h3 style="font-size:.9rem;margin:0 0 6px;color:var(--brand-primary)">New Listings vs Closed Sales by Month</h3>
      <p class="sub" style="margin-bottom:8px">When the blue bars run ahead of navy, inventory is building in this competitive set.</p>
      <div class="chart-box"><canvas id="listingFlowChart"></canvas></div>
      <p class="supply-insight" id="flowInsight">{lf_insight}{' ' + lf_overprice if lf_overprice else ''}</p>
    </div>
  </section>

  <section class="section" id="spine-comps">
    <h2><span class="ttl"><span class="step">3</span>Closest Comparable Sales</span></h2>
    <p class="sub" data-lede="comps">{lede_comps}</p>
    <details class="comp-rank-how">
      <summary>How comps are ranked</summary>
      <p>Auto picks score every sold home in this market against yours. Living area carries the most weight, then beds, year built, baths, and garage. Recent sales beat older ones. Extreme price outliers that match size but not the product get filtered out. The match % is relative to the best comp on <em>this</em> report — #1 is always the closest fit.</p>
    </details>
    <div class="comp-toolbar" id="compToolbar">
      <span id="compToolbarLabel"><strong>Auto picks</strong> · closest sales for this home</span>
      <div class="comp-find">
        <input type="search" id="compFindInput" placeholder="Find MLS # or address…" autocomplete="off">
        <button type="button" id="btnCompFind">Find in list</button>
      </div>
      <button type="button" id="btnResetComps">Reset to auto</button>
      <button type="button" id="btnJumpFullData">Browse full list ↓</button>
    </div>
    <div class="comp-subject" id="subjectCompSlot">{subject_slot}</div>
    <div class="comp-rail" id="compRail">{comps_cards or '<p class="muted">No close comps</p>'}</div>
    <div class="comp-map-wrap" id="compMapWrap">
      <div class="comp-map-head">
        <strong>Market map</strong>
        <div class="comp-map-legend" id="mapKindFilters" data-map-filters="1">
          <span class="static"><i class="you"></i> Your home</span>
          <span class="static"><i class="comp"></i> Selected comps</span>
          <button type="button" class="map-kind on" data-kind="sold"><i class="sold"></i> Sold <b id="mapCountSold"></b></button>
          <button type="button" class="map-kind on" data-kind="active"><i class="active"></i> Active <b id="mapCountActive"></b></button>
          <button type="button" class="map-kind on" data-kind="uc"><i class="uc"></i> Under contract <b id="mapCountUc"></b></button>
          <button type="button" class="map-kind" data-kind="off"><i class="off"></i> Off-market <b id="mapCountOff"></b></button>
        </div>
      </div>
      <div id="compMap" role="img" aria-label="Map of comps and market listings"></div>
      <div class="comp-map-foot">Hover a pin for a quick peek. Click a sold home to add or remove it as a comp.</div>
    </div>
    <button type="button" class="comp-table-toggle" id="btnCompTable">Show table view</button>
    <div class="comp-table-wrap" id="compTableWrap">
      <div style="overflow:auto">
        <table><thead><tr><th>Address</th><th>Sold</th><th>Price</th><th>SqFt</th><th>Bd/Ba</th><th>Year</th><th>Gar</th><th>DOM</th><th>$/SF</th></tr></thead>
        <tbody id="compTableBody">{comps_rows or '<tr><td colspan="9">No close comps</td></tr>'}</tbody></table>
      </div>
    </div>
  </section>

  <section class="section print-only" id="spine-comps-more" {'hidden' if not comps_print_more else ''}>
    <h2><span class="ttl"><span class="step">3</span>Closest Comparable Sales · continued</span></h2>
    <p class="sub">Remaining close sales in this set — same ranking as the live presentation.</p>
    <div class="comp-rail">{comps_print_more}</div>
  </section>

  <section class="section" id="spine-rating">
    <h2><span class="ttl"><span class="step">4</span>How Does Your Home Compare?</span></h2>
    <p class="sub" data-lede="condition">{lede_condition}</p>
    <div class="rate-bands" id="rateBands">
      <button type="button" class="rate-band" data-rating="3"><div class="rb-t">Needs Work</div><div class="rb-r">1 – 3</div><div class="rb-d">Dated finishes, deferred maintenance, or weak curb appeal vs comps.</div></button>
      <button type="button" class="rate-band" data-rating="5"><div class="rb-t">Average</div><div class="rb-r">4 – 6</div><div class="rb-d">In line with recent sales — nothing special, nothing broken.</div></button>
      <button type="button" class="rate-band" data-rating="7"><div class="rb-t">Strong</div><div class="rb-r">7 – 8</div><div class="rb-d">Updated kitchen/baths, clean presentation — buyers notice.</div></button>
      <button type="button" class="rate-band" data-rating="9"><div class="rb-t">Exceptional</div><div class="rb-r">9 – 10</div><div class="rb-d">Top of the set — turnkey, premium finishes, stands out.</div></button>
    </div>
    <div class="rate-row" id="rateRow">{rating_buttons}</div>
    <div class="rate-live">
      <div class="rl"><div class="lbl">Condition vs typical</div><div class="amt" id="rateLivePrice">—</div></div>
      <div class="rs"><div class="lbl">Your rating</div><div class="amt" id="rateLiveScore">{home_rating}/10</div></div>
    </div>
    <p class="sub" id="ratingCopy" style="margin-top:8px">Starting at <strong>5/10</strong> (typical for this set). Adjust together — list dollars unlock in <strong>Price it</strong>.</p>
  </section>

  <section class="section" id="spine-position">
    <p class="section-kicker">Step 5 · Where you sit</p>
    <h2><span class="ttl"><span class="step">5</span>Your Home on the Price vs Sq Ft Map</span>
      <span class="controls" id="scatterRange">
        <button type="button" data-scatter-mo="3">3 mo</button>
        <button type="button" class="active" data-scatter-mo="6">6 mo</button>
        <button type="button" data-scatter-mo="0">All sales</button>
      </span>
    </h2>
    <p class="sub">Orange line = sold trend · Tap layers on/off · <span id="scatterCount">Recent sales</span></p>
    <div class="controls scatter-series" id="scatterSeries">
      <button type="button" class="active series-sold" data-scatter-series="Sold">Sold</button>
      <button type="button" class="active series-active" data-scatter-series="Active">Active</button>
      <button type="button" class="active series-home" data-scatter-series="Your Home">Your home</button>
    </div>
    <div class="chart-box scatter-tall"><canvas id="scatter"></canvas></div>
    <div class="story-note" id="topStmt">{top_stmt}</div>
  </section>

  <section class="section" id="spine-yoy">
    <p class="section-kicker">Step 6 · Market detail</p>
    <h2><span class="ttl"><span class="step">6</span>Pace — Is the Market Speeding Up or Slowing?</span></h2>
    <p class="sub">Year-over-year sales tell you whether demand is building or thinning in this exact segment.</p>
    <div class="kpis yoy-kpis" style="--yoy-cols:{yoy_n}">{yoy_kpi or '<div class="kpi"><div class="v">—</div><div class="l">Need dated sales</div></div>'}</div>
    <div class="md-panel">
      <div class="md-panel-head">
        <h3>Sales volume</h3>
        <span class="md-tag">Talking point</span>
      </div>
      <p class="md-talk">{insight_pace}</p>
      <div class="md-chart-grid">
        <div class="md-chart-block">
          <h4>Sales by year</h4>
          <div class="chart-box short"><canvas id="yoySales"></canvas></div>
        </div>
        <div class="md-chart-block">
          <h4>Same-month · last year vs this year</h4>
          <div class="chart-box short"><canvas id="yoyMonthly"></canvas></div>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="spine-prices">
    <p class="section-kicker">Step 6b · What buyers paid</p>
    <h2><span class="ttl">Prices — What the Market Is Actually Paying</span>
      <span class="controls" id="priceTrendToggle" style="{'display:none' if not monthly_price_bands.get('labels') else ''}">
        <button type="button" class="active" data-price-view="all">All sales</button>
        <button type="button" data-price-view="bands">Vs. your price line</button>
      </span>
    </h2>
    <p class="sub" id="priceTrendSub">Median sold price is the clearest signal of buyer willingness to pay in this set.</p>
    <div class="md-panel">
      <div class="md-panel-head">
        <h3>Price movement</h3>
        <span class="md-tag">Talking point</span>
      </div>
      <p class="md-talk">{insight_price}</p>
      <div class="md-chart-grid">
        <div class="md-chart-block">
          <h4>Median sold price by year</h4>
          <div class="chart-box short"><canvas id="yoyPrice"></canvas></div>
        </div>
        <div class="md-chart-block">
          <h4>Median sold price by month</h4>
          <div class="chart-box feature"><canvas id="priceTrend"></canvas></div>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="spine-timing">
    <p class="section-kicker">Step 6c · How long it takes</p>
    <h2><span class="ttl">Timing — Days on Market</span>
      <span class="controls">
        <button type="button" class="active" data-chart="dom" data-mode="dist">Distribution</button>
        <button type="button" data-chart="dom" data-mode="trend">By Month</button>
      </span>
    </h2>
    <p class="sub">Median: <strong>{(dom_dist.get("median") or median_dom):.0f} days</strong> — price with the market and this is the pace to expect.</p>
    <div class="md-panel">
      <div class="md-panel-head">
        <h3>Time to contract</h3>
        <span class="md-tag">Talking point</span>
      </div>
      <p class="md-talk">{insight_timing}</p>
      <div class="md-chart-grid">
        <div class="md-chart-block">
          <h4>Median DOM by year</h4>
          <div class="chart-box short"><canvas id="yoyDom"></canvas></div>
        </div>
        <div class="md-chart-block">
          <h4>Where sales land</h4>
          <div class="chart-box feature"><canvas id="domChart"></canvas></div>
        </div>
      </div>
      <div class="md-chart-grid solo" style="margin-top:12px">
        <div class="md-chart-block">
          <h4>Sales volume trend
            <span class="controls" style="float:right">
              <button type="button" class="active" data-chart="sales" data-mode="month">Month</button>
              <button type="button" data-chart="sales" data-mode="year">Year</button>
            </span>
          </h4>
          <div class="chart-box short"><canvas id="salesTrend"></canvas></div>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="split">
      <div><h2 style="border:none;margin:0 0 6px;font-size:.9rem">Advantages</h2><ul id="advList">{''.join(f'<li>{a}</li>' for a in advantages)}</ul></div>
      <div><h2 style="border:none;margin:0 0 6px;font-size:.9rem">Watch-Outs</h2><ul id="riskList">{''.join(f'<li>{r}</li>' for r in risks)}</ul></div>
    </div>
  </section>

  <section class="section" id="spine-strategy">
    <h2><span class="ttl"><span class="step">7</span>Price It — Strategy &amp; Trade-Offs</span></h2>
    <p class="sub">Set the list with the slider — strategy cards snap you to a lane. Then see market positioning vs. what happens while you wait.</p>
    <section class="verdict" id="spine-verdict">
      <div class="eyebrow">Recommended List Price</div>
      <div class="big" id="dispRec">${rec:,.0f}</div>
      <div class="sub">Range <strong id="dispRange">${low:,.0f} – ${high:,.0f}</strong> · target under contract in ~<strong id="dispDom">{exp_dom:.0f} days</strong></div>
      <div class="top" id="topLine">Top <span id="topStat">{top_mkt:.0f}</span>% of similar recent sales</div>
      <div class="pos-bar"><div class="pos-marker" id="posMarker" style="left:50%"></div></div>
      <div class="pos-labels"><span>Aggressive</span><span>Heart of market</span><span>Overpriced</span></div>
    </section>
    <div class="bottom-line"><strong>Bottom Line</strong> — <span id="blText" data-edit="bl">{exec_sum}</span></div>

    <div class="price-controls">
      <div class="slider-wrap">
        <label class="muted" for="priceSlider">Price strategy slider — recommended stays marked</label>
        <div class="slider-track-wrap">
          <div class="rec-tick" id="recTick" style="left:50%" aria-hidden="true">
            <span class="rec-tick-label" id="recTickLabel">Rec</span>
            <span class="rec-tick-line"></span>
          </div>
          <input type="range" id="priceSlider" min="0" max="100" value="50" step="1" aria-valuetext="Recommended">
        </div>
        <div class="slider-scale"><span id="slideMin">—</span><span id="slideMid">Recommended</span><span id="slideMax">—</span></div>
      </div>
      <div class="whatif-grid" id="whatIfGrid" style="--whatif-cols:{whatif_n}">{whatif_cards or '<p class="muted">No price scenarios</p>'}</div>
      <input type="hidden" id="sellerPrice" value="{int(rec)}">
    </div>

    <div class="response-grid">
      <div class="confront-out" id="confrontOut">Pick a price above to see the market response.</div>
      <div class="wyw" id="wywModule" style="{'display:none' if not show_listing_flow else ''}">
        <div class="wyw-head">
          <span class="wyw-title">While You Wait</span>
          <span class="wyw-sub">Cheaper competition while you sit</span>
        </div>
        <p class="wyw-lede">Buyers shop value first. Raise the list — more homes sit under you, and more keep listing under you while you wait.</p>
        <div class="wyw-grid">
          <div class="wyw-cell" title="Similar Active homes priced under your list right now.">
            <div class="wv" id="wywAhead">{lf_active_below}</div>
            <div class="wl">Already cheaper<span class="wyw-tip" aria-hidden="true">?</span></div>
          </div>
          <div class="wyw-cell" title="Average new similar listings per month that come on under your price (last ~6 months).">
            <div class="wv" id="wywArrive">~{lf_below_pm:.1f}/mo</div>
            <div class="wl">New under you<span class="wyw-tip" aria-hidden="true">?</span></div>
          </div>
          <div class="wyw-cell hot" title="Already cheaper Actives plus new cheaper listings expected during your days-to-contract. Buyer attention diverted — not a closed-sales count.">
            <div class="wv" id="wywTotal">~{lf_wait_fresh + lf_active_below:.0f}</div>
            <div class="wl">In your wait<span class="wyw-tip" aria-hidden="true">?</span></div>
          </div>
        </div>
        <div class="wyw-bar-wrap">
          <div class="wyw-bar-label"><span>At <span id="wywPrice">{int(rec):,}</span></span><span id="wywDom">~{exp_dom:.0f} days to contract</span></div>
          <div class="wyw-bar"><div class="fill" id="wywFill" style="width:35%"></div><div class="marker" id="wywMarker" style="left:35%"></div></div>
        </div>
        <p class="wyw-note" id="wywNote">At the recommended list, the queue works <b>for</b> you. Price above it and buyer attention shifts to cheaper options.</p>
      </div>
    </div>
  </section>

  <section class="section" id="spine-net">
    <h2><span class="ttl"><span class="step">8</span>Net Sheet — What You Walk Away With</span></h2>
    <p class="sub">Estimated proceeds at the price on the slider — move it and this sheet updates. Tap any line to adjust to your situation. Estimates only, not a closing statement.</p>
    <div class="net-grid">
      <div class="net-lines" id="netLines">
        <div class="net-subhead">Selling costs</div>
        <div class="net-row">
          <div class="nl">Seller broker fee</div>
          <div class="ni"><input type="number" id="netSellerFeePct" min="0" max="10" step="0.1" value="3"><span class="nu">%</span></div>
          <div class="nv" id="netSellerFeeVal">—</div>
        </div>
        <div class="net-row">
          <div class="nl">Buyer broker fee</div>
          <div class="ni"><input type="number" id="netBuyerFeePct" min="0" max="10" step="0.1" value="3"><span class="nu">%</span></div>
          <div class="nv" id="netBuyerFeeVal">—</div>
        </div>
        <div class="net-row">
          <div class="nl">Seller concession <small>credits offered to the buyer</small></div>
          <div class="ni"><input type="number" id="netConcession" min="0" step="100" value="0"><span class="nu">$</span></div>
          <div class="nv" id="netConcessionVal">—</div>
        </div>
        <div class="net-row">
          <div class="nl">Misc. — inspection repairs <small>standard allowance</small></div>
          <div class="ni"><input type="number" id="netRepairs" min="0" step="100" value="2000"><span class="nu">$</span></div>
          <div class="nv" id="netRepairsVal">—</div>
        </div>
        <div class="net-row net-subtotal">
          <div class="nl">Total selling costs</div>
          <div></div>
          <div class="nv" id="netSellingVal">—</div>
        </div>
        <div class="net-subhead">Closing expenses <span>· seller-paid</span></div>
        <div class="net-row">
          <div class="nl">Prop. taxes <small>auto · annual rate prorated to close</small></div>
          <div class="ni"><input type="number" id="netTaxRate" min="0" max="5" step="0.01" value="0.76"><span class="nu">%</span></div>
          <div class="nv" id="netTaxVal">—</div>
        </div>
        <div class="net-row">
          <div class="nl">Closing date <small>drives the tax proration</small></div>
          <div class="ni"><input type="date" id="netCloseDate"></div>
          <div class="nv nv-days" id="netCloseDays">—</div>
        </div>
        <div class="net-row">
          <div class="nl">Owner's title policy <small id="netTitleTag">auto · ≈0.15% of price</small></div>
          <div class="ni"><input type="number" id="netTitle" min="0" step="50" value="0" data-auto="1"><span class="nu">$</span></div>
          <div class="nv" id="netTitleVal">—</div>
        </div>
        <div class="net-row">
          <div class="nl">Owner's extended coverage</div>
          <div class="ni"><input type="number" id="netOec" min="0" step="10" value="150"><span class="nu">$</span></div>
          <div class="nv" id="netOecVal">—</div>
        </div>
        <div class="net-row">
          <div class="nl">Bundled closing fees</div>
          <div class="ni"><input type="number" id="netBundled" min="0" step="10" value="190"><span class="nu">$</span></div>
          <div class="nv" id="netBundledVal">—</div>
        </div>
        <div class="net-row">
          <div class="nl">Final water <small>final utility reading</small></div>
          <div class="ni"><input type="number" id="netWater" min="0" step="10" value="200"><span class="nu">$</span></div>
          <div class="nv" id="netWaterVal">—</div>
        </div>
        <div class="net-row net-subtotal">
          <div class="nl">Total closing expenses</div>
          <div></div>
          <div class="nv" id="netClosingVal">—</div>
        </div>
        <div class="net-subhead">Mortgage payoff</div>
        <div class="net-row">
          <div class="nl">Seller loan balance <small>current mortgage payoff — not a selling cost</small></div>
          <div class="ni"><input type="number" id="netPayoff" min="0" step="500" value="0"><span class="nu">$</span></div>
          <div class="nv" id="netPayoffVal">—</div>
        </div>
        <div class="net-row net-total">
          <div class="nl">Total deductions <small>selling + closing + payoff</small></div>
          <div></div>
          <div class="nv" id="netCostsVal">—</div>
        </div>
      </div>
      <div class="net-summary">
        <div class="ns-eyebrow">Estimated net to seller</div>
        <div class="ns-big" id="netBig">—</div>
        <div class="ns-sub">at <strong id="netPrice">—</strong> · <span id="netPct">—</span> of list</div>
        <div class="ns-bar"><div class="ns-fill" id="netFill"></div></div>
        <div class="ns-deductions" id="netDeductNote">—</div>
        <div class="ns-note" id="netRecNote">—</div>
        <div class="ns-fine">Estimates only — your closer issues the official figures. Loan balance, concessions, and fees change this the most.</div>
      </div>
    </div>
  </section>

  <section class="section" id="spine-fulldata">
    <div class="fulldata-head" id="fulldataHead" role="button" tabindex="0" aria-expanded="true" aria-controls="fulldataBody">
      <div>
        <h2>Full Market Data <span class="muted" id="includeCount"></span></h2>
        <p class="sub fulldata-sub">Every home in this market · Active = competition · Pending/Backup = under contract · Dark <strong>In comps</strong> buttons are selected — click to remove · Sort by Comp to pull used rows to the top</p>
      </div>
      <button type="button" class="fulldata-toggle" id="btnToggleFulldata" aria-expanded="true">Collapse</button>
    </div>
    <div class="fulldata-body" id="fulldataBody">
      <div class="data-toolbar data-search-bar">
        <div class="search-wrap">
          <input type="search" id="dataSearch" placeholder="Search MLS #, address, subdivision, city… (comma for multiple MLS)" autocomplete="off">
          <button type="button" class="search-clear" id="btnClearSearch" style="display:none">Clear</button>
        </div>
        <select id="statusFilter" title="Status">
          <option value="">All statuses</option>
          <option>Sold</option><option>Active</option><option>Pending</option><option>Backup</option><option>Expired</option><option>Withdrawn</option>
        </select>
        <select id="bedsFilter" title="Beds">
          <option value="">Any beds</option>
          <option value="2">2+ beds</option>
          <option value="3">3+ beds</option>
          <option value="4">4+ beds</option>
          <option value="5">5+ beds</option>
        </select>
        <select id="garageFilter" title="Garage">
          <option value="">Any garage</option>
          <option value="1">1+ car</option>
          <option value="2">2+ car</option>
          <option value="3">3+ car</option>
        </select>
        <input type="number" class="price-filter" id="priceMin" placeholder="Min $" min="0" step="1000">
        <input type="number" class="price-filter" id="priceMax" placeholder="Max $" min="0" step="1000">
        <button type="button" class="tb-btn" id="btnSortUsed" title="Bring selected comps to the top">Used comps first</button>
        <button type="button" class="tb-btn" id="btnCols">Columns</button>
        <button type="button" class="tb-btn" id="checkAll">All on</button>
        <button type="button" class="tb-btn" id="checkNone">All off</button>
      </div>
      <p class="data-hint" id="dataHint">Tip: paste one or more MLS numbers separated by commas or spaces.</p>
      <div class="col-picker" id="colPicker"><div class="col-picker-grid" id="colGrid">{col_checks}</div></div>
      <div class="data-wrap"><table><thead><tr id="dataHead"></tr></thead><tbody id="dataBody"></tbody></table></div>
    </div>
  </section>

  <footer><strong>ListLogic</strong> — the pricing story, told by the data · Active = available · Under Contract = Pending + Backup · Months of inventory uses Active only · {generated}</footer>
</div>
</div>

<div class="sections-modal" id="sectionsModal" hidden>
  <div class="sm-backdrop" id="sectionsBackdrop"></div>
  <div class="sm-card" role="dialog" aria-label="Report sections">
    <div class="sm-head">
      <strong>Report sections</strong>
      <button type="button" id="closeSections" aria-label="Close">×</button>
    </div>
    <p class="sm-lead">All sections are included by default. Uncheck any you want to hide on this presentation (and in print).</p>
    <div class="sm-list" id="sectionsList">
      <label><input type="checkbox" data-section="spine-corefacts" checked> How It Works</label>
      <label><input type="checkbox" data-section="spine-market" checked> 1 · Market</label>
      <label><input type="checkbox" data-section="spine-supply" checked> 2 · Supply</label>
      <label><input type="checkbox" data-section="spine-comps" checked> 3 · Comps</label>
      <label><input type="checkbox" data-section="spine-rating" checked> 4 · Your Home</label>
      <label><input type="checkbox" data-section="spine-position" checked> 5 · Position</label>
      <label><input type="checkbox" data-section="spine-yoy" checked> 6 · Pace</label>
      <label><input type="checkbox" data-section="spine-prices" checked> 6b · Prices</label>
      <label><input type="checkbox" data-section="spine-timing" checked> 6c · Timing</label>
      <label><input type="checkbox" data-section="spine-strategy" checked> 7 · Price It</label>
      <label><input type="checkbox" data-section="spine-net" checked> 8 · Net Sheet</label>
      <label><input type="checkbox" data-section="spine-fulldata" checked> Full Market Data</label>
    </div>
    <button type="button" class="sm-reset" id="btnResetSections">Include all sections</button>
  </div>
</div>
<div class="panel-overlay" id="overlay"></div>
<aside class="agent-panel" id="panel" role="dialog" aria-label="Agent tools">
  <div class="panel-header">
    <div class="ph-who">
      <span class="ph-avatar">{agent_initials}</span>
      <div class="ph-copy"><strong>{agent_name_only}</strong><span>Edit this report</span></div>
    </div>
    <button type="button" id="closePanel" aria-label="Close">×</button>
  </div>
  <div class="panel-tabs" role="tablist" aria-label="Tool sections">
    <button type="button" class="panel-tab active" data-pane="price" role="tab" aria-selected="true">Price</button>
    <button type="button" class="panel-tab" data-pane="story" role="tab" aria-selected="false">Story</button>
    <button type="button" class="panel-tab" data-pane="coach" role="tab" aria-selected="false">Coach</button>
    <button type="button" class="panel-tab" data-pane="media" role="tab" aria-selected="false">Photos</button>
  </div>
  <div class="panel-body">
    <div class="panel-pane active" id="pane-price" role="tabpanel">
      <p class="pane-lead">Override the model list when you need to — updates the verdict, what-if math, and the supply-stream value line.</p>
      <div class="field-grid">
        <div class="field span2">
          <label for="editRec">Recommended list ($)</label>
          <input type="number" id="editRec" value="{rec}" step="1000">
        </div>
        <div class="field">
          <label for="editLow">Range low ($)</label>
          <input type="number" id="editLow" value="{low}" step="1000">
        </div>
        <div class="field">
          <label for="editHigh">Range high ($)</label>
          <input type="number" id="editHigh" value="{high}" step="1000">
        </div>
        <div class="field span2">
          <label for="editDom">Expected days to contract</label>
          <input type="number" id="editDom" value="{exp_dom}" step="1">
        </div>
      </div>
    </div>
    <div class="panel-pane" id="pane-story" role="tabpanel">
      <span class="panel-pill">Seller-facing</span>
      <p class="pane-lead">Bottom line, advantages, and watch-outs show in Price it. Use <strong>Print leave-behind</strong> for a page-per-section print of this Live Story.</p>
      <div class="field">
        <label for="editBL">Bottom line</label>
        <textarea id="editBL" class="tall">{exec_sum}</textarea>
      </div>
      <div class="field">
        <label for="editAdv">Advantages (one per line)</label>
        <textarea id="editAdv">{adv_text}</textarea>
      </div>
      <div class="field">
        <label for="editRisk">Watch-outs (one per line)</label>
        <textarea id="editRisk">{risk_text}</textarea>
      </div>
      <div class="field">
        <label for="editLedeComps">Comps intro</label>
        <textarea id="editLedeComps">{lede_comps}</textarea>
      </div>
      <div class="field">
        <label for="editLedeCondition">Condition intro</label>
        <textarea id="editLedeCondition">{lede_condition}</textarea>
      </div>
      <div class="field">
        <label for="editLedeClose">Close line</label>
        <textarea id="editLedeClose">{lede_close}</textarea>
      </div>
      <div class="field">
        <label for="editExtraAdv">Always-include advantages (one per line)</label>
        <textarea id="editExtraAdv" placeholder="Shows on every future report"></textarea>
      </div>
      <div class="field">
        <label for="editExtraRisk">Always-include watch-outs (one per line)</label>
        <textarea id="editExtraRisk" placeholder="Shows on every future report"></textarea>
      </div>
      <p class="pane-lead">Save as my default wording stores intros, always-include bullets, and coach notes — not this listing’s bottom line or price.</p>
      <div class="panel-soft" id="aiSellerRow" style="display:none">
        <button type="button" class="btn-soft" id="btnAiSeller">Rewrite story</button>
      </div>
      <div class="panel-soft">
        <button type="button" class="btn-soft" id="btnSaveDefaults">Save as my default wording</button>
        <button type="button" class="btn-soft" id="btnResetDefaults">Reset my default wording</button>
      </div>
      <div class="panel-toast" id="storyToast" role="status"></div>
    </div>
    <div class="panel-pane" id="pane-coach" role="tabpanel">
      <span class="panel-pill private">Private</span>
      <p class="pane-lead">Talk tracks for you at the table — never shown on the seller deck.</p>
      <div class="field">
        <label for="editObj">Title|Body per line</label>
        <textarea id="editObj" class="tall" placeholder="Inventory pressure|Buyers choose among…">{obj_text}</textarea>
      </div>
      <div class="panel-soft" id="aiCoachRow" style="display:none">
        <button type="button" class="btn-soft" id="btnAiCoach">Rewrite notes</button>
      </div>
      <div class="panel-toast" id="coachToast" role="status"></div>
    </div>
    <div class="panel-pane" id="pane-media" role="tabpanel">
      <p class="pane-lead">Subject photo for the comps rail. Comp photos can also be set from each card.</p>
      <div class="field">
        <label for="editSubjectPhoto">Your home photo URL</label>
        <input type="url" id="editSubjectPhoto" placeholder="https://…" autocomplete="off">
      </div>
      <div class="panel-soft">
        <button type="button" class="btn-soft primary" id="btnSaveSubjectPhoto">Save photo</button>
        <label class="btn-soft" style="display:inline-flex;align-items:center;justify-content:center;cursor:pointer;margin:0">Upload<input type="file" id="subjectPhotoFile" accept="image/jpeg,image/png,image/webp,image/gif" style="display:none"></label>
      </div>
      <div class="panel-meta" style="margin-top:14px">
        <span>Excluded market rows</span>
        <strong id="exclCount">0</strong>
      </div>
      <p class="pane-lead" style="margin:8px 0 0">Exclude oddballs from Full Market Data below. Comp picks live in Closest comps.</p>
    </div>
  </div>
  <div class="panel-actions">
    <button type="button" class="btn-reset" id="btnReset">Reset this listing</button>
    <button type="button" class="btn-apply" id="btnApply">Apply</button>
  </div>
</aside>

<div class="listing-overlay" id="listingOverlay"></div>
<aside class="listing-drawer" id="listingDrawer" role="dialog" aria-modal="true" aria-label="Compare listing">
  <div class="ld-head">
    <strong id="ldTitle">Compare listing</strong>
    <div class="ld-head-actions">
      <a id="btnOpenZillow" href="#" target="_blank" rel="noopener">Open on Zillow</a>
      <a id="btnOpenRealtor" href="#" target="_blank" rel="noopener">Realtor.com</a>
      <button type="button" id="closeListing">Close</button>
    </div>
  </div>
  <div class="ld-body" id="listingBody"></div>
</aside>

<div class="photo-modal" id="photoModal" aria-hidden="true">
  <div class="pm-backdrop" id="photoModalBackdrop"></div>
  <div class="pm-card">
    <h3 id="photoModalTitle">Add listing photo</h3>
    <p>From Matrix: open the listing → right-click the main photo → Copy image address. Or upload a photo you saved from MLS.</p>
    <input type="url" id="photoUrlInput" placeholder="https://… listing photo URL" autocomplete="off">
    <div class="pm-actions">
      <button type="button" class="primary" id="btnSavePhotoUrl">Save photo URL</button>
      <label class="primary">Upload photo<input type="file" id="photoFileInput" accept="image/jpeg,image/png,image/webp,image/gif"></label>
      <a id="photoOpenListing" href="#" target="_blank" rel="noopener" style="text-decoration:none;padding:9px 12px;border-radius:10px;font-size:.78rem;font-weight:700;border:1px solid var(--border);background:#f8fafc;color:var(--brand-primary)">Open listing</a>
      <button type="button" id="btnClearPhoto">Clear</button>
      <button type="button" id="btnClosePhotoModal">Cancel</button>
    </div>
  </div>
</div>

<script>
const DATA = {json.dumps(payload, allow_nan=False)};
const TABLE = {json.dumps(full_table, allow_nan=False)};
const MAPBOX_TOKEN = {json.dumps(_mapbox_token())};
const DEFAULT_COLS = {json.dumps(default_cols)};
const defaults = {json.dumps(defaults, allow_nan=False)};
const RUN_ID = (location.pathname.match(/\\/runs\\/([^\\/]+)/)||[])[1] || '';
const LINK_CITY = DATA.linkCity, LINK_STATE = DATA.linkState;
const navy = '{brand_primary}', orange = '#c2410c';

(function setupPresentationRow() {{
  const pdf = document.getElementById('pdfLink');
  const story = document.getElementById('storyPdfLink');
  const deck = document.getElementById('deckLink');
  const copyBtn = document.getElementById('btnCopyShare');
  const printBtn = document.getElementById('btnPrintLeavebehind');

  function eachChart(fn) {{
    if (typeof Chart === 'undefined') return;
    document.querySelectorAll('.chart-box canvas').forEach(canvas => {{
      try {{
        const ch = (typeof Chart.getChart === 'function') ? Chart.getChart(canvas) : null;
        if (ch) fn(ch);
      }} catch (e) {{}}
    }});
  }}

  function wakeHiddenCharts() {{
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
    eachChart(ch => {{
      try {{
        if (ch.options) ch.options.animation = false;
        if (ch.update) ch.update('none');
        if (ch.resize) ch.resize();
      }} catch (e) {{}}
    }});
  }}

  function snapshotChartsForPrint() {{
    document.querySelectorAll('.chart-box canvas').forEach(canvas => {{
      try {{
        if (!canvas.width || !canvas.height) return;
        const data = canvas.toDataURL('image/png');
        if (!data || data.length < 800) return;
        const parent = canvas.parentNode;
        if (!parent) return;
        let img = parent.querySelector('img.print-chart');
        if (!img) {{
          img = document.createElement('img');
          img.className = 'print-chart';
          img.alt = '';
          parent.appendChild(img);
        }}
        img.src = data;
      }} catch (e) {{}}
    }});
  }}

  function restoreChartsAfterPrint() {{
    document.body.classList.remove('print-leavebehind');
    eachChart(ch => {{ try {{ if (ch.resize) ch.resize(); }} catch (e) {{}} }});
  }}

  function printLeavebehind() {{
    document.body.classList.add('print-leavebehind');
    const st = document.getElementById('shareStatus');
    if (st) st.textContent = 'Printing Live Story…';
    wakeHiddenCharts();
    requestAnimationFrame(() => {{
      requestAnimationFrame(() => {{
        wakeHiddenCharts();
        setTimeout(() => {{
          snapshotChartsForPrint();
          setTimeout(() => window.print(), 80);
        }}, 240);
      }});
    }});
  }}

  if (printBtn) printBtn.onclick = printLeavebehind;
  window.addEventListener('beforeprint', () => {{
    document.body.classList.add('print-leavebehind');
    wakeHiddenCharts();
    snapshotChartsForPrint();
  }});
  window.addEventListener('afterprint', restoreChartsAfterPrint);

  if (RUN_ID) {{
    if (pdf) pdf.style.display = 'none';
    if (story) story.style.display = 'none';
    if (deck) {{ deck.href = '/runs/' + RUN_ID + '/deck.html'; deck.style.display = ''; }}
    if (copyBtn) {{
      copyBtn.style.display = '';
      copyBtn.onclick = async () => {{
        let url = location.origin + '/runs/' + RUN_ID + '/';
        try {{
          const metaRes = await fetch('/api/runs/' + RUN_ID + '/share');
          if (metaRes.ok) {{
            const meta = await metaRes.json();
            if (meta.share_url) url = location.origin + meta.share_url;
          }}
        }} catch (e) {{}}
        try {{
          await navigator.clipboard.writeText(url);
          const st = document.getElementById('shareStatus');
          if (st) st.textContent = 'Link copied — send to your client';
        }} catch (e) {{
          const st = document.getElementById('shareStatus');
          if (st) st.textContent = url;
        }}
      }};
    }}
  }} else {{
    if (pdf) pdf.style.display = 'none';
    if (story) story.style.display = 'none';
    if (deck) {{ deck.href = 'deck.html'; deck.style.display = ''; }}
  }}

  // Deep-link: ?print=1 opens print dialog for leave-behind
  try {{
    const params = new URLSearchParams(location.search);
    if (params.get('print') === '1' || location.hash === '#print') {{
      setTimeout(printLeavebehind, 600);
    }}
  }} catch (e) {{}}
}})();

if (RUN_ID) {{
  const showToast = (el, msg, kind) => {{
    if (!el) return;
    el.textContent = msg;
    el.className = 'panel-toast show' + (kind ? ' ' + kind : '');
  }};
  const aiSeller = document.getElementById('btnAiSeller');
  const aiCoach = document.getElementById('btnAiCoach');
  const aiSellerRow = document.getElementById('aiSellerRow');
  const aiCoachRow = document.getElementById('aiCoachRow');
  const storyToast = document.getElementById('storyToast');
  const coachToast = document.getElementById('coachToast');
  if (aiSellerRow) aiSellerRow.style.display = 'flex';
  if (aiCoachRow) aiCoachRow.style.display = 'flex';
  if (aiSeller) {{
    aiSeller.onclick = async () => {{
      aiSeller.disabled = true;
      showToast(storyToast, 'Rewriting story…', 'busy');
      try {{
        const res = await fetch('/api/runs/' + RUN_ID + '/ai-seller-story', {{ method: 'POST' }});
        const data = await res.json().catch(() => ({{}}));
        if (!res.ok) throw new Error(data.detail || data.message || ('HTTP ' + res.status));
        if (data.bl) document.getElementById('editBL').value = data.bl;
        if (data.adv) document.getElementById('editAdv').value = data.adv;
        if (data.risk) document.getElementById('editRisk').value = data.risk;
        applyEdits();
        showToast(storyToast, data.llm_enhanced ? 'Story updated.' : 'Could not rewrite — kept your text.', data.llm_enhanced ? '' : 'err');
      }} catch (err) {{
        showToast(storyToast, String(err.message || err), 'err');
      }} finally {{
        aiSeller.disabled = false;
      }}
    }};
  }}
  if (aiCoach) {{
    aiCoach.onclick = async () => {{
      aiCoach.disabled = true;
      showToast(coachToast, 'Rewriting notes…', 'busy');
      try {{
        const res = await fetch('/api/runs/' + RUN_ID + '/ai-coach', {{ method: 'POST' }});
        const data = await res.json().catch(() => ({{}}));
        if (!res.ok) throw new Error(data.detail || data.message || ('HTTP ' + res.status));
        if (data.obj) document.getElementById('editObj').value = data.obj;
        applyEdits();
        showToast(coachToast, data.llm_enhanced ? 'Notes updated.' : 'Could not rewrite — kept your notes.', data.llm_enhanced ? '' : 'err');
      }} catch (err) {{
        showToast(coachToast, String(err.message || err), 'err');
      }} finally {{
        aiCoach.disabled = false;
      }}
    }};
  }}
}}

document.querySelectorAll('.panel-tab').forEach(tab => {{
  tab.addEventListener('click', () => {{
    const pane = tab.dataset.pane;
    document.querySelectorAll('.panel-tab').forEach(t => {{
      t.classList.toggle('active', t === tab);
      t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
    }});
    document.querySelectorAll('.panel-pane').forEach(p => {{
      p.classList.toggle('active', p.id === 'pane-' + pane);
    }});
  }});
}});

const ratingMult = {{1:0.90,2:0.92,3:0.94,4:0.96,5:0.98,6:1.00,7:1.025,8:1.045,9:1.07,10:1.09}};
const RATING_TYPICAL = 5;
function ratingVsTypicalPct(r) {{
  const pct = ((ratingMult[r] || 1) / (ratingMult[RATING_TYPICAL] || 1) - 1) * 100;
  if (Math.abs(pct) < 0.05) return '0%';
  return (pct >= 0 ? '+' : '\\u2212') + Math.abs(pct).toFixed(1) + '%';
}}
function money(n) {{ return '$' + Math.round(Number(n)).toLocaleString('en-US'); }}
function topPct(price) {{
  const prices = DATA.soldPrices || [];
  if (!prices.length) return Math.round(DATA.topMkt || 50);
  const below = prices.filter(p => p < price).length;
  return Math.max(1, Math.round(100 - 100 * below / prices.length));
}}
function estimateAtPrice(rec, price, medianDom, baseOdds, inv) {{
  if (!rec) rec = price || 1;
  const lf = DATA.listingFlow || {{}};
  const pr = DATA.priceResponse || {{}};
  const delta = (price - rec) / rec;
  const pressure = lf.supplyPressure || 1;
  const actives = (pr.active_prices || pr.activePrices || []);
  const salesPm = +(pr.band_sales_pm || pr.bandSalesPm || lf.salesPm || 0.15);
  const baseDom = +(pr.base_dom || pr.baseDom || medianDom || 45);
  const oddsBase = +(pr.base_odds || pr.baseOdds || baseOdds || 0.35);
  const sqft = +(lf.subjectSqft || 0);
  let expectedDom, odds, freshBelow = 0, method = pr.method || 'heuristic';

  function newBelowPm(listPrice) {{
    const samples = lf.samples || [];
    if (!samples.length) return +(lf.newBelowRecPm || 0);
    const counts = {{}};
    samples.forEach(row => {{
      const p = +row.p || 0, s = +row.s || 0, m = row.m;
      if (!p || !m) return;
      if (sqft && s && (s < sqft * 0.8 || s > sqft * 1.2)) return;
      if (p < listPrice) counts[m] = (counts[m] || 0) + 1;
    }});
    const months = Object.keys(counts).sort().slice(-6);
    if (!months.length) return 0;
    return months.reduce((a, m) => a + counts[m], 0) / months.length;
  }}
  function effectiveQueue(posNow, sales, arrivePm) {{
    const cutIn = Math.min(0.85, Math.max(0, arrivePm) / Math.max(sales, 0.15));
    const posEff = Math.max(posNow, 1) / Math.max(1 - cutIn, 0.15);
    const months = posEff / Math.max(sales, 0.15);
    return {{ posEff, fresh: arrivePm * months }};
  }}

  if (actives.length && method !== 'heuristic') {{
    const queuePos = (p) => {{
      let below = 0, near = 0;
      for (const a of actives) {{
        if (a < p * 0.995) below++;
        else if (Math.abs(a - p) / Math.max(p, 1) <= 0.005) near++;
      }}
      return 1 + below + 0.5 * near;
    }};
    const arrivePm = newBelowPm(price);
    const arrivePmRec = newBelowPm(rec);
    const q = effectiveQueue(queuePos(price), salesPm, arrivePm);
    const qRec = effectiveQueue(queuePos(rec), salesPm, arrivePmRec);
    const rawDom = 30.44 * q.posEff / Math.max(salesPm, 0.15);
    const recRaw = 30.44 * qRec.posEff / Math.max(salesPm, 0.15);
    const scale = baseDom / Math.max(recRaw, 1);
    let queueDom = rawDom * scale;
    const rawOdds = Math.min(0.95, salesPm / Math.max(q.posEff + salesPm * 0.35, 0.15));
    const recOddsRaw = Math.min(0.95, salesPm / Math.max(qRec.posEff + salesPm * 0.35, 0.15));
    let queueOdds = Math.min(0.92, Math.max(0.03, rawOdds * (oddsBase / Math.max(recOddsRaw, 0.02))));
    freshBelow = q.fresh;

    const knots = pr.empirical_knots || pr.empiricalKnots || [];
    const w = +(pr.empirical_weight || pr.empiricalWeight || 0);
    const interpEmp = (d) => {{
      if (!knots.length) return queueDom;
      const xs = knots.map(k => +k.delta), ys = knots.map(k => +k.dom);
      if (d <= xs[0]) return ys[0];
      if (d >= xs[xs.length - 1]) return ys[ys.length - 1] * (1 + Math.max(0, d - xs[xs.length - 1]) * 2.5);
      for (let i = 0; i < xs.length - 1; i++) {{
        if (xs[i] <= d && d <= xs[i + 1]) {{
          const t = (d - xs[i]) / Math.max(xs[i + 1] - xs[i], 1e-9);
          return ys[i] + t * (ys[i + 1] - ys[i]);
        }}
      }}
      return queueDom;
    }};
    if (w > 0 && knots.length) {{
      const emp = interpEmp(delta);
      const emp0 = interpEmp(0);
      expectedDom = (1 - w) * queueDom + w * (emp * (baseDom / Math.max(emp0, 1)));
    }} else {{
      expectedDom = queueDom;
    }}
    if (inv > 6.5 && delta > 0.02) {{ expectedDom *= 1.08; queueOdds *= 0.92; }}
    else if (inv < 2.5 && delta < 0) {{ expectedDom *= 0.92; queueOdds = Math.min(0.85, queueOdds * 1.08); }}
    odds = queueOdds;
    expectedDom = Math.max(10, Math.round(expectedDom));
  }} else {{
    let invFactor = 1;
    if (inv < 2.5) invFactor = 0.75;
    else if (inv < 4) invFactor = 0.90;
    else if (inv > 6.5) invFactor = 1.35;
    let domMult;
    const belowPm = +(lf.newBelowRecPm || 0);
    if (delta <= -0.04) domMult = 0.60;
    else if (delta <= 0) domMult = 0.80 + (delta + 0.04) * 5.0;
    else if (delta <= 0.03) domMult = 1.0 + delta * 5.0;
    else if (delta <= 0.08) domMult = 1.15 + (delta - 0.03) * 10.0;
    else domMult = 1.65 + (delta - 0.08) * 25.0;
    if (delta <= -0.04) odds = Math.min(0.75, oddsBase * 1.55);
    else if (delta <= 0.02) odds = oddsBase * (1.15 - delta * 3);
    else if (delta <= 0.08) odds = Math.max(0.05, oddsBase * (0.90 - (delta - 0.02) * 8.0));
    else odds = Math.max(0.02, oddsBase * (0.42 - (delta - 0.08) * 4.0));
    if (delta > 0.02 && pressure > 1) domMult *= 1 + Math.min(0.55, (pressure - 1) * 0.4 + delta * 1.0);
    if (delta > 0.03 && pressure > 0.9) odds *= Math.max(0.22, 1 - (delta - 0.02) * pressure * 1.6);
    expectedDom = Math.max(10, Math.round((medianDom || 45) * domMult * invFactor));
    if (belowPm > 0 && delta > 0) freshBelow = belowPm * (1 + Math.min(0.5, delta * 2)) * (expectedDom / 30.44);
  }}

  let position, tone;
  if (delta < -0.03) {{ position = 'Clearly under the current market — expect urgency'; tone = 'good'; }}
  else if (delta < 0.02) {{ position = 'In the heart of the market'; tone = 'good'; }}
  else if (delta < 0.06) {{ position = 'At the upper edge of supportable'; tone = 'warn'; }}
  else if (delta < 0.10) {{ position = 'Above recent sales — buyers will choose better value first'; tone = 'bad'; }}
  else {{ position = 'Priced as everyone else\\u2019s comp — helps other listings sell'; tone = 'bad'; }}
  return {{ expectedDom, odds, position, tone, deltaPct: Math.round(delta * 1000) / 10, freshBelow: Math.round(freshBelow * 10) / 10, method }};
}}

function refreshWhatIfMetrics(rec) {{
  if (!rec) rec = currentRec;
  document.querySelectorAll('.whatif-card').forEach(card => {{
    const price = +card.dataset.price;
    if (!price) return;
    const out = estimateAtPrice(rec, price, DATA.medianDom, DATA.marketOdds, DATA.inv);
    const meta = card.querySelector('.wf-meta');
    if (meta) meta.textContent = '~' + out.expectedDom + 'd · ' + Math.round(out.odds * 100) + '%';
  }});
}}

let currentRec = defaults.rec, currentLow = defaults.low, currentHigh = defaults.high, currentDom = defaults.dom, currentRating = 5;

function syncBottomLine(rec, low, high, dom) {{
  // Keep Bottom Line dollars locked to the live recommended list (rating/slider can change it).
  const inv = +(DATA.inv || 0);
  let climate = "a buyer's market";
  if (inv < 2.5) climate = "a strong seller's market";
  else if (inv < 4.5) climate = "a seller-favorable market";
  else if (inv < 7) climate = "a balanced market";
  const soldN = Math.round(+(DATA.soldCount || 0));
  const text =
    'This is ' + climate + ' with ' + inv.toFixed(1) + ' months of inventory. ' +
    'Based on ' + soldN + ' recent sales, your home is best positioned between ' +
    money(low) + ' and ' + money(high) + ', with a recommended list price of ' + money(rec) +
    '. At that level we would expect roughly ' + Math.round(dom) + ' days to contract. ' +
    'Launch inside the competitive range — that creates the strongest outcome.';
  const bl = document.getElementById('blText');
  if (bl) bl.textContent = text;
  const editBL = document.getElementById('editBL');
  if (editBL && !editBL.dataset.manual) editBL.value = text;
}}

function setVerdict(rec, low, high, dom) {{
  currentRec = rec; currentLow = low; currentHigh = high; currentDom = dom;
  const recEl = document.getElementById('dispRec');
  if (recEl) {{
    recEl.dataset.settled = '1';
    recEl.textContent = money(rec);
  }}
  const rangeEl = document.getElementById('dispRange');
  if (rangeEl) rangeEl.textContent = money(low) + ' – ' + money(high);
  const domEl = document.getElementById('dispDom');
  if (domEl) domEl.textContent = Math.round(dom) + ' days';
  const editRec = document.getElementById('editRec');
  if (editRec) editRec.value = rec;
  const editLow = document.getElementById('editLow');
  if (editLow) editLow.value = low;
  const editHigh = document.getElementById('editHigh');
  if (editHigh) editHigh.value = high;
  const editDom = document.getElementById('editDom');
  if (editDom) editDom.value = dom;
  syncBottomLine(rec, low, high, dom);
  const top = topPct(rec);
  const topStat = document.getElementById('topStat');
  if (topStat) topStat.textContent = top;
  const topStmt = document.getElementById('topStmt');
  if (topStmt) topStmt.textContent = 'At this list, you would be priced in the top ' + top + '% of recent similar sales.';
  const marker = document.getElementById('posMarker');
  if (marker) marker.style.left = 'calc(' + Math.min(98, Math.max(2, 100 - top)) + '% - 2px)';
  if (window._scatterChart && DATA.subject) {{
    const ds = window._scatterChart.data.datasets.find(d => d.label === 'Your Home');
    if (ds && ds.data[0]) {{ ds.data[0].y = rec; window._scatterChart.update(); }}
  }}
  updateSupplyAtPrice(rec);
  refreshWhatIfMetrics(rec);
}}

function supplyStatsAtPrice(price) {{
  const lf = DATA.listingFlow || {{}};
  const samples = lf.samples || [];
  const sqft = +lf.subjectSqft || 0;
  const dom = +lf.medianDomForWait || DATA.medianDom || 45;
  const inBand = (row) => !sqft || !row.s || (row.s >= sqft * 0.8 && row.s <= sqft * 1.2);
  if (!price || !samples.length) {{
    return {{
      belowPm: lf.newBelowRecPm || 0,
      activeBelow: lf.activeBelowRec || 0,
      waitFresh: lf.freshDuringMedianDom || 0,
      dom,
    }};
  }}
  const band = samples.filter(inBand);
  const below = band.filter(row => row.p < price);
  const byMonth = {{}};
  below.forEach(row => {{
    if (!row.m) return;
    byMonth[row.m] = (byMonth[row.m] || 0) + 1;
  }});
  const months = Object.keys(byMonth).sort();
  const recentMonths = months.slice(-6);
  const belowPm = recentMonths.length
    ? recentMonths.reduce((sum, m) => sum + byMonth[m], 0) / recentMonths.length
    : 0;
  const activeBelow = band.filter(row => row.a && row.p < price).length;
  const waitFresh = belowPm * (dom / 30.44);
  return {{ belowPm, activeBelow, waitFresh, dom }};
}}

function updateSupplyAtPrice(price) {{
  price = +price || currentRec || 0;
  if (!price) return;
  const lf = DATA.listingFlow || {{}};
  const stats = supplyStatsAtPrice(price);
  lf.newBelowRecPm = Math.round(stats.belowPm * 10) / 10;
  lf.activeBelowRec = stats.activeBelow;
  lf.freshDuringMedianDom = Math.round(stats.waitFresh * 10) / 10;
  lf.thresholdPrice = price;
  const linePrice = document.getElementById('supplyLinePrice');
  if (linePrice) linePrice.textContent = money(price);
  document.querySelectorAll('.supply-line-ref').forEach(el => {{ el.textContent = money(price); }});
  const belowPmEl = document.getElementById('supplyBelowPm');
  if (belowPmEl) belowPmEl.innerHTML = lf.newBelowRecPm.toFixed(1) + '<span style="font-size:.85rem;font-weight:700;color:var(--muted)"> / mo</span>';
  const activeEl = document.getElementById('supplyActiveBelow');
  if (activeEl) activeEl.textContent = String(lf.activeBelowRec);
  const waitEl = document.getElementById('supplyWaitFresh');
  if (waitEl) waitEl.textContent = '~' + lf.freshDuringMedianDom.toFixed(1);
  const insight = document.getElementById('flowInsight');
  if (insight) {{
    const base = lf.insight || '';
    const extra = lf.newBelowRecPm > 0
      ? (' Against a comp-supported value line of <b>' + money(price) + '</b>, about <b>' +
         lf.newBelowRecPm.toFixed(1) + '</b> similar new listings/month come in cheaper — with <b>' +
         lf.activeBelowRec + '</b> Active under that line right now.')
      : '';
    insight.innerHTML = base + extra;
  }}
}}

function renderConfront(price) {{
  price = +price || currentRec;
  const out = estimateAtPrice(currentRec, price, DATA.medianDom, DATA.marketOdds, DATA.inv);
  const top = topPct(price);
  const delta = price - currentRec;
  const deltaTxt = (delta >= 0 ? '+' : '\\u2212') + money(Math.abs(delta)).replace('$-','$') + ' vs recommended';
  const t = out.tone;
  const domBaseline = Math.round(DATA.medianDom || 45);
  const domNote = out.expectedDom > domBaseline * 1.5
    ? 'Market median is ' + domBaseline + ' days \\u2014 at this price, buyers absorb the better values first.'
    : 'Market median is ' + domBaseline + ' days to contract.';
  const lf = DATA.listingFlow || {{}};
  let supplyNote = '';
  if (out.deltaPct > 2 && lf.newBelowRecPm > 0) {{
    const fresh = out.freshBelow || (lf.newBelowRecPm * out.expectedDom / 30.44);
    supplyNote = 'While you wait ~' + out.expectedDom + ' days, expect about <strong>' +
      (Math.round(fresh * 10) / 10) + '</strong> new similar homes to list below your price ' +
      '(~' + lf.newBelowRecPm.toFixed(1) + '/month in this band).';
  }} else if (lf.newPm > 0) {{
    supplyNote = 'Supply stream: <strong>' + lf.newPm.toFixed(1) + '</strong> new listings/month vs ' +
      '<strong>' + lf.salesPm.toFixed(1) + '</strong> sales (pressure <strong>' +
      lf.supplyPressure.toFixed(2) + '\\u00d7</strong>).';
  }}
  document.getElementById('confrontOut').innerHTML =
    '<div class="wyw-head" style="margin-bottom:8px"><span class="wyw-title">Market Positioning</span><span class="wyw-sub">Where this list sits vs. similar sales</span></div>' +
    '<div class="co-position">' + money(price) + ' \\u00b7 ' + deltaTxt + '</div>' +
    '<div class="co-stats">' +
      '<div class="co-stat co-' + t + '"><div class="cv">Top ' + top + '%</div><div class="cl">of similar sales</div></div>' +
      '<div class="co-stat co-' + t + '"><div class="cv">~' + out.expectedDom + 'd</div><div class="cl">expected to contract</div></div>' +
      '<div class="co-stat co-' + t + '"><div class="cv">' + Math.round(out.odds * 100) + '%</div><div class="cl">odds in 30 days</div></div>' +
    '</div>' +
    '<div class="co-position" style="font-size:.84rem">' + out.position + '</div>' +
    '<div class="co-note">' + domNote + '</div>' +
    (supplyNote ? '<div class="co-note">' + supplyNote + '</div>' : '');
  renderWhileYouWait(price, out);
  renderNetSheet(price);
}}

function netAutoTitle(p) {{ return Math.max(0, Math.round(p * 0.0015 / 50) * 50); }}
function netTaxParts(price) {{
  const rate = Math.min(5, Math.max(0, parseFloat(document.getElementById('netTaxRate').value) || 0));
  const annual = price * rate / 100;
  const dateEl = document.getElementById('netCloseDate');
  if (dateEl && !dateEl.value) {{
    dateEl.value = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  }}
  const ds = dateEl ? dateEl.value : '';
  const close = ds ? new Date(ds + 'T12:00:00') : null;
  if (!close || isNaN(close)) return {{ amount: Math.round(annual / 12), days: 0, year: 0 }};
  const jan1 = new Date(close.getFullYear(), 0, 1);
  const days = Math.max(1, Math.min(365, Math.round((close - jan1) / 864e5) + 1));
  return {{ amount: Math.round(annual * days / 365), days, year: close.getFullYear() }};
}}
function netCostsAt(price) {{
  price = +price || 0;
  const num = (id) => Math.max(0, parseFloat(document.getElementById(id).value) || 0);
  const pct = (id) => Math.min(10, Math.max(0, parseFloat(document.getElementById(id).value) || 0));
  const titleEl = document.getElementById('netTitle');
  const title = titleEl.dataset.auto === '1' ? netAutoTitle(price) : num('netTitle');
  return {{
    sellerFee: price * pct('netSellerFeePct') / 100,
    buyerFee: price * pct('netBuyerFeePct') / 100,
    concession: num('netConcession'),
    repairs: num('netRepairs'),
    tax: netTaxParts(price).amount,
    payoff: num('netPayoff'),
    title,
    oec: num('netOec'),
    bundled: num('netBundled'),
    water: num('netWater'),
  }};
}}
function renderNetSheet(price) {{
  if (!document.getElementById('netLines')) return;
  price = +price || currentRec || 0;
  if (!price) return;
  const titleEl = document.getElementById('netTitle');
  if (titleEl.dataset.auto === '1') titleEl.value = netAutoTitle(price);
  const c = netCostsAt(price);
  const selling = c.sellerFee + c.buyerFee + c.concession + c.repairs;
  const closing = c.tax + c.title + c.oec + c.bundled + c.water;
  const deductions = selling + closing + c.payoff;
  const net = price - deductions;
  document.getElementById('netSellerFeeVal').textContent = '\\u2212' + money(c.sellerFee);
  document.getElementById('netBuyerFeeVal').textContent = '\\u2212' + money(c.buyerFee);
  document.getElementById('netConcessionVal').textContent = c.concession ? '\\u2212' + money(c.concession) : '\\u2014';
  document.getElementById('netRepairsVal').textContent = c.repairs ? '\\u2212' + money(c.repairs) : '\\u2014';
  document.getElementById('netTaxVal').textContent = '\\u2212' + money(c.tax);
  document.getElementById('netPayoffVal').textContent = c.payoff ? '\\u2212' + money(c.payoff) : '\\u2014';
  document.getElementById('netTitleVal').textContent = '\\u2212' + money(c.title);
  document.getElementById('netOecVal').textContent = c.oec ? '\\u2212' + money(c.oec) : '\\u2014';
  document.getElementById('netBundledVal').textContent = c.bundled ? '\\u2212' + money(c.bundled) : '\\u2014';
  document.getElementById('netWaterVal').textContent = c.water ? '\\u2212' + money(c.water) : '\\u2014';
  const tp = netTaxParts(price);
  document.getElementById('netCloseDays').textContent = tp.days ? 'day ' + tp.days + ' of ' + tp.year : 'set date';
  const sellEl = document.getElementById('netSellingVal');
  if (sellEl) sellEl.textContent = '\\u2212' + money(selling);
  const closeEl = document.getElementById('netClosingVal');
  if (closeEl) closeEl.textContent = '\\u2212' + money(closing);
  document.getElementById('netCostsVal').textContent = '\\u2212' + money(deductions);
  document.getElementById('netBig').textContent = money(net);
  document.getElementById('netPrice').textContent = money(price);
  const pct = Math.max(0, Math.min(100, Math.round(net / price * 1000) / 10));
  document.getElementById('netPct').textContent = pct.toFixed(1) + '%';
  document.getElementById('netFill').style.width = pct + '%';
  const deductNote = document.getElementById('netDeductNote');
  if (deductNote) {{
    deductNote.textContent = 'Selling ' + money(selling) + ' · Closing ' + money(closing)
      + (c.payoff ? ' · Payoff ' + money(c.payoff) : ' · Payoff not entered');
  }}
  const note = document.getElementById('netRecNote');
  if (Math.abs(price - currentRec) > 500) {{
    const rc = netCostsAt(currentRec);
    const recSell = rc.sellerFee + rc.buyerFee + rc.concession + rc.repairs;
    const recClose = rc.tax + rc.title + rc.oec + rc.bundled + rc.water;
    const recDed = recSell + recClose + rc.payoff;
    note.textContent = 'At the recommended ' + money(currentRec) + ' you\\u2019d net \\u2248 ' + money(currentRec - recDed);
  }} else {{
    note.textContent = 'Showing the recommended price';
  }}
}}
function persistNetSheet() {{
  try {{
    const raw = localStorage.getItem('listlogic_edits_' + (RUN_ID || 'local'));
    const payload = raw ? JSON.parse(raw) : {{}};
    payload.netSheet = {{
      sellerFeePct: document.getElementById('netSellerFeePct').value,
      buyerFeePct: document.getElementById('netBuyerFeePct').value,
      concession: document.getElementById('netConcession').value,
      repairs: document.getElementById('netRepairs').value,
      taxRate: document.getElementById('netTaxRate').value,
      payoff: document.getElementById('netPayoff').value,
      closeDate: document.getElementById('netCloseDate').value,
      title: document.getElementById('netTitle').value,
      titleAuto: document.getElementById('netTitle').dataset.auto === '1',
      oec: document.getElementById('netOec').value,
      bundled: document.getElementById('netBundled').value,
      water: document.getElementById('netWater').value,
    }};
    localStorage.setItem('listlogic_edits_' + (RUN_ID || 'local'), JSON.stringify(payload));
    if (RUN_ID) {{
      fetch('/api/runs/' + RUN_ID + '/edits', {{
        method: 'POST',
        headers: {{ 'Content-Type': 'application/json' }},
        body: JSON.stringify(payload),
      }}).catch(() => {{}});
    }}
  }} catch (e) {{}}
}}
document.querySelectorAll('#netLines input').forEach((inp) => {{
  inp.addEventListener('input', () => {{
    if (inp.dataset.auto === '1') {{
      delete inp.dataset.auto;
      const tag = document.getElementById('netTitleTag');
      if (tag) tag.textContent = 'manual';
    }}
    renderNetSheet(+document.getElementById('sellerPrice').value || currentRec);
    persistNetSheet();
  }});
}});

function renderWhileYouWait(price, out) {{
  const mod = document.getElementById('wywModule');
  if (!mod) return;
  const stats = supplyStatsAtPrice(price);
  const ahead = stats.activeBelow || 0;
  const dom = (out && out.expectedDom) || stats.dom || DATA.medianDom || 45;
  const arrivePm = stats.belowPm || 0;
  const fresh = arrivePm * (dom / 30.44);
  const total = ahead + fresh;
  const priceEl = document.getElementById('wywPrice');
  if (priceEl) priceEl.textContent = money(price);
  const domEl = document.getElementById('wywDom');
  if (domEl) domEl.textContent = '~' + Math.round(dom) + ' days to contract';
  const aheadEl = document.getElementById('wywAhead');
  if (aheadEl) aheadEl.textContent = String(ahead);
  const arriveEl = document.getElementById('wywArrive');
  if (arriveEl) arriveEl.textContent = '~' + arrivePm.toFixed(1) + '/mo';
  const totalEl = document.getElementById('wywTotal');
  if (totalEl) {{
    totalEl.textContent = '~' + Math.max(0, Math.round(total));
    const hot = totalEl.closest('.wyw-cell');
    if (hot) {{
      hot.title = ahead + ' already cheaper + ~' + (Math.round(fresh * 10) / 10) +
        ' new under your price during ~' + Math.round(dom) +
        ' days. Buyer attention diverted — not a closed-sales count.';
    }}
  }}
  const deltaPct = currentRec ? (price - currentRec) / currentRec : 0;
  const fillPct = Math.min(96, Math.max(6, 35 + deltaPct * 520));
  const fill = document.getElementById('wywFill');
  if (fill) fill.style.width = fillPct + '%';
  const marker = document.getElementById('wywMarker');
  if (marker) marker.style.left = fillPct + '%';
  const note = document.getElementById('wywNote');
  if (note) {{
    if (deltaPct > 0.03) {{
      note.innerHTML = 'At <b>' + money(price) + '</b>, ~<b>' + Math.max(0, Math.round(total)) +
        '</b> similar homes under your price compete for buyers during a ~' + Math.round(dom) + '-day wait.';
    }} else if (deltaPct < -0.02) {{
      note.innerHTML = 'At <b>' + money(price) + '</b> you jump the queue — buyers see yours as the value pick first.';
    }} else {{
      note.innerHTML = 'At the recommended list, the queue works <b>for</b> you. Price above it and buyer attention shifts to cheaper options.';
    }}
  }}
}}

function applyRating(r) {{
  currentRating = r;
  document.querySelectorAll('.rate-btn').forEach(b => b.classList.toggle('active', +b.dataset.rating === r));
  document.querySelectorAll('.rate-band').forEach(b => {{
    const mid = +b.dataset.rating;
    const lo = mid === 3 ? 1 : mid === 5 ? 4 : mid === 7 ? 7 : 9;
    const hi = mid === 3 ? 3 : mid === 5 ? 6 : mid === 7 ? 8 : 10;
    b.classList.toggle('active', r >= lo && r <= hi);
  }});
  const base = defaults.rec / (ratingMult[defaults.rating] || 1);
  const newRec = Math.round(base * (ratingMult[r] || 1) / 1000) * 1000;
  const newLow = Math.round(newRec * 0.965 / 1000) * 1000;
  const newHigh = Math.round(newRec * 1.04 / 1000) * 1000;
  const out = estimateAtPrice(newRec, newRec, DATA.medianDom, DATA.marketOdds, DATA.inv);
  setVerdict(newRec, newLow, newHigh, out.expectedDom);
  const vsTxt = ratingVsTypicalPct(r);
  const ratePrice = document.getElementById('rateLivePrice');
  if (ratePrice) ratePrice.textContent = vsTxt;
  document.getElementById('rateLiveScore').textContent = r + '/10';
  document.getElementById('ratingCopy').innerHTML = 'At <strong>' + r + '/10</strong>, condition is <strong>' + vsTxt + '</strong> vs a typical <strong>5/10</strong> home in this set. List dollars unlock in <strong>Price it</strong>.';
  document.getElementById('sellerPrice').value = newRec;
  setupPriceSlider(newRec);
  renderConfront(newRec);
  syncWhatIfCards(newRec);
  refreshWhatIfMetrics(newRec);
}}
document.getElementById('rateRow').addEventListener('click', e => {{
  const btn = e.target.closest('.rate-btn');
  if (btn) applyRating(+btn.dataset.rating);
}});
document.getElementById('rateBands').addEventListener('click', e => {{
  const band = e.target.closest('.rate-band');
  if (band) applyRating(+band.dataset.rating);
}});

function syncWhatIfCards(price) {{
  const cards = document.querySelectorAll('.whatif-card');
  let best = null, bestDiff = Infinity;
  cards.forEach(c => {{
    const d = Math.abs(+c.dataset.price - price);
    if (d < bestDiff) {{ bestDiff = d; best = c; }}
  }});
  cards.forEach(c => c.classList.toggle('active', c === best && bestDiff < (currentRec * 0.02)));
}}
function setupPriceSlider(rec, selectedPrice) {{
  const slider = document.getElementById('priceSlider');
  const lo = Math.round(rec * 0.92 / 1000) * 1000;
  const hi = Math.round(rec * 1.12 / 1000) * 1000;
  slider.dataset.lo = lo; slider.dataset.hi = hi; slider.dataset.rec = rec;
  document.getElementById('slideMin').textContent = money(lo);
  document.getElementById('slideMax').textContent = money(hi);
  document.getElementById('slideMid').textContent = 'Rec ' + money(rec);
  const recPct = 100 * (rec - lo) / Math.max(hi - lo, 1);
  const tick = document.getElementById('recTick');
  if (tick) tick.style.left = Math.min(98, Math.max(2, recPct)) + '%';
  const tickLabel = document.getElementById('recTickLabel');
  if (tickLabel) tickLabel.textContent = 'Rec ' + money(rec);
  const thumbPrice = selectedPrice != null ? selectedPrice : rec;
  const thumbPct = Math.round(100 * (thumbPrice - lo) / Math.max(hi - lo, 1));
  slider.value = Math.min(100, Math.max(0, thumbPct));
}}
function priceFromSlider() {{
  const slider = document.getElementById('priceSlider');
  const lo = +slider.dataset.lo || currentRec * 0.92;
  const hi = +slider.dataset.hi || currentRec * 1.12;
  return Math.round((lo + (hi - lo) * (+slider.value / 100)) / 1000) * 1000;
}}
document.getElementById('whatIfGrid').addEventListener('click', e => {{
  const card = e.target.closest('.whatif-card');
  if (!card) return;
  document.querySelectorAll('.whatif-card').forEach(c => c.classList.remove('active'));
  card.classList.add('active');
  const price = +card.dataset.price;
  document.getElementById('sellerPrice').value = price;
  setupPriceSlider(currentRec, price);
  renderConfront(price);
}});
/* marker: demo-ui-snappy */
let _priceSliderRaf = 0;
document.getElementById('priceSlider').addEventListener('input', () => {{
  if (_priceSliderRaf) cancelAnimationFrame(_priceSliderRaf);
  _priceSliderRaf = requestAnimationFrame(() => {{
    _priceSliderRaf = 0;
    const price = priceFromSlider();
    document.getElementById('sellerPrice').value = price;
    syncWhatIfCards(price);
    renderConfront(price);
  }});
}});
setupPriceSlider(currentRec);
applyRating(5);
renderConfront(currentRec);
renderNetSheet(currentRec);
syncWhatIfCards(currentRec);
updateSupplyAtPrice(currentRec);
refreshWhatIfMetrics(currentRec);

// Spine highlight
const spineLinks = [...document.querySelectorAll('#spine a[href^="#"]')];
const sections = spineLinks.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
function syncSpine() {{
  let active = sections[0];
  sections.forEach(sec => {{ if (sec.getBoundingClientRect().top <= 120) active = sec; }});
  spineLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + (active && active.id)));
}}
window.addEventListener('scroll', syncSpine, {{ passive: true }});
syncSpine();

// Scroll reveal — class applied via JS so no-JS and print always show everything
if ('IntersectionObserver' in window) {{
  const io = new IntersectionObserver(entries => {{
    entries.forEach(en => {{ if (en.isIntersecting) {{ en.target.classList.add('in'); io.unobserve(en.target); }} }});
  }}, {{ rootMargin: '0px 0px -40px' }});
  document.querySelectorAll('.section, .bottom-line').forEach(el => {{
    if (el.getBoundingClientRect().top > window.innerHeight) {{ el.classList.add('reveal'); io.observe(el); }}
  }});
}}

function bootCharts(attempt) {{
  attempt = attempt || 0;
  if (typeof Chart === 'undefined') {{
    if (attempt < 50) setTimeout(function () {{ bootCharts(attempt + 1); }}, 40);
    return;
  }}
  try {{
  Chart.defaults.font.family = "'Source Sans 3','Segoe UI',system-ui,sans-serif";
  Chart.defaults.color = '#5a6a7c';
  Chart.defaults.borderColor = 'rgba(208,217,228,.45)';
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15,39,64,.92)';
  Chart.defaults.plugins.tooltip.titleFont = {{ weight: '700', size: 12 }};
  Chart.defaults.plugins.tooltip.bodyFont = {{ size: 12 }};
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.elements.bar.borderRadius = 5;
  Chart.defaults.elements.line.borderWidth = 2.5;
  Chart.defaults.elements.point.hoverRadius = 5;

  function yearBarColors(n, accent) {{
    const base = accent || '12,60,110';
    return Array.from({{ length: n }}, (_, i) =>
      i === n - 1 ? 'rgba(' + base + ',0.92)' : 'rgba(' + base + ',' + (0.38 + i * 0.12) + ')'
    );
  }}
  function softGrid() {{
    return {{ color: 'rgba(15,40,70,.06)', drawBorder: false }};
  }}

  const crosshairPlugin = {{
    id: 'crosshairLine',
    afterDraw(chart) {{
      if (chart.config.type === 'scatter') return;
      const tooltip = chart.tooltip;
      if (!tooltip || !tooltip.getActiveElements().length) return;
      const {{ ctx }} = chart;
      const {{ x }} = tooltip.getActiveElements()[0].element;
      const topY = chart.chartArea.top;
      const bottomY = chart.chartArea.bottom;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, bottomY);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(12,60,110,0.45)';
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.restore();
    }}
  }};
  Chart.register(crosshairPlugin);

  function tightAxis(values, padFrac, floorZero) {{
    const nums = (values || []).filter(v => v != null && !isNaN(v)).map(Number);
    if (!nums.length) return {{ beginAtZero: !!floorZero }};
    let mn = Math.min(...nums), mx = Math.max(...nums);
    if (mn === mx) {{
      const pad = Math.max(Math.abs(mn) * 0.05, floorZero ? 1 : mn * 0.02 || 1);
      mn -= pad; mx += pad;
    }} else {{
      const span = mx - mn;
      const pad = Math.max(span * (padFrac || 0.2), span * 0.08);
      mn -= pad; mx += pad;
    }}
    if (floorZero) mn = Math.max(0, mn);
    return {{ beginAtZero: false, min: mn, max: mx }};
  }}
  const hoverIndex = {{ mode:'index', intersect:false }};
  const tipIndex = {{ mode:'index', intersect:false }};

  function linearFit(points) {{
    if (!points || points.length < 2) return null;
    let sx=0, sy=0, sxx=0, sxy=0, n=points.length;
    points.forEach(p => {{ sx += p.x; sy += p.y; sxx += p.x*p.x; sxy += p.x*p.y; }});
    const den = n*sxx - sx*sx;
    if (!den) return null;
    const slope = (n*sxy - sx*sy) / den;
    const intercept = (sy - slope*sx) / n;
    return {{ slope, intercept }};
  }}
  function scatterXSpan(chart, sold) {{
    const xs = [];
    (sold || []).forEach(p => {{ if (p && p.x != null) xs.push(+p.x); }});
    if (chart) {{
      chart.data.datasets.forEach((ds, i) => {{
        if (ds.label === 'Trend') return;
        if (!chart.isDatasetVisible(i)) return;
        (ds.data || []).forEach(p => {{ if (p && p.x != null) xs.push(+p.x); }});
      }});
    }} else {{
      (DATA.actives || []).forEach(p => {{ if (p && p.x != null) xs.push(+p.x); }});
      if (DATA.subject && DATA.subject.x != null) xs.push(+DATA.subject.x);
    }}
    if (!xs.length) return {{ lo: 0, hi: 1 }};
    let lo = Math.min(...xs), hi = Math.max(...xs);
    if (lo === hi) {{ lo -= 100; hi += 100; }}
    const pad = Math.max((hi - lo) * 0.06, 40);
    return {{ lo: lo - pad, hi: hi + pad }};
  }}
  function filterScatterByMonths(months) {{
    const all = DATA.scatter || [];
    if (!months) return all.slice();
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    cutoff.setHours(0,0,0,0);
    return all.filter(p => {{
      if (!p.sold_date) return false;
      const d = new Date(p.sold_date);
      return !isNaN(d) && d >= cutoff;
    }});
  }}
  let scatterMonths = 6;
  function applyScatterRange(months) {{
    if (months != null) scatterMonths = months;
    const sold = filterScatterByMonths(scatterMonths);
    const chart = window._scatterChart;
    if (!chart) return;
    const soldDs = chart.data.datasets.find(d => d.label === 'Sold');
    const trendDs = chart.data.datasets.find(d => d.label === 'Trend');
    if (soldDs) soldDs.data = sold;
    const fit = linearFit(sold);
    const span = scatterXSpan(chart, sold);
    chart.options.scales.x.min = span.lo;
    chart.options.scales.x.max = span.hi;
    if (trendDs) {{
      trendDs.data = fit
        ? [{{ x: span.lo, y: fit.slope * span.lo + fit.intercept }}, {{ x: span.hi, y: fit.slope * span.hi + fit.intercept }}]
        : (DATA.trend || []);
    }}
    chart.update();
    const countEl = document.getElementById('scatterCount');
    if (countEl) {{
      const total = (DATA.scatter || []).length;
      const label = !scatterMonths ? 'all sales in this market' : ('last ' + scatterMonths + ' months');
      countEl.textContent = 'Showing ' + sold.length + ' of ' + total + ' · ' + label;
    }}
  }}
  function toggleScatterSeries(label) {{
    const chart = window._scatterChart;
    if (!chart) return;
    const idx = chart.data.datasets.findIndex(d => d.label === label);
    if (idx < 0) return;
    const next = !chart.isDatasetVisible(idx);
    chart.setDatasetVisibility(idx, next);
    applyScatterRange(scatterMonths);
    document.querySelectorAll('#scatterSeries [data-scatter-series]').forEach(b => {{
      if (b.dataset.scatterSeries === label) b.classList.toggle('active', next);
    }});
  }}

  const scatterDatasets = [
    {{ label:'Sold', data: [], backgroundColor:'rgba(12,60,110,0.5)', borderColor:navy, pointRadius:5, pointHoverRadius:7 }},
    {{ label:'Active', data: DATA.actives || [], backgroundColor:'rgba(56,189,248,0.4)', borderColor:'rgba(14,165,233,0.75)', pointRadius:4, pointHoverRadius:6 }},
    {{ label:'Trend', data: [], type:'line', borderColor:orange, borderWidth:2.5, pointRadius:0, pointHoverRadius:0, fill:false, tension:0, order: 0 }},
  ];
  if (DATA.subject) scatterDatasets.push({{ label:'Your Home', data:[DATA.subject], backgroundColor:'#b91c1c', borderColor:'#b91c1c', pointRadius:11, pointHoverRadius:13, pointStyle:'rectRot' }});
  window._scatterChart = new Chart(document.getElementById('scatter'), {{
    type:'scatter', data:{{ datasets: scatterDatasets }},
    options:{{
      responsive:true, maintainAspectRatio:false,
      plugins:{{
        legend:{{ display:false }},
        tooltip:{{ callbacks:{{ label:(c) => {{
          const p=c.raw;
          if (!p || c.dataset.label === 'Trend') return 'Market trend';
          const bits = [];
          if (p.label) bits.push(p.label);
          bits.push('$' + Math.round(p.y).toLocaleString());
          bits.push(Math.round(p.x) + ' sf');
          if (p.sold_date) bits.push('sold ' + p.sold_date);
          return bits.join(' · ');
        }} }} }}
      }},
      scales:{{
        x:{{ title:{{ display:true, text:'Living area (sq ft)' }}, ticks:{{ maxTicksLimit: 8 }} }},
        y:{{ title:{{ display:true, text:'Price' }}, ticks:{{ callback:v => '$'+(v/1000)+'k' }} }}
      }}
    }}
  }});
  applyScatterRange(6);
  // Active price-band competition
  (function() {{
    const pb = DATA.priceBands || {{}};
    const canvas = document.getElementById('priceBandChart');
    if (!canvas || !(pb.labels || []).length) return;
    const colors = (pb.labels || []).map((_, i) =>
      i === pb.subjectIndex ? 'rgba(13,122,79,0.85)' : 'rgba(12,60,110,0.55)'
    );
    new Chart(canvas, {{
      type: 'bar',
      data: {{
        labels: pb.labels,
        datasets: [{{ data: pb.values, backgroundColor: colors, borderRadius: 5 }}]
      }},
      options: {{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {{
          legend: {{ display: false }},
          tooltip: {{
            callbacks: {{
              afterLabel: (c) => c.dataIndex === pb.subjectIndex ? 'Your recommended list band' : ''
            }}
          }}
        }},
        scales: {{
          y: {{ beginAtZero: true, ticks: {{ precision: 0 }}, title: {{ display: true, text: 'Active homes' }} }},
          x: {{ ticks: {{ maxRotation: 45, minRotation: 0, autoSkip: true, maxTicksLimit: 10 }} }}
        }}
      }}
    }});
  }})();
  (function() {{
    const lf = DATA.listingFlow || {{}};
    const chart = lf.chart || {{}};
    const canvas = document.getElementById('listingFlowChart');
    if (!canvas || !(chart.labels || []).length) return;
    new Chart(canvas, {{
      type: 'bar',
      data: {{
        labels: chart.labels,
        datasets: [
          {{ label: 'New listings', data: chart.newListings || [], backgroundColor: 'rgba(14,165,233,0.72)', borderRadius: 4, maxBarThickness: 18 }},
          {{ label: 'Sales', data: chart.sales || [], backgroundColor: 'rgba(12,60,110,0.82)', borderRadius: 4, maxBarThickness: 18 }},
        ],
      }},
      options: {{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {{
          legend: {{ position: 'top', align: 'end', labels: {{ boxWidth: 12, font: {{ size: 11 }} }} }},
          tooltip: {{
            callbacks: {{
              title: (items) => (items[0] && items[0].label) || '',
            }}
          }}
        }},
        scales: {{
          y: {{ beginAtZero: true, ticks: {{ precision: 0 }}, title: {{ display: true, text: 'Homes / month' }}, grid: {{ color: 'rgba(15,40,70,.06)' }} }},
          x: {{ ticks: {{ maxRotation: 45, minRotation: 0, autoSkip: true, maxTicksLimit: 12, font: {{ size: 10 }} }}, grid: {{ display: false }} }},
        }},
      }},
    }});
  }})();
  let salesChart = new Chart(document.getElementById('salesTrend'), {{
    type:'bar', data:{{ labels: DATA.monthlySales.labels, datasets:[{{ data: DATA.monthlySales.values, backgroundColor:'rgba(12,60,110,0.75)', borderRadius:5, maxBarThickness:28 }}] }},
    options:{{ responsive:true, maintainAspectRatio:false, interaction:hoverIndex, plugins:{{ legend:{{ display:false }}, tooltip:tipIndex }}, scales:{{ y:{{ beginAtZero:true, grid: softGrid(), ticks:{{ precision:0 }} }}, x:{{ grid:{{ display:false }} }} }} }}
  }});
  const priceTrendVals = DATA.monthlyPrice.values || [];
  const priceBands = DATA.monthlyPriceBands || {{}};
  const priceTrendCtx = document.getElementById('priceTrend');
  const priceTrendSub = document.getElementById('priceTrendSub');
  const bandSplit = priceBands.split_price || 0;
  const bandDatasets = () => [
    {{ label: 'Sold under ' + money(bandSplit), data: priceBands.below || [], borderColor: '#0e7a6d', backgroundColor: 'rgba(14,122,109,0.14)', fill: true, tension: 0.35, pointRadius: 3, pointHoverRadius: 5, spanGaps: true }},
    {{ label: 'Sold at/above ' + money(bandSplit), data: priceBands.above || [], borderColor: '#b3541e', backgroundColor: 'rgba(179,84,30,0.12)', fill: true, tension: 0.35, pointRadius: 3, pointHoverRadius: 5, spanGaps: true }},
  ];
  let priceTrendChart = new Chart(priceTrendCtx, {{
    type:'line', data:{{ labels: DATA.monthlyPrice.labels, datasets:[{{ data: priceTrendVals, borderColor:navy, fill:true, tension:0.35, backgroundColor:'rgba(12,60,110,0.12)', pointRadius:3.5, pointHoverRadius:6, pointBackgroundColor:'#fff', pointBorderColor:navy, pointBorderWidth:2 }}] }},
    options:{{ responsive:true, maintainAspectRatio:false, interaction:hoverIndex, plugins:{{ legend:{{ display:false }}, tooltip:{{ ...tipIndex, callbacks:{{ label:c => (c.dataset.label ? c.dataset.label + ': ' : '') + money(c.raw) }} }} }}, scales:{{ y:{{ ...tightAxis(priceTrendVals, 0.25, false), grid: softGrid(), ticks:{{ callback:v => '$'+(v/1000)+'k' }} }}, x:{{ grid:{{ display:false }} }} }} }}
  }});
  document.querySelectorAll('#priceTrendToggle [data-price-view]').forEach(btn => {{
    btn.addEventListener('click', () => {{
      document.querySelectorAll('#priceTrendToggle [data-price-view]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.priceView;
      if (view === 'bands' && (priceBands.labels || []).length) {{
        priceTrendChart.data.labels = priceBands.labels;
        priceTrendChart.data.datasets = bandDatasets();
        priceTrendChart.options.plugins.legend.display = true;
        priceTrendChart.options.plugins.legend.labels = {{ boxWidth: 10, font: {{ size: 10 }} }};
        if (priceTrendSub) priceTrendSub.innerHTML = 'Median sold price by month, split at your recommended line of <strong>' + money(bandSplit) + '</strong> — are the homes closing the ones priced under it?';
      }} else {{
        priceTrendChart.data.labels = DATA.monthlyPrice.labels;
        priceTrendChart.data.datasets = [{{ data: priceTrendVals, borderColor: navy, fill: true, tension: 0.35, backgroundColor: 'rgba(12,60,110,0.12)', pointRadius: 3.5, pointHoverRadius: 6, pointBackgroundColor: '#fff', pointBorderColor: navy, pointBorderWidth: 2 }}];
        priceTrendChart.options.plugins.legend.display = false;
        if (priceTrendSub) priceTrendSub.textContent = 'Median sold price is the clearest signal of buyer willingness to pay in this set.';
      }}
      priceTrendChart.update();
    }});
  }});
  const domLabels = DATA.domDist.labels || [];
  const domVals = DATA.domDist.values || [];
  const domMed = +(DATA.domDist.median || DATA.medianDom || 0);
  const domBinColors = domLabels.map((lab, i) => {{
    // Highlight the bin that contains the median
    const edges = [0, 15, 30, 45, 60, 90, 120, 999];
    const lo = edges[i], hi = edges[i + 1];
    const hit = domMed > lo && domMed <= hi;
    return hit ? 'rgba(194,65,12,0.85)' : 'rgba(26,95,158,0.72)';
  }});
  let domChartObj = new Chart(document.getElementById('domChart'), {{
    type:'bar', data:{{ labels: domLabels, datasets:[{{ data: domVals, backgroundColor: domBinColors, borderRadius:5, maxBarThickness:36 }}] }},
    options:{{ responsive:true, maintainAspectRatio:false, interaction:hoverIndex, plugins:{{ legend:{{ display:false }}, tooltip:{{ ...tipIndex, callbacks:{{ afterBody:() => domMed ? ['Market median ≈ ' + Math.round(domMed) + ' days'] : [] }} }} }}, scales:{{ y:{{ beginAtZero:true, grid: softGrid(), ticks:{{ precision:0 }} }}, x:{{ grid:{{ display:false }} }} }} }}
  }});
  const yoy = DATA.yoy || {{}};
  const yoySalesVals = (yoy.sales||{{}}).values||[];
  new Chart(document.getElementById('yoySales'), {{
    type:'bar', data:{{ labels:(yoy.sales||{{}}).labels||[], datasets:[{{ data:yoySalesVals, backgroundColor: yearBarColors(yoySalesVals.length, '12,60,110'), borderRadius:5, maxBarThickness:42 }}] }},
    options:{{ responsive:true, maintainAspectRatio:false, interaction:hoverIndex, plugins:{{ legend:{{ display:false }}, tooltip:tipIndex }}, scales:{{ y:{{ beginAtZero:true, grid: softGrid(), ticks:{{ precision:0 }} }}, x:{{ grid:{{ display:false }} }} }} }}
  }});
  const yoyPriceVals = (yoy.median_price||{{}}).values||[];
  new Chart(document.getElementById('yoyPrice'), {{
    type:'bar', data:{{ labels:(yoy.median_price||{{}}).labels||[], datasets:[{{ data:yoyPriceVals, backgroundColor: yearBarColors(yoyPriceVals.length, '26,95,158'), borderRadius:5, maxBarThickness:42 }}] }},
    options:{{ responsive:true, maintainAspectRatio:false, interaction:hoverIndex, plugins:{{ legend:{{ display:false }}, tooltip:{{ ...tipIndex, callbacks:{{ label:c => money(c.raw) }} }} }}, scales:{{ y:{{ ...tightAxis(yoyPriceVals, 0.35, false), grid: softGrid(), ticks:{{ callback:v => '$'+(v/1000)+'k' }} }}, x:{{ grid:{{ display:false }} }} }} }}
  }});
  const yoyDomVals = (yoy.median_dom||{{}}).values||[];
  new Chart(document.getElementById('yoyDom'), {{
    type:'bar', data:{{ labels:(yoy.median_dom||{{}}).labels||[], datasets:[{{ data:yoyDomVals, backgroundColor: yearBarColors(yoyDomVals.length, '194,65,12'), borderRadius:5, maxBarThickness:42 }}] }},
    options:{{ responsive:true, maintainAspectRatio:false, interaction:hoverIndex, plugins:{{ legend:{{ display:false }}, tooltip:{{ ...tipIndex, callbacks:{{ label:c => Math.round(c.raw)+' days' }} }} }}, scales:{{ y:{{ ...tightAxis(yoyDomVals, 0.4, true), grid: softGrid(), ticks:{{ callback:v => Math.round(v)+'d' }} }}, x:{{ grid:{{ display:false }} }} }} }}
  }});
  const ym = yoy.monthly_sales || {{}};
  new Chart(document.getElementById('yoyMonthly'), {{
    type:'bar',
    data:{{
      labels: ym.labels || [],
      datasets:[
        {{ label: ym.last_year_label || 'Last year', data: ym.last_year || [], backgroundColor:'rgba(90,106,124,0.45)', borderRadius:4, maxBarThickness:22 }},
        {{ label: ym.this_year_label || 'This year', data: ym.this_year || [], backgroundColor:'rgba(12,60,110,0.88)', borderRadius:4, maxBarThickness:22 }},
      ]
    }},
    options:{{ responsive:true, maintainAspectRatio:false, interaction:hoverIndex, plugins:{{ legend:{{ position:'top', align:'end', labels:{{ boxWidth:10, font:{{ size:11 }} }} }}, tooltip:tipIndex }}, scales:{{ y:{{ beginAtZero:true, grid: softGrid(), ticks:{{ precision:0 }} }}, x:{{ grid:{{ display:false }} }} }} }}
  }});
  document.querySelectorAll('.controls button').forEach(btn => {{
    btn.onclick = () => {{
      if (btn.hasAttribute('data-scatter-series')) {{
        toggleScatterSeries(btn.dataset.scatterSeries);
        return;
      }}
      if (btn.hasAttribute('data-scatter-mo')) {{
        document.querySelectorAll('#scatterRange button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyScatterRange(+btn.dataset.scatterMo);
        return;
      }}
      if (btn.hasAttribute('data-yoy-layout')) return;
      const chart = btn.dataset.chart, mode = btn.dataset.mode;
      if (!chart) return;
      btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (chart === 'sales') {{
        salesChart.data.labels = mode === 'month' ? DATA.monthlySales.labels : DATA.yearlySales.labels;
        salesChart.data.datasets[0].data = mode === 'month' ? DATA.monthlySales.values : DATA.yearlySales.values;
        salesChart.update();
      }}
      if (chart === 'dom') {{
        if (mode === 'dist') {{
          domChartObj.config.type = 'bar';
          domChartObj.data.labels = DATA.domDist.labels;
          domChartObj.data.datasets[0].data = DATA.domDist.values;
          domChartObj.data.datasets[0].backgroundColor = domBinColors;
          domChartObj.data.datasets[0].borderColor = undefined;
          domChartObj.data.datasets[0].fill = false;
          domChartObj.options.scales = {{ y: {{ beginAtZero: true, grid: softGrid(), ticks: {{ precision: 0 }} }}, x: {{ grid: {{ display: false }} }} }};
        }} else {{
          domChartObj.config.type = 'line';
          domChartObj.data.labels = DATA.monthlyDom.labels;
          domChartObj.data.datasets[0].data = DATA.monthlyDom.values;
          domChartObj.data.datasets[0].borderColor = navy;
          domChartObj.data.datasets[0].backgroundColor = 'rgba(12,60,110,0.12)';
          domChartObj.data.datasets[0].fill = true;
          domChartObj.data.datasets[0].tension = 0.35;
          domChartObj.data.datasets[0].pointRadius = 3;
          const ax = tightAxis(DATA.monthlyDom.values || [], 0.35, true);
          domChartObj.options.scales = {{ y: {{ ...ax, grid: softGrid(), ticks: {{ callback: v => Math.round(v) + 'd' }} }}, x: {{ grid: {{ display: false }} }} }};
        }}
        domChartObj.update();
      }}
    }};
  }});
  /* legacy yoy layout toggle removed — panels are topic-based */
}} catch (err) {{
  console.error('ListLogic charts failed to boot', err);
}}
}}
setTimeout(function () {{ bootCharts(0); }}, 0);

function animateCount(el, target, prefix, dur) {{
  const start = performance.now();
  function tick(now) {{
    if (el.dataset.settled) return;
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = prefix + Math.round(target * eased).toLocaleString('en-US');
    if (p < 1) requestAnimationFrame(tick);
  }}
  requestAnimationFrame(tick);
}}
(function() {{
  const recEl = document.getElementById('dispRec');
  if (recEl && currentRec) animateCount(recEl, currentRec, '$', 1100);
  document.querySelectorAll('.market-duo .n').forEach(el => {{
    const v = parseInt(el.textContent.replace(/[^0-9]/g,''), 10);
    if (!isNaN(v) && v > 0 && !el.textContent.includes('$')) animateCount(el, v, '', 900);
  }});
  const marker = document.getElementById('posMarker');
  if (marker && currentRec) marker.style.left = 'calc(' + Math.min(98, Math.max(2, 100 - topPct(currentRec))) + '% - 2px)';
}})();

let visibleCols = [...DEFAULT_COLS], excluded = new Set();
const AUTO_COMP_MLS = (DATA.autoComps || []).map(String).filter(Boolean);
let selectedCompMls = [...AUTO_COMP_MLS];
let liveComps = Array.isArray(DATA.comps) ? DATA.comps.slice() : [];
let currentListingUrl = '';
let photoMap = {{}};
let photoModalMls = '';
let photoModalIdx = -1;
const SUBJECT_PHOTO_KEY = '__subject__';
const PHOTO_COLS = ['PhotoURL','PrimaryPhotoURL','PrimaryPhoto','MediaURL','Photo','ImageURL','ListingPhoto','PhotoLink','MainPhotoURL','PhotoUrl'];

function escapeHtml(s) {{ return String(s).replace(/[&<>"']/g, c => ({{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}}[c])); }}
function photoStorageKey() {{ return 'listlogic_photos_' + (RUN_ID || 'local'); }}
function loadLocalPhotoMap() {{
  try {{
    const raw = localStorage.getItem(photoStorageKey());
    const data = raw ? JSON.parse(raw) : {{}};
    return (data && typeof data === 'object') ? data : {{}};
  }} catch (e) {{ return {{}}; }}
}}
function persistLocalPhotoMap() {{
  try {{ localStorage.setItem(photoStorageKey(), JSON.stringify(photoMap)); }} catch (e) {{}}
}}
function extractRowPhoto(row) {{
  for (const key of PHOTO_COLS) {{
    const v = row[key];
    if (v == null || v === '') continue;
    const text = String(v).trim();
    if (/^(https?:\\/\\/|\\/)/i.test(text)) return text;
  }}
  return '';
}}
function applyPhotoMapToComps() {{
  const apply = (c) => {{
    if (!c) return;
    const mls = String(c.mls || '');
    if (mls && photoMap[mls]) {{
      c.photo = photoMap[mls];
      const g = galleryMap[mls];
      if (g && g.length) c.photos = g.slice();
      else if (!c.photos || !c.photos.length) c.photos = [photoMap[mls]];
    }} else if (!c.photo) c.photo = '';
  }};
  liveComps.forEach(apply);
  (window.__AUTO_COMPS_CACHE || []).forEach(apply);
  if (DATA.subjectSnap) {{
    DATA.subjectSnap.photo = photoMap[SUBJECT_PHOTO_KEY] || DATA.subjectSnap.photo || '';
    const sg = galleryMap[SUBJECT_PHOTO_KEY];
    if (sg && sg.length) DATA.subjectSnap.photos = sg.slice();
    else if (DATA.subjectSnap.photo && !(DATA.subjectSnap.photos && DATA.subjectSnap.photos.length)) {{
      DATA.subjectSnap.photos = [DATA.subjectSnap.photo];
    }}
  }}
}}
let galleryMap = {{}};
let photoPollTimer = null;
function setPhotoFetchBanner(on, message, done, total) {{
  const el = document.getElementById('photoFetchBanner');
  const msg = document.getElementById('photoFetchMsg');
  const count = document.getElementById('photoFetchCount');
  if (!el) return;
  el.classList.toggle('on', !!on);
  if (msg && message) msg.textContent = message;
  if (count) {{
    count.textContent = (total > 0) ? ((done || 0) + ' / ' + total) : '';
  }}
}}
async function fetchPhotoMap() {{
  Object.assign(photoMap, loadLocalPhotoMap());
  let status = 'ready';
  if (RUN_ID) {{
    try {{
      const res = await fetch('/api/runs/' + RUN_ID + '/comp-photos');
      if (res.ok) {{
        const data = await res.json();
        Object.assign(photoMap, data.photos || {{}});
        Object.assign(galleryMap, data.galleries || {{}});
        status = data.status || 'ready';
        const pending = status === 'pending' || status === 'fetching';
        const isSample = RUN_ID === 'sample-2845' || /[?&]sample=1(?:&|$)/.test(location.search);
        const hasPhotos = Object.keys(photoMap).length > 0;
        setPhotoFetchBanner(
          pending && !isSample && !hasPhotos,
          data.message || (pending ? 'Fetching listing photos…' : ''),
          data.done || 0,
          data.total || 0
        );
        if (pending && !isSample && !photoPollTimer) {{
          // Kick background fetch if generate left it pending
          fetch('/api/runs/' + RUN_ID + '/comp-photos/fetch', {{ method: 'POST' }}).catch(() => {{}});
          photoPollTimer = setInterval(async () => {{
            try {{
              const r2 = await fetch('/api/runs/' + RUN_ID + '/comp-photos');
              if (!r2.ok) return;
              const d2 = await r2.json();
              Object.assign(photoMap, d2.photos || {{}});
              Object.assign(galleryMap, d2.galleries || {{}});
              applyPhotoMapToComps();
              renderLiveComps();
              renderVisualBoard();
              const st = d2.status || 'ready';
              const still = (st === 'pending' || st === 'fetching') && !Object.keys(photoMap).length;
              setPhotoFetchBanner(still, d2.message || 'Fetching listing photos…', d2.done || 0, d2.total || 0);
              if (!still) {{
                clearInterval(photoPollTimer);
                photoPollTimer = null;
              }}
            }} catch (e) {{}}
          }}, 2000);
        }}
      }}
    }} catch (e) {{}}
  }}
  applyPhotoMapToComps();
  renderLiveComps();
  renderVisualBoard();
  const subInput = document.getElementById('editSubjectPhoto');
  if (subInput) subInput.value = photoMap[SUBJECT_PHOTO_KEY] || (DATA.subjectSnap && DATA.subjectSnap.photo) || '';
}}
async function savePhotoForMls(mls, url) {{
  mls = String(mls || '');
  if (!mls) return false;
  url = (url || '').trim();
  if (url) photoMap[mls] = url;
  else delete photoMap[mls];
  persistLocalPhotoMap();
  if (RUN_ID) {{
    try {{
      await fetch('/api/runs/' + RUN_ID + '/comp-photos', {{
        method: 'POST',
        headers: {{ 'Content-Type': 'application/json' }},
        body: JSON.stringify({{ mls: mls, url: url }}),
      }});
    }} catch (e) {{}}
  }}
  applyPhotoMapToComps();
  renderLiveComps();
  renderVisualBoard();
  return true;
}}
async function uploadPhotoForMls(mls, file) {{
  mls = String(mls || '');
  if (!mls || !file) return false;
  if (RUN_ID) {{
    const fd = new FormData();
    fd.append('file', file);
    try {{
      const res = await fetch('/api/runs/' + RUN_ID + '/comp-photos/' + encodeURIComponent(mls) + '/upload', {{
        method: 'POST',
        body: fd,
      }});
      if (!res.ok) throw new Error('upload failed');
      const data = await res.json();
      photoMap[mls] = data.url || '';
      persistLocalPhotoMap();
      applyPhotoMapToComps();
      renderLiveComps();
      renderVisualBoard();
      return true;
    }} catch (e) {{
      alert('Upload failed. Try pasting the photo URL instead.');
      return false;
    }}
  }}
  // Local file presentation: store as data URL
  return new Promise((resolve) => {{
    const reader = new FileReader();
    reader.onload = () => {{
      photoMap[mls] = String(reader.result || '');
      persistLocalPhotoMap();
      applyPhotoMapToComps();
      renderLiveComps();
      renderVisualBoard();
      resolve(true);
    }};
    reader.onerror = () => {{ alert('Could not read that image.'); resolve(false); }};
    reader.readAsDataURL(file);
  }});
}}
function openPhotoModal(mls, idx) {{
  photoModalMls = String(mls || '');
  photoModalIdx = (idx == null || isNaN(+idx)) ? -1 : +idx;
  const c = (photoModalIdx >= 0 ? liveComps[photoModalIdx] : null) || liveComps.find(x => String(x.mls) === photoModalMls) || {{}};
  const modal = document.getElementById('photoModal');
  const title = document.getElementById('photoModalTitle');
  const input = document.getElementById('photoUrlInput');
  const openLink = document.getElementById('photoOpenListing');
  if (title) title.textContent = photoModalMls === SUBJECT_PHOTO_KEY
    ? 'Your home photo'
    : ('Add listing photo · MLS ' + (photoModalMls || '—'));
  if (input) input.value = photoMap[photoModalMls] || c.photo || '';
  if (openLink) {{
    const z = c.zillow || currentListingUrl || '#';
    openLink.href = z;
    openLink.style.display = (photoModalMls === SUBJECT_PHOTO_KEY || z === '#') ? 'none' : '';
  }}
  if (modal) {{
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }}
  if (input) setTimeout(() => input.focus(), 50);
}}
function closePhotoModal() {{
  const modal = document.getElementById('photoModal');
  if (modal) {{
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }}
  photoModalMls = '';
  photoModalIdx = -1;
}}
function renderVisualBoard() {{ /* removed — sliding comps rail is the photo story */ }}
function deltaHtml(compVal, subjVal, invert) {{
  const a = Number(compVal), b = Number(subjVal);
  if (!isFinite(a) || !isFinite(b) || b === 0) return '<span class="ld-delta same">—</span>';
  const d = a - b;
  const pct = Math.round(100 * d / b);
  const better = invert ? d < 0 : d > 0;
  const cls = Math.abs(pct) < 2 ? 'same' : (better ? 'up' : 'down');
  const sign = d > 0 ? '+' : '';
  return '<span class="ld-delta ' + cls + '">' + sign + pct + '%</span>';
}}
function rowToComp(row) {{
  const city = row.City || LINK_CITY;
  const addr = row.Address || '';
  const addrQ = encodeURIComponent((addr + ' ' + city + ' ' + (LINK_STATE || 'CO')).trim());
  const sold = Number(row.SoldPrice || row.DisplayPrice || row.Price || 0);
  const sqft = Number(row.LivingArea || 0);
  const mls = String(row.MLSNumber || '');
  return {{
    address: addr,
    sold_date: (row.SoldDate || '').toString().slice(0, 10),
    sold_price: sold,
    living_area: sqft,
    beds: Number(row.Beds || 0),
    baths: Number(row.Baths || 0),
    year_built: row.YearBuilt || '',
    garage: Number(row.Garage || 0),
    lot_size: Number(row.LotSize || 0),
    acres: Number(row.Acres || 0),
    dom: Number(row.DOM || 0),
    ppsf: Number(row.PPSF || (sqft ? sold / sqft : 0)),
    mls: mls,
    subdivision: row.Subdivision || '',
    city: city,
    zillow: 'https://www.zillow.com/homes/' + addrQ + '_rb/',
    realtor: 'https://www.realtor.com/realestateandhomes-search/' + addrQ,
    photo: photoMap[mls] || extractRowPhoto(row) || '',
    auto: false,
    match_pct: null,
    reasons: [],
  }};
}}
function compReasons(c, sub) {{
  // Mirror of server-side ranking reasons for live-added comps.
  sub = sub || {{}};
  const reasons = [];
  const sqft = Number(c.living_area || 0), ssq = Number(sub.living_area || 0);
  if (sqft && ssq) {{
    const d = Math.round(sqft - ssq);
    reasons.push(Math.abs(d) < 50 ? 'similar size' : ((d > 0 ? '+' : '') + d + ' sqft'));
  }}
  const beds = Number(c.beds || 0), baths = Number(c.baths || 0);
  const sbeds = Number(sub.beds || 0), sbaths = Number(sub.baths || 0);
  if (sbeds && beds === sbeds && Math.abs(baths - sbaths) < 0.3) reasons.push('same bed/bath');
  else if (sbeds) reasons.push(beds + '/' + baths + ' bed/bath');
  const yr = Number(c.year_built || 0), syr = Number(sub.year_built || 0);
  if (yr && syr) {{
    const dy = Math.round(yr - syr);
    reasons.push(Math.abs(dy) <= 5 ? 'same era' : ((dy > 0 ? '+' : '') + dy + ' yrs'));
  }}
  if (Number(sub.garage || 0) && Math.abs(Number(c.garage || 0) - Number(sub.garage || 0)) < 0.5) reasons.push('same garage');
  const sd = String(c.sold_date || '').slice(0, 10);
  if (sd) {{
    const age = Math.floor((Date.now() - new Date(sd + 'T12:00:00').getTime()) / 864e5);
    if (!isNaN(age) && age >= 0) {{
      if (age <= 45) reasons.push('sold recently');
      else if (age <= 120) reasons.push('sold ' + Math.floor(age / 7) + ' wks ago');
      else reasons.push('sold ' + Math.floor(age / 30) + ' mo ago');
    }}
  }}
  return reasons.slice(0, 4);
}}
function buildSubjectCardHtml() {{
  const sub = DATA.subjectSnap || {{}};
  const photos = (sub.photos && sub.photos.length) ? sub.photos : ((photoMap[SUBJECT_PHOTO_KEY] || sub.photo) ? [photoMap[SUBJECT_PHOTO_KEY] || sub.photo] : []);
  const fade = '<div class="cph-price">Your home</div>' +
    '<div class="cph-meta">Anchor · compare the sales</div><span class="comp-delta same">Subject</span>';
  let visual;
  if (photos.length) {{
    const slides = photos.map((u, i) =>
      '<img class="comp-photo' + (i === 0 ? ' is-on' : '') + '" src="' + escapeHtml(u) + '" alt="Your home" loading="' + (i === 0 ? 'eager' : 'lazy') + '" data-slide="' + i + '">'
    ).join('');
    let nav = '';
    if (photos.length > 1) {{
      nav = '<button type="button" class="car-btn car-prev" aria-label="Previous photo">‹</button>' +
        '<button type="button" class="car-btn car-next" aria-label="Next photo">›</button>' +
        '<div class="car-count">1 / ' + photos.length + '</div>';
    }}
    visual = '<div class="comp-visual has-photo"><div class="comp-carousel" data-slide="0">' + slides + nav + '</div><div class="comp-photo-fade">' + fade + '</div></div>';
  }} else {{
    visual = '<div class="comp-visual needs-photo"><div class="comp-photo-empty">' + fade + '</div></div>';
  }}
  return '<article class="comp-card subject-card">' + visual +
    '<div class="cb"><div class="ca">' + escapeHtml(String(sub.address || 'Your home').slice(0, 40)) + '</div>' +
    '<div class="cm">Your home</div>' +
    '<div class="cf"><div><span>Sq ft</span><br><strong>' + Math.round(sub.living_area || 0).toLocaleString() + '</strong></div>' +
    '<div><span>Bd / Ba</span><br><strong>' + (sub.beds || 0) + ' / ' + (sub.baths || 0) + '</strong></div>' +
    '<div><span>Year · Gar</span><br><strong>' + (sub.year_built || '—') + ' · ' + (sub.garage || 0) + '</strong></div>' +
    '<div><span>Role</span><br><strong>Yours</strong></div></div></div></article>';
}}
function buildCompCardHtml(i, c) {{
  const sold = Number(c.sold_price || 0);
  const photos = (c.photos && c.photos.length) ? c.photos : ((c.photo || photoMap[String(c.mls || '')]) ? [c.photo || photoMap[String(c.mls || '')]] : []);
  const rec = Number((DATA.subjectSnap && DATA.subjectSnap.rec) || currentRec || 0);
  const delta = sold - rec;
  let deltaHtmlBadge = '<span class="comp-delta same">Recent sale</span>';
  if (Math.abs(delta) >= 500) {{
    deltaHtmlBadge = delta > 0
      ? '<span class="comp-delta up">Sold higher</span>'
      : '<span class="comp-delta down">Sold lower</span>';
  }}
  const subSqft = Number((DATA.subjectSnap && DATA.subjectSnap.living_area) || 0);
  const sqft = Number(c.living_area || 0);
  let sqftNote = '';
  if (sqft && subSqft && Math.abs(sqft - subSqft) >= 50) {{
    const dsf = Math.round(sqft - subSqft);
    sqftNote = ' · ' + (dsf > 0 ? '+' : '') + dsf + ' sf';
  }}
  const fade = '<div class="cph-price">' + money(sold) + '</div>' +
    '<div class="cph-meta">Sold ' + escapeHtml(c.sold_date || '—') + sqftNote + '</div>' + deltaHtmlBadge;
  let visual;
  if (photos.length) {{
    const slides = photos.map((u, si) =>
      '<img class="comp-photo' + (si === 0 ? ' is-on' : '') + '" src="' + escapeHtml(u) + '" alt="Listing photo" loading="' + (si === 0 ? 'eager' : 'lazy') + '" data-slide="' + si + '">'
    ).join('');
    let nav = '';
    if (photos.length > 1) {{
      nav = '<button type="button" class="car-btn car-prev" aria-label="Previous photo">‹</button>' +
        '<button type="button" class="car-btn car-next" aria-label="Next photo">›</button>' +
        '<div class="car-count">1 / ' + photos.length + '</div>';
    }}
    visual = '<div class="comp-visual has-photo"><div class="comp-carousel" data-slide="0">' + slides + nav + '</div><div class="comp-photo-fade">' + fade + '</div></div>';
  }} else {{
    visual = '<div class="comp-visual needs-photo"><div class="comp-photo-empty">' + fade + '</div></div>';
  }}
  return (
    '<article class="comp-card" data-comp-idx="' + i + '" data-mls="' + escapeHtml(String(c.mls || '')) + '">' +
    visual + '<div class="cb">' +
    '<div class="ca">' + escapeHtml(String(c.address || '').slice(0, 40)) + '</div>' +
    '<div class="cm"><span class="match-badge">' +
      (c.auto === false ? 'Manual pick' : ('#' + (i + 1) + ' · ' + (c.match_pct != null ? c.match_pct + '% match' : 'Match'))) +
    '</span> · MLS ' + escapeHtml(String(c.mls || '—')) + '</div>' +
    (Array.isArray(c.reasons) && c.reasons.length
      ? '<div class="match-why">' + escapeHtml(c.reasons.join(' · ')) + '</div>'
      : (c.auto === false ? '<div class="match-why">' + escapeHtml(compReasons(c, DATA.subjectSnap || {{}}).join(' · ')) + '</div>' : '')) +
    '<div class="cf">' +
    '<div><span>Sq ft</span><br><strong>' + Math.round(c.living_area || 0).toLocaleString() + '</strong></div>' +
    '<div><span>Bd / Ba</span><br><strong>' + (c.beds || 0) + ' / ' + (c.baths || 0) + '</strong></div>' +
    '<div><span>Year · Gar</span><br><strong>' + (c.year_built || '—') + ' · ' + (c.garage || 0) + '</strong></div>' +
    '<div><span>DOM · $/SF</span><br><strong>' + Math.round(c.dom || 0) + 'd · $' + Math.round(c.ppsf || 0) + '</strong></div>' +
    '</div></div></article>'
  );
}}
function syncCompToolbar() {{
  const el = document.getElementById('compToolbarLabel');
  if (!el) return;
  const custom = JSON.stringify(selectedCompMls.map(String)) !== JSON.stringify(AUTO_COMP_MLS.map(String));
  el.innerHTML = custom
    ? '<strong>Agent picks</strong> · ' + liveComps.length + ' comps selected'
    : '<strong>Auto picks</strong> · closest sales for this home';
}}
function renderLiveComps() {{
  const rail = document.getElementById('compRail');
  const subjectSlot = document.getElementById('subjectCompSlot');
  const tbody = document.getElementById('compTableBody');
  if (subjectSlot) subjectSlot.innerHTML = buildSubjectCardHtml();
  if (!rail) return;
  if (!liveComps.length) {{
    rail.innerHTML = '<p class="muted">No comps selected. Use Full Market Data → <strong>Use as comp</strong> on Sold rows.</p>';
    if (tbody) tbody.innerHTML = '<tr><td colspan="9">No comps selected</td></tr>';
    syncCompToolbar();
    renderMarketMap();
    return;
  }}
  rail.innerHTML = liveComps.map((c, i) => buildCompCardHtml(i, c)).join('');
  if (tbody) {{
    tbody.innerHTML = liveComps.map((c, i) =>
      '<tr data-comp-idx="' + i + '"><td>' + escapeHtml(String(c.address || '').slice(0, 32)) + '</td>' +
      '<td>' + escapeHtml(String(c.sold_date || '').slice(0, 10)) + '</td>' +
      '<td>' + money(c.sold_price) + '</td>' +
      '<td>' + Math.round(c.living_area || 0) + '</td>' +
      '<td>' + (c.beds || 0) + '/' + (c.baths || 0) + '</td>' +
      '<td>' + (c.year_built || '') + '</td>' +
      '<td>' + (c.garage || 0) + '</td>' +
      '<td>' + Math.round(c.dom || 0) + '</td>' +
      '<td>$' + Math.round(c.ppsf || 0) + '</td></tr>'
    ).join('');
  }}
  syncCompToolbar();
  renderMarketMap();
}}
let marketMap = null;
let marketMapFitted = false;
let marketHoverPopup = null;
let marketClickPopup = null;
const mapKindVisible = {{ sold: true, active: true, uc: true, off: false }};
function mapKindFor(status, isPicked) {{
  if (isPicked) return 'comp';
  const st = String(status || '').toLowerCase().replace(/[^a-z]/g, '');
  if (st === 'active') return 'active';
  if (st === 'pending' || st === 'backup' || st === 'firstright') return 'uc';
  if (st === 'sold') return 'sold';
  return 'off';
}}
function toggleMapKind(kind) {{
  mapKindVisible[kind] = !mapKindVisible[kind];
  document.querySelectorAll('#mapKindFilters .map-kind').forEach((b) => {{
    if (b.dataset.kind === kind) b.classList.toggle('on', mapKindVisible[kind]);
  }});
  renderMarketMap({{ fit: false }});
}}
function renderMarketMap(opts) {{
  opts = opts || {{}};
  const el = document.getElementById('compMap');
  const wrap = document.getElementById('compMapWrap');
  if (!el || typeof mapboxgl === 'undefined' || !MAPBOX_TOKEN) {{
    if (wrap) wrap.style.display = 'none';
    return;
  }}
  // Wait for Mapbox GL + defer first paint so condition/slider stay responsive.
  if (typeof mapboxgl === 'undefined') {{
    if (!window.__llMapWaitTries) window.__llMapWaitTries = 0;
    if (window.__llMapWaitTries < 50) {{
      window.__llMapWaitTries += 1;
      window.__llMapPendingOpts = opts;
      setTimeout(function () {{
        renderMarketMap(Object.assign({{}}, window.__llMapPendingOpts || {{}}, {{ force: true }}));
      }}, 80);
      return;
    }}
    if (wrap) wrap.style.display = 'none';
    return;
  }}
  if (!marketMap && !opts.force && !window.__llMapBooted) {{
    if (window.__llMapBootScheduled) {{
      window.__llMapPendingOpts = opts;
      return;
    }}
    window.__llMapBootScheduled = true;
    window.__llMapPendingOpts = opts;
    const boot = () => {{
      window.__llMapBooted = true;
      renderMarketMap(Object.assign({{}}, window.__llMapPendingOpts || {{}}, {{ force: true }}));
    }};
    setTimeout(boot, 60);
    return;
  }}
  const picked = new Set((selectedCompMls || []).map(String));
  const counts = {{ sold: 0, active: 0, uc: 0, off: 0 }};
  const points = [];
  (TABLE || []).forEach((row) => {{
    const lat = Number(row.Latitude), lng = Number(row.Longitude);
    if (!isFinite(lat) || !isFinite(lng) || (lat === 0 && lng === 0)) return;
    const mls = String(row.MLSNumber || '');
    const status = String(row.Status || row.StatusNorm || '');
    const kind = mapKindFor(status, picked.has(mls));
    if (counts[kind] !== undefined) counts[kind]++;
    points.push({{
      lat, lng, kind, mls,
      label: String(row.Address || mls || 'Listing'),
      price: Number(row.DisplayPrice || row.SoldPrice || row.Price || 0),
      status,
    }});
  }});
  (liveComps || []).forEach((c) => {{
    const lat = Number(c.lat), lng = Number(c.lng);
    if (!isFinite(lat) || !isFinite(lng)) return;
    const mls = String(c.mls || '');
    if (points.some(p => p.mls === mls)) return;
    points.push({{
      lat, lng, kind: 'comp', mls,
      label: String(c.address || mls || 'Comp'),
      price: Number(c.sold_price || 0),
      status: 'Sold',
    }});
  }});
  const sub = DATA.subjectSnap || {{}};
  let subLat = Number(sub.lat), subLng = Number(sub.lng);
  if ((!isFinite(subLat) || !isFinite(subLng)) && points.length) {{
    subLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
    subLng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  }}
  if (isFinite(subLat) && isFinite(subLng)) {{
    points.push({{
      lat: subLat, lng: subLng, kind: 'you', mls: 'subject',
      label: String(sub.address || 'Your home'),
      price: Number(sub.rec || currentRec || 0),
      status: 'Subject',
    }});
  }}
  if (!points.length) {{
    wrap.style.display = 'none';
    return;
  }}
  wrap.style.display = '';
  const cs = document.getElementById('mapCountSold');
  if (cs) {{
    cs.textContent = counts.sold;
    document.getElementById('mapCountActive').textContent = counts.active;
    document.getElementById('mapCountUc').textContent = counts.uc;
    document.getElementById('mapCountOff').textContent = counts.off;
  }}
  document.querySelectorAll('#mapKindFilters .map-kind').forEach((b) => {{
    const k = b.dataset.kind;
    if (k in mapKindVisible) b.classList.toggle('on', !!mapKindVisible[k]);
  }});

  const colors = {{ you: '#0c3c6e', comp: '#0e7a6d', sold: '#94a3b8', active: '#c9a227', uc: '#e65100', off: '#a8a29e' }};
  const radii = {{ you: 11, comp: 8, sold: 5, active: 6, uc: 6, off: 5 }};
  const visible = points.filter((p) => mapKindVisible[p.kind] !== false);
  const geojson = {{
    type: 'FeatureCollection',
    features: visible.map((p) => ({{
      type: 'Feature',
      properties: {{
        kind: p.kind, mls: p.mls, label: p.label, price: p.price, status: p.status,
        color: colors[p.kind] || '#94a3b8',
        radius: radii[p.kind] || 5,
        opacity: (p.kind === 'sold' || p.kind === 'off') ? 0.55 : 0.92,
      }},
      geometry: {{ type: 'Point', coordinates: [p.lng, p.lat] }},
    }})),
  }};

  const portalLinks = (p) => {{
    const addr = (p.label || '').trim();
    if (!addr || p.mls === 'subject') return '';
    const q = encodeURIComponent(addr);
    const slug = addr.replace(/[^a-zA-Z0-9\\s-]/g, '').trim().replace(/[\\s_]+/g, '-');
    const style = 'display:inline-block;margin:6px 8px 2px 0;font-size:.72rem;font-weight:700;color:#0c3c6e;text-decoration:none;border:1px solid #d5e2f0;border-radius:999px;padding:3px 10px;background:#f0f5fb';
    return '<div style="margin-top:2px">' +
      '<a style="' + style + '" href="https://www.zillow.com/homes/' + q + '_rb/" target="_blank" rel="noopener">Zillow</a>' +
      '<a style="' + style + '" href="https://www.realtor.com/realestateandhomes-search/' + encodeURIComponent(slug) + '" target="_blank" rel="noopener">Realtor.com</a>' +
      '<a style="' + style + '" href="https://www.google.com/maps/search/' + q + '" target="_blank" rel="noopener">Map</a>' +
      '</div>';
  }};

  const ensureMap = () => {{
    if (marketMap) return Promise.resolve(marketMap);
    mapboxgl.accessToken = MAPBOX_TOKEN;
    marketMap = new mapboxgl.Map({{
      container: el,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [subLng || -104.77, subLat || 40.42],
      zoom: 12,
      attributionControl: true,
      cooperativeGestures: true,
    }});
    marketMap.addControl(new mapboxgl.NavigationControl({{ showCompass: false }}), 'top-right');
    marketMap.scrollZoom.disable();
    el.addEventListener('click', (e) => {{
      const btn = e.target.closest('.map-comp-btn');
      if (btn && btn.dataset.mls) toggleCompMls(btn.dataset.mls);
    }});
    document.querySelectorAll('#mapKindFilters .map-kind').forEach((b) => {{
      if (!b.dataset.llBound) {{
        b.dataset.llBound = '1';
        b.addEventListener('click', () => toggleMapKind(b.dataset.kind));
      }}
    }});
    return new Promise((resolve) => marketMap.on('load', () => resolve(marketMap)));
  }};

  ensureMap().then((map) => {{
    if (map.getSource('ll-points')) {{
      map.getSource('ll-points').setData(geojson);
    }} else {{
      map.addSource('ll-points', {{ type: 'geojson', data: geojson }});
      map.addLayer({{
        id: 'll-points-circle',
        type: 'circle',
        source: 'll-points',
        paint: {{
          'circle-radius': ['get', 'radius'],
          'circle-color': ['get', 'color'],
          'circle-opacity': ['get', 'opacity'],
          'circle-stroke-width': [
            'case', ['==', ['get', 'kind'], 'you'], 2, 1
          ],
          'circle-stroke-color': '#ffffff',
        }},
      }});
      map.on('mouseenter', 'll-points-circle', (e) => {{
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features && e.features[0];
        if (!f) return;
        const p = f.properties || {{}};
        const tipMeta = escapeHtml(p.status) + (p.price ? ' · ' + money(Number(p.price)) : '');
        if (marketHoverPopup) marketHoverPopup.remove();
        marketHoverPopup = new mapboxgl.Popup({{
          closeButton: false, closeOnClick: false, offset: 12, className: 'map-hover-tip', maxWidth: '260px',
        }})
          .setLngLat(f.geometry.coordinates)
          .setHTML('<span class="mt-addr">' + escapeHtml(p.label) + '</span><span class="mt-meta">' + tipMeta + '</span>')
          .addTo(map);
      }});
      map.on('mouseleave', 'll-points-circle', () => {{
        map.getCanvas().style.cursor = '';
        if (marketHoverPopup) {{ marketHoverPopup.remove(); marketHoverPopup = null; }}
      }});
      map.on('click', 'll-points-circle', (e) => {{
        const f = e.features && e.features[0];
        if (!f) return;
        const p = f.properties || {{}};
        if (marketHoverPopup) {{ marketHoverPopup.remove(); marketHoverPopup = null; }}
        if (p.kind === 'comp' && p.mls) {{
          const idx = liveComps.findIndex(c => String(c.mls || '') === String(p.mls));
          if (idx >= 0) {{ openCompListing(idx); return; }}
        }}
        if ((p.kind === 'sold' || p.kind === 'comp') && p.mls && p.mls !== 'subject') {{
          const isPicked = picked.has(String(p.mls));
          const tipMeta = escapeHtml(p.status) + (p.price ? ' · ' + money(Number(p.price)) : '');
          const compBtn = '<br><button type="button" class="map-comp-btn' + (isPicked ? ' in' : '') + '" data-mls="' + escapeHtml(p.mls) + '">' + (isPicked ? 'In comps · remove' : 'Use as comp') + '</button>';
          if (marketClickPopup) marketClickPopup.remove();
          marketClickPopup = new mapboxgl.Popup({{ maxWidth: '280px', offset: 14 }})
            .setLngLat(f.geometry.coordinates)
            .setHTML(
              '<strong>' + escapeHtml(p.label) + '</strong><br>' + tipMeta +
              (p.mls ? '<br>MLS ' + escapeHtml(p.mls) : '') +
              compBtn + portalLinks(p)
            )
            .addTo(map);
        }}
      }});
    }}

    try {{
      const shouldFit = opts.fit === true || (!marketMapFitted && opts.fit !== false);
      if (shouldFit && visible.length) {{
        const bounds = new mapboxgl.LngLatBounds();
        visible.forEach((p) => bounds.extend([p.lng, p.lat]));
        map.fitBounds(bounds, {{ padding: 36, maxZoom: 15, duration: 0 }});
        marketMapFitted = true;
      }}
      setTimeout(() => {{ try {{ map.resize(); }} catch (err) {{}} }}, 80);
    }} catch (err) {{}}
  }});
}}
function setCarouselSlide(carousel, idx) {{
  const slides = [...carousel.querySelectorAll('img.comp-photo')];
  if (!slides.length) return;
  const n = slides.length;
  idx = ((idx % n) + n) % n;
  carousel.dataset.slide = String(idx);
  slides.forEach((img, i) => img.classList.toggle('is-on', i === idx));
  carousel.querySelectorAll('.car-dot').forEach((d, i) => d.classList.toggle('on', i === idx));
  const count = carousel.querySelector('.car-count');
  if (count) count.textContent = (idx + 1) + ' / ' + n;
}}
function rebuildCompsFromSelection() {{
  const byMls = {{}};
  TABLE.forEach(row => {{
    const mls = String(row.MLSNumber || '');
    if (mls) byMls[mls] = row;
  }});
  const autoByMls = {{}};
  (window.__AUTO_COMPS_CACHE || []).forEach(c => {{ if (c.mls) autoByMls[String(c.mls)] = c; }});
  const isAutoSet = JSON.stringify(selectedCompMls.map(String)) === JSON.stringify(AUTO_COMP_MLS.map(String));
  liveComps = selectedCompMls.map(mls => {{
    const key = String(mls);
    if (isAutoSet && autoByMls[key]) return Object.assign({{}}, autoByMls[key], {{ auto: true, photo: photoMap[key] || autoByMls[key].photo || '', photos: autoByMls[key].photos || (photoMap[key] ? [photoMap[key]] : []) }});
    if (byMls[key]) {{
      const c = rowToComp(byMls[key]);
      c.auto = AUTO_COMP_MLS.map(String).includes(key);
      c.photo = photoMap[key] || c.photo || '';
      if (autoByMls[key] && autoByMls[key].photos && autoByMls[key].photos.length) c.photos = autoByMls[key].photos;
      else if (c.photo) c.photos = [c.photo];
      return c;
    }}
    return autoByMls[key] ? Object.assign({{}}, autoByMls[key], {{ auto: true, photo: photoMap[key] || autoByMls[key].photo || '', photos: autoByMls[key].photos || [] }}) : null;
  }}).filter(Boolean).slice(0, 8);
  DATA.comps = liveComps;
  renderLiveComps();
  renderVisualBoard();
  renderTable();
}}
function toggleCompMls(mls) {{
  mls = String(mls || '');
  if (!mls) return;
  const idx = selectedCompMls.map(String).indexOf(mls);
  if (idx >= 0) selectedCompMls.splice(idx, 1);
  else {{
    if (selectedCompMls.length >= 8) {{
      alert('Max 8 comps. Remove one first.');
      return;
    }}
    selectedCompMls.push(mls);
  }}
  rebuildCompsFromSelection();
  persistCompSelection();
}}
function persistCompSelection() {{
  try {{
    const raw = localStorage.getItem('listlogic_edits_' + (RUN_ID || 'local'));
    const payload = raw ? JSON.parse(raw) : {{}};
    payload.selectedComps = selectedCompMls.slice();
    localStorage.setItem('listlogic_edits_' + (RUN_ID || 'local'), JSON.stringify(payload));
    if (RUN_ID) {{
      fetch('/api/runs/' + RUN_ID + '/edits', {{
        method: 'POST',
        headers: {{ 'Content-Type': 'application/json' }},
        body: JSON.stringify(payload),
      }}).catch(() => {{}});
    }}
  }} catch (e) {{}}
}}
function openCompListing(idx) {{
  const c = liveComps[idx] || (DATA.comps || [])[idx];
  if (!c) return;
  const sub = DATA.subjectSnap || {{}};
  const zillow = c.zillow || ('https://www.zillow.com/homes/' + encodeURIComponent((c.address || '') + ' ' + (c.city || LINK_CITY) + ' ' + (LINK_STATE || 'CO')) + '_rb/');
  const realtor = c.realtor || ('https://www.realtor.com/realestateandhomes-search/' + encodeURIComponent((c.address || '') + ' ' + (c.city || LINK_CITY) + ' ' + (LINK_STATE || 'CO')));
  currentListingUrl = zillow;
  const photos = (c.photos && c.photos.length)
    ? c.photos.filter(Boolean)
    : ((c.photo || photoMap[String(c.mls || '')]) ? [c.photo || photoMap[String(c.mls || '')]] : []);
  const title = document.getElementById('ldTitle');
  if (title) {{ title.textContent = (c.address || 'Comp').slice(0, 56); delete title.dataset.hinted; }}
  const zBtn = document.getElementById('btnOpenZillow');
  const rBtn = document.getElementById('btnOpenRealtor');
  if (zBtn) {{ zBtn.href = zillow; }}
  if (rBtn) {{ rBtn.href = realtor; }}

  let gallery = '';
  if (photos.length) {{
    const slides = photos.map((u, i) =>
      '<img class="comp-photo' + (i === 0 ? ' is-on' : '') + '" src="' + escapeHtml(u) + '" alt="Listing photo ' + (i + 1) + '" loading="' + (i === 0 ? 'eager' : 'lazy') + '" data-slide="' + i + '">'
    ).join('');
    let nav = '';
    if (photos.length > 1) {{
      nav = '<button type="button" class="car-btn car-prev" aria-label="Previous photo">‹</button>' +
        '<button type="button" class="car-btn car-next" aria-label="Next photo">›</button>' +
        '<div class="car-count">1 / ' + photos.length + '</div>';
    }}
    const thumbs = photos.length > 1
      ? '<div class="ld-thumbs" id="ldThumbs">' + photos.map((u, i) =>
          '<button type="button" class="' + (i === 0 ? 'on' : '') + '" data-slide="' + i + '" aria-label="Photo ' + (i + 1) + '">' +
          '<img src="' + escapeHtml(u) + '" alt="" loading="lazy"></button>'
        ).join('') + '</div>'
      : '';
    gallery = '<div class="ld-gallery"><div class="ld-hero"><div class="comp-carousel" id="ldCarousel" data-slide="0">' + slides + nav + '</div></div>' + thumbs + '</div>';
  }} else {{
    gallery = '<div class="ld-gallery"><div class="ld-hero"><div class="ld-hero-empty">No listing photos for this sale</div></div></div>';
  }}

  const sold = Number(c.sold_price || 0);
  const sqft = Math.round(Number(c.living_area || 0));
  const subSqft = Math.round(Number(sub.living_area || (DATA.lf && DATA.lf.subjectSqft) || 0));
  const ppsf = Math.round(Number(c.ppsf || (sqft ? sold / sqft : 0)));
  const rec = Number(sub.rec || currentRec || 0);
  const subPpsf = Math.round(Number((subSqft && rec) ? (rec / subSqft) : 0));
  const subDom = Number(sub.dom || 0);
  const saleLot = Number(c.lot_size || 0);
  const saleAcres = Number(c.acres || 0);
  const subLot = Number(sub.lot_size || 0);
  const subAcres = Number(sub.acres || 0);
  const priceDelta = sold && rec ? sold - rec : 0;
  let takeaway = 'Use this sale as a visual and price check against your home\\u2019s specs.';
  if (sold && rec) {{
    if (Math.abs(priceDelta) < 2500) takeaway = 'Sold right around your recommended list — a strong visual comps check.';
    else if (priceDelta > 0) takeaway = 'Sold <strong>' + money(priceDelta) + ' above</strong> your recommended list. Ask: does this home look better than yours?';
    else takeaway = 'Sold <strong>' + money(Math.abs(priceDelta)) + ' below</strong> your recommended list. Ask: does yours look stronger than this sale?';
  }}

  function fmtLot(lotSf, acres) {{
    const sf = Math.round(Number(lotSf) || 0);
    const ac = Number(acres) || 0;
    if (sf > 0 && ac > 0) return sf.toLocaleString() + ' sf · ' + ac.toFixed(2) + ' ac';
    if (sf > 0) return sf.toLocaleString() + ' sf';
    if (ac > 0) return ac.toFixed(2) + ' ac';
    return '—';
  }}

  function vsRow(label, youVal, saleVal, deltaMarkup) {{
    return '<tr><td class="metric">' + label + '</td>' +
      '<td class="val you">' + youVal + '</td>' +
      '<td class="val">' + saleVal + (deltaMarkup || '') + '</td></tr>';
  }}

  document.getElementById('listingBody').innerHTML =
    gallery +
    '<div class="ld-compare-pane">' +
      '<div class="ld-addr">' + escapeHtml(c.address || 'Comp') + '</div>' +
      '<div class="ld-meta">Sold ' + escapeHtml(c.sold_date || '\\u2014') +
        (c.mls ? ' \\u00b7 MLS ' + escapeHtml(String(c.mls)) : '') +
        (c.subdivision ? ' \\u00b7 ' + escapeHtml(c.subdivision) : '') +
        (c.city ? ' \\u00b7 ' + escapeHtml(c.city) : '') + '</div>' +
      '<div class="ld-sold-line">' +
        '<div class="ld-sold">' + money(sold) + '</div>' +
        '<div class="ld-sold-note">' + (rec ? 'vs your list ' + money(rec) + ' ' + deltaHtml(sold, rec, false) : 'Sold price') + '</div>' +
      '</div>' +
      '<div class="ld-vs">Side-by-side</div>' +
      '<table class="ld-vs-table">' +
        '<colgroup><col class="c-metric"><col class="c-you"><col class="c-sale"></colgroup>' +
        '<thead><tr><th></th><th class="you">Your home</th><th>This sale</th></tr></thead>' +
        '<tbody>' +
          vsRow('List / sold', rec ? money(rec) : '—', money(sold), rec ? deltaHtml(sold, rec, false) : '') +
          vsRow('Sq ft', subSqft ? subSqft.toLocaleString() : '—', sqft ? sqft.toLocaleString() : '—', deltaHtml(c.living_area, subSqft || sub.living_area, false)) +
          vsRow('$ / sq ft', subPpsf ? ('$' + subPpsf) : '—', ppsf ? ('$' + ppsf) : '—', deltaHtml(ppsf, subPpsf, false)) +
          vsRow('Beds / baths', (sub.beds || 0) + ' / ' + (sub.baths || 0), (c.beds || 0) + ' / ' + (c.baths || 0), '') +
          vsRow('Year built', sub.year_built || '—', c.year_built || '—', '') +
          vsRow('Garage', (sub.garage || 0) ? ((sub.garage || 0) + '-car') : '—', (c.garage || 0) ? ((c.garage || 0) + '-car') : '—', '') +
          vsRow('Lot', fmtLot(subLot, subAcres), fmtLot(saleLot, saleAcres), deltaHtml(saleLot || (saleAcres * 43560), subLot || (subAcres * 43560), false)) +
          vsRow('DOM', subDom ? (Math.round(subDom) + ' days') : '—', Math.round(c.dom || 0) ? (Math.round(c.dom || 0) + ' days') : '—', '') +
        '</tbody>' +
      '</table>' +
      '<div class="ld-takeaway">' + takeaway + '</div>' +
    '</div>';
  document.getElementById('listingDrawer').classList.add('open');
  document.getElementById('listingOverlay').classList.add('open');
}}
function closeCompListing() {{
  document.getElementById('listingDrawer').classList.remove('open');
  document.getElementById('listingOverlay').classList.remove('open');
  currentListingUrl = '';
}}
document.getElementById('closeListing').onclick = closeCompListing;
document.getElementById('listingOverlay').onclick = closeCompListing;
document.addEventListener('mousedown', (e) => {{
  const drawer = document.getElementById('listingDrawer');
  if (!drawer || !drawer.classList.contains('open')) return;
  if (e.target.closest('#listingDrawer')) return;
  closeCompListing();
}});
document.addEventListener('keydown', (e) => {{
  if (e.key === 'Escape') closeCompListing();
}});
document.addEventListener('click', e => {{
  const thumb = e.target.closest('#ldThumbs button[data-slide]');
  if (thumb) {{
    const car = document.getElementById('ldCarousel');
    if (car) {{
      setCarouselSlide(car, +thumb.dataset.slide);
      document.querySelectorAll('#ldThumbs button').forEach((b, i) => b.classList.toggle('on', i === +thumb.dataset.slide));
    }}
    return;
  }}
  const car = e.target.closest('.comp-carousel');
  if (car) {{
    const cur = parseInt(car.dataset.slide || '0', 10) || 0;
    if (e.target.closest('.car-next')) {{
      setCarouselSlide(car, cur + 1);
      if (car.id === 'ldCarousel') {{
        const n = car.querySelectorAll('img.comp-photo').length;
        const next = ((cur + 1) % n + n) % n;
        document.querySelectorAll('#ldThumbs button').forEach((b, i) => b.classList.toggle('on', i === next));
      }}
      return;
    }}
    if (e.target.closest('.car-prev')) {{
      setCarouselSlide(car, cur - 1);
      if (car.id === 'ldCarousel') {{
        const n = car.querySelectorAll('img.comp-photo').length;
        const next = ((cur - 1) % n + n) % n;
        document.querySelectorAll('#ldThumbs button').forEach((b, i) => b.classList.toggle('on', i === next));
      }}
      return;
    }}
    const dot = e.target.closest('.car-dot');
    if (dot && dot.dataset.slide != null) {{
      setCarouselSlide(car, +dot.dataset.slide);
      if (car.id === 'ldCarousel') {{
        document.querySelectorAll('#ldThumbs button').forEach((b, i) => b.classList.toggle('on', i === +dot.dataset.slide));
      }}
      return;
    }}
    // Clicking the photo (not controls) opens the detail for rail cards
    if (car.closest('.comp-card') && !car.closest('.listing-drawer') && !e.target.closest('.car-btn,.car-dot,.car-dots')) {{
      const card = car.closest('.comp-card[data-comp-idx]');
      if (card) openCompListing(+card.dataset.compIdx);
      return;
    }}
  }}
  const card = e.target.closest('.comp-card[data-comp-idx]');
  if (card && !e.target.closest('.car-btn,.car-dot,.car-dots,.comp-remove')) {{
    openCompListing(+card.dataset.compIdx);
    return;
  }}
  const tr = e.target.closest('#compTableBody tr[data-comp-idx]');
  if (tr) {{
    openCompListing(+tr.dataset.compIdx);
    return;
  }}
  const rem = e.target.closest('.comp-remove');
  if (rem && rem.dataset.mls) toggleCompMls(rem.dataset.mls);
  const pick = e.target.closest('.btn-as-comp');
  if (pick && pick.dataset.mls) toggleCompMls(pick.dataset.mls);
}});
const btnClosePhotoModal = document.getElementById('btnClosePhotoModal');
const photoModalBackdrop = document.getElementById('photoModalBackdrop');
if (btnClosePhotoModal) btnClosePhotoModal.onclick = closePhotoModal;
if (photoModalBackdrop) photoModalBackdrop.onclick = closePhotoModal;
const btnSavePhotoUrl = document.getElementById('btnSavePhotoUrl');
if (btnSavePhotoUrl) {{
  btnSavePhotoUrl.onclick = async () => {{
    const input = document.getElementById('photoUrlInput');
    const url = (input && input.value || '').trim();
    if (!photoModalMls) return;
    if (url && !/^https?:\\/\\//i.test(url) && !url.startsWith('/runs/') && !url.startsWith('data:')) {{
      alert('Paste a full https:// photo URL (from Matrix: Copy image address).');
      return;
    }}
    await savePhotoForMls(photoModalMls, url);
    closePhotoModal();
  }};
}}
const btnClearPhoto = document.getElementById('btnClearPhoto');
if (btnClearPhoto) {{
  btnClearPhoto.onclick = async () => {{
    if (!photoModalMls) return;
    await savePhotoForMls(photoModalMls, '');
    closePhotoModal();
  }};
}}
const photoFileInput = document.getElementById('photoFileInput');
if (photoFileInput) {{
  photoFileInput.onchange = async () => {{
    const file = photoFileInput.files && photoFileInput.files[0];
    if (!file || !photoModalMls) return;
    const ok = await uploadPhotoForMls(photoModalMls, file);
    photoFileInput.value = '';
    if (ok) closePhotoModal();
  }};
}}
const btnSaveSubjectPhoto = document.getElementById('btnSaveSubjectPhoto');
if (btnSaveSubjectPhoto) {{
  btnSaveSubjectPhoto.onclick = async () => {{
    const input = document.getElementById('editSubjectPhoto');
    await savePhotoForMls(SUBJECT_PHOTO_KEY, (input && input.value || '').trim());
  }};
}}
const subjectPhotoFile = document.getElementById('subjectPhotoFile');
if (subjectPhotoFile) {{
  subjectPhotoFile.onchange = async () => {{
    const file = subjectPhotoFile.files && subjectPhotoFile.files[0];
    if (!file) return;
    const ok = await uploadPhotoForMls(SUBJECT_PHOTO_KEY, file);
    subjectPhotoFile.value = '';
    if (ok) {{
      const input = document.getElementById('editSubjectPhoto');
      if (input) input.value = photoMap[SUBJECT_PHOTO_KEY] || '';
    }}
  }};
}}
document.addEventListener('keydown', e => {{
  if (e.key === 'Escape') {{
    closePhotoModal();
    closeCompListing();
  }}
}});
const btnCompTable = document.getElementById('btnCompTable');
if (btnCompTable) {{
  btnCompTable.onclick = () => {{
    const wrap = document.getElementById('compTableWrap');
    wrap.classList.toggle('open');
    btnCompTable.textContent = wrap.classList.contains('open') ? 'Hide table view' : 'Show table view';
  }};
}}
const btnResetComps = document.getElementById('btnResetComps');
if (btnResetComps) {{
  btnResetComps.onclick = () => {{
    selectedCompMls = [...AUTO_COMP_MLS];
    liveComps = (window.__AUTO_COMPS_CACHE || []).map(c => Object.assign({{}}, c, {{ auto: true, photo: photoMap[String(c.mls || '')] || c.photo || '', photos: c.photos || [] }}));
    DATA.comps = liveComps;
    renderLiveComps();
    renderTable();
    persistCompSelection();
  }};
}}
window.__AUTO_COMPS_CACHE = (DATA.comps || []).map(c => Object.assign({{}}, c, {{ auto: true }}));
fetchPhotoMap();
const btnJumpFullData = document.getElementById('btnJumpFullData');
if (btnJumpFullData) {{
  btnJumpFullData.onclick = () => jumpToMarketSearch('', 'Sold');
}}
const btnCompFind = document.getElementById('btnCompFind');
const compFindInput = document.getElementById('compFindInput');
function runCompFind() {{
  const q = (compFindInput && compFindInput.value || '').trim();
  jumpToMarketSearch(q, q ? '' : 'Sold');
}}
if (btnCompFind) btnCompFind.onclick = runCompFind;
if (compFindInput) {{
  compFindInput.addEventListener('keydown', e => {{ if (e.key === 'Enter') {{ e.preventDefault(); runCompFind(); }} }});
}}
let sortCol = null, sortDir = 1;
function propLinks(row) {{
  const addr = encodeURIComponent((row.Address||'') + ' ' + LINK_CITY + ' ' + LINK_STATE);
  return '<a class="link" href="https://www.zillow.com/homes/'+addr+'_rb/" target="_blank" rel="noopener">Z</a>'+
    '<a class="link" href="https://www.realtor.com/realestateandhomes-search/'+addr+'" target="_blank" rel="noopener">R</a>'+
    '<a class="link" href="https://www.google.com/search?q='+addr+'" target="_blank" rel="noopener">G</a>';
}}
function statusPill(st) {{ return '<span class="status-pill st-'+(st||'').replace(/\\s/g,'')+'">'+(st||'')+'</span>'; }}
function fmtCell(col,row) {{
  const v = row[col];
  if (v===null||v===undefined||v==='') return '';
  if (col==='Status') return statusPill(v);
  if (col==='MLSNumber') return propLinks(row)+' '+v;
  if (['DisplayPrice','SoldPrice','Price','PPSF'].includes(col) && !isNaN(v)) return '$'+Number(v).toLocaleString(undefined,{{maximumFractionDigits:0}});
  if (['LivingArea','DOM','YearBuilt','Garage','Beds','Baths'].includes(col) && !isNaN(v)) return Number(v).toLocaleString(undefined,{{maximumFractionDigits:1}});
  return String(v).slice(0,40);
}}
function rowBlob(row) {{
  return [
    row.MLSNumber, row.Address, row.Subdivision, row.City, row.Status, row.StatusNorm,
    row.YearBuilt, row.Beds, row.Baths, row.Garage, row.LivingArea, row.DisplayPrice, row.SoldPrice
  ].map(v => (v == null ? '' : String(v))).join(' ').toLowerCase();
}}
function parseSearchQuery(raw) {{
  const q = (raw || '').trim().toLowerCase();
  if (!q) return {{ tokens: [], mlsList: [] }};
  const parts = q.split(/[,;\\s]+/).map(p => p.trim()).filter(Boolean);
  const mlsList = parts.filter(p => /^[a-z0-9-]{{4,}}$/i.test(p) && /\\d/.test(p));
  const mlsMode = mlsList.length >= 1 && mlsList.length === parts.length;
  return {{ tokens: mlsMode ? [] : parts, mlsList: mlsMode ? mlsList : [] }};
}}
function rowMatchesSearch(row, parsed) {{
  if (parsed.mlsList.length) {{
    const mls = String(row.MLSNumber || '').toLowerCase();
    return parsed.mlsList.some(m => mls.includes(m));
  }}
  if (!parsed.tokens.length) return true;
  const blob = rowBlob(row);
  return parsed.tokens.every(t => blob.includes(t));
}}
function rowPrice(row) {{
  const n = Number(row.DisplayPrice != null ? row.DisplayPrice : (row.SoldPrice != null ? row.SoldPrice : row.Price));
  return isFinite(n) ? n : null;
}}
function setUsedSortActive(on) {{
  const btn = document.getElementById('btnSortUsed');
  if (btn) btn.classList.toggle('on', !!on);
}}
function sortUsedCompsFirst() {{
  sortCol = '__comp__';
  sortDir = -1; // picked first
  setUsedSortActive(true);
  renderTable();
}}
function renderTable() {{
  const head = document.getElementById('dataHead'), body = document.getElementById('dataBody');
  if (!head || !body) return;
  const searchEl = document.getElementById('dataSearch');
  const clearBtn = document.getElementById('btnClearSearch');
  const qRaw = searchEl ? searchEl.value : '';
  if (clearBtn) clearBtn.style.display = qRaw.trim() ? '' : 'none';
  const parsed = parseSearchQuery(qRaw);
  const st = document.getElementById('statusFilter').value;
  const bedsEl = document.getElementById('bedsFilter');
  const garEl = document.getElementById('garageFilter');
  const pMinEl = document.getElementById('priceMin');
  const pMaxEl = document.getElementById('priceMax');
  const bedsMin = +(bedsEl && bedsEl.value || 0);
  const garMin = +(garEl && garEl.value || 0);
  const pMin = +(pMinEl && pMinEl.value || 0);
  const pMax = +(pMaxEl && pMaxEl.value || 0);
  const picked = new Set(selectedCompMls.map(String));
  setUsedSortActive(sortCol === '__comp__');
  const compInd = sortCol === '__comp__' ? '<span class="sort-ind">' + (sortDir === 1 ? '\\u25b2' : '\\u25bc') + '</span>' : '';
  head.innerHTML = '<th></th><th data-sort="__comp__" title="Click to sort used comps to the top">Comp' + compInd + '</th>' + visibleCols.map(c => {{
    const ind = c === sortCol ? '<span class="sort-ind">' + (sortDir === 1 ? '\\u25b2' : '\\u25bc') + '</span>' : '';
    return '<th data-sort="'+c+'">'+c+ind+'</th>';
  }}).join('');
  let rows = TABLE.map((row, i) => [row, i]);
  if (sortCol) {{
    rows.sort((a, b) => {{
      if (sortCol === '__comp__') {{
        const pa = picked.has(String(a[0].MLSNumber || '')) ? 1 : 0;
        const pb = picked.has(String(b[0].MLSNumber || '')) ? 1 : 0;
        if (pa !== pb) return (pa - pb) * sortDir;
        return 0;
      }}
      const va = a[0][sortCol], vb = b[0][sortCol];
      const ea = va===null||va===undefined||va==='', eb = vb===null||vb===undefined||vb==='';
      if (ea && eb) return 0; if (ea) return 1; if (eb) return -1;
      const na = Number(va), nb = Number(vb);
      if (!isNaN(na) && !isNaN(nb)) return (na - nb) * sortDir;
      return String(va).localeCompare(String(vb), undefined, {{ sensitivity: 'base' }}) * sortDir;
    }});
  }}
  let html='', shown=0, on=0;
  rows.forEach(([row, i]) => {{
    if (st && row.Status!==st && row.StatusNorm!==st) return;
    if (!rowMatchesSearch(row, parsed)) return;
    if (bedsMin && !(Number(row.Beds) >= bedsMin)) return;
    if (garMin && !(Number(row.Garage) >= garMin)) return;
    const price = rowPrice(row);
    if (pMin && (price == null || price < pMin)) return;
    if (pMax && (price == null || price > pMax)) return;
    const isEx = excluded.has(String(i));
    if (!isEx) on++; shown++;
    const mls = String(row.MLSNumber || '');
    const isSold = (row.StatusNorm || row.Status) === 'Sold';
    const isPick = picked.has(mls);
    const pickBtn = isSold && mls
      ? '<button type="button" class="btn-as-comp' + (isPick ? ' on' : '') + '" data-mls="' + escapeHtml(mls) + '" title="' + (isPick ? 'Remove from comps' : 'Add to Closest comps') + '">' + (isPick ? 'In comps · remove' : 'Use as comp') + '</button>'
      : '<span class="muted">—</span>';
    html += '<tr class="'+(isEx?'excluded':'')+(isPick?' comp-picked':'')+'" data-idx="'+i+'"><td><input type="checkbox" class="comp-check" data-idx="'+i+'" '+(isEx?'':'checked')+'></td>'+
      '<td>'+pickBtn+'</td>'+
      visibleCols.map(c => '<td>'+fmtCell(c,row)+'</td>').join('')+'</tr>';
  }});
  body.innerHTML = html || '<tr><td colspan="'+(visibleCols.length+2)+'" style="padding:18px;color:#5a6a7c">No homes match that search. Clear filters or try MLS # / address.</td></tr>';
  document.getElementById('includeCount').textContent = shown + ' shown · ' + on + ' included · ' + TABLE.length + ' total' + (picked.size ? (' · ' + picked.size + ' comps') : '');
  const hint = document.getElementById('dataHint');
  if (hint) {{
    hint.innerHTML = shown === TABLE.length
      ? 'Tip: paste one or more MLS numbers separated by commas or spaces. Dark buttons = currently used as comps (click to remove).'
      : 'Showing <strong>' + shown + '</strong> of ' + TABLE.length + ' homes' + (parsed.mlsList.length ? ' · MLS match' : '') + (picked.size ? ' · <strong>' + picked.size + '</strong> used as comps' : '');
  }}
  const excl = document.getElementById('exclCount');
  if (excl) excl.textContent = excluded.size;
}}
function setFulldataCollapsed(collapsed) {{
  const body = document.getElementById('fulldataBody');
  const btn = document.getElementById('btnToggleFulldata');
  const head = document.getElementById('fulldataHead');
  if (!body) return;
  body.classList.toggle('collapsed', !!collapsed);
  if (btn) {{
    btn.textContent = collapsed ? 'Expand' : 'Collapse';
    btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  }}
  if (head) head.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
}}
(function wireFulldataCollapse() {{
  const btn = document.getElementById('btnToggleFulldata');
  const head = document.getElementById('fulldataHead');
  if (btn) {{
    btn.addEventListener('click', e => {{
      e.stopPropagation();
      const body = document.getElementById('fulldataBody');
      setFulldataCollapsed(!(body && body.classList.contains('collapsed')));
    }});
  }}
  if (head) {{
    head.addEventListener('click', e => {{
      if (e.target.closest('button, a, input, select, label')) return;
      const body = document.getElementById('fulldataBody');
      setFulldataCollapsed(!(body && body.classList.contains('collapsed')));
    }});
    head.addEventListener('keydown', e => {{
      if (e.key === 'Enter' || e.key === ' ') {{
        e.preventDefault();
        const body = document.getElementById('fulldataBody');
        setFulldataCollapsed(!(body && body.classList.contains('collapsed')));
      }}
    }});
  }}
  const sortUsed = document.getElementById('btnSortUsed');
  if (sortUsed) sortUsed.addEventListener('click', sortUsedCompsFirst);
}})();
document.getElementById('dataHead').addEventListener('click', e => {{
  const th = e.target.closest('th[data-sort]');
  if (!th) return;
  const col = th.dataset.sort;
  if (sortCol === col) {{ sortDir = -sortDir; }}
  else {{ sortCol = col; sortDir = (col === '__comp__') ? -1 : 1; }}
  setUsedSortActive(sortCol === '__comp__');
  renderTable();
}});
document.getElementById('colGrid').addEventListener('change', e => {{
  if (!e.target.matches('input[data-col]')) return;
  const col = e.target.dataset.col;
  if (e.target.checked) {{ if (!visibleCols.includes(col)) visibleCols.push(col); }}
  else visibleCols = visibleCols.filter(c => c !== col);
  renderTable();
}});
document.getElementById('btnCols').onclick = () => document.getElementById('colPicker').classList.toggle('open');
function bindFilter(id, evt) {{
  const el = document.getElementById(id);
  if (el) el.addEventListener(evt, renderTable);
}}
bindFilter('dataSearch', 'input');
bindFilter('statusFilter', 'change');
bindFilter('bedsFilter', 'change');
bindFilter('garageFilter', 'change');
bindFilter('priceMin', 'input');
bindFilter('priceMax', 'input');
const btnClearSearch = document.getElementById('btnClearSearch');
if (btnClearSearch) {{
  btnClearSearch.onclick = () => {{
    document.getElementById('dataSearch').value = '';
    const beds = document.getElementById('bedsFilter'); if (beds) beds.value = '';
    const gar = document.getElementById('garageFilter'); if (gar) gar.value = '';
    const pmin = document.getElementById('priceMin'); if (pmin) pmin.value = '';
    const pmax = document.getElementById('priceMax'); if (pmax) pmax.value = '';
    renderTable();
    document.getElementById('dataSearch').focus();
  }};
}}
function jumpToMarketSearch(query, status) {{
  const el = document.getElementById('spine-fulldata');
  if (el) el.scrollIntoView({{ behavior: 'smooth', block: 'start' }});
  const sf = document.getElementById('statusFilter');
  if (sf && status != null) sf.value = status;
  const search = document.getElementById('dataSearch');
  if (search && query != null) {{
    search.value = query;
    setTimeout(() => search.focus(), 350);
  }}
  renderTable();
}}
document.getElementById('dataBody').addEventListener('change', e => {{
  if (!e.target.classList.contains('comp-check')) return;
  const i = e.target.dataset.idx;
  if (e.target.checked) excluded.delete(i); else excluded.add(i);
  e.target.closest('tr').classList.toggle('excluded', !e.target.checked);
  document.getElementById('exclCount').textContent = excluded.size;
}});
document.getElementById('checkAll').onclick = () => {{ excluded.clear(); renderTable(); }};
document.getElementById('checkNone').onclick = () => {{ document.querySelectorAll('#dataBody tr').forEach(tr => excluded.add(tr.dataset.idx)); renderTable(); }};
renderTable();
syncCompToolbar();

function renderObjections(text) {{
  /* Coach notes stay in Agent tools only — not rendered on the seller deck. */
  void text;
}}

const panel = document.getElementById('panel'), overlay = document.getElementById('overlay'), fab = document.getElementById('fab');
const agentMenu = document.getElementById('agentMenu');
function closeAgentMenu() {{
  if (!agentMenu || !fab) return;
  agentMenu.classList.remove('open');
  agentMenu.hidden = true;
  fab.classList.remove('menu-open');
  fab.setAttribute('aria-expanded', 'false');
}}
function toggleAgentMenu() {{
  if (!agentMenu || !fab) return;
  const open = !agentMenu.classList.contains('open');
  if (open) {{
    agentMenu.hidden = false;
    agentMenu.classList.add('open');
    fab.classList.add('menu-open');
    fab.setAttribute('aria-expanded', 'true');
  }} else {{
    closeAgentMenu();
  }}
}}
function openAgentPanel() {{
  closeAgentMenu();
  panel.classList.add('open');
  overlay.classList.add('open');
  fab.classList.add('panel-open');
}}
function closeAgentPanel() {{
  panel.classList.remove('open');
  overlay.classList.remove('open');
  fab.classList.remove('panel-open');
}}
fab.onclick = (e) => {{ e.stopPropagation(); toggleAgentMenu(); }};
document.getElementById('menuOpenTools')?.addEventListener('click', () => openAgentPanel());
document.getElementById('menuSections')?.addEventListener('click', () => {{
  closeAgentMenu();
  const modal = document.getElementById('sectionsModal');
  if (modal) {{ modal.hidden = false; modal.classList.add('open'); }}
}});
function closeSectionsModal() {{
  const modal = document.getElementById('sectionsModal');
  if (modal) {{ modal.classList.remove('open'); modal.hidden = true; }}
}}
document.getElementById('closeSections')?.addEventListener('click', closeSectionsModal);
document.getElementById('sectionsBackdrop')?.addEventListener('click', closeSectionsModal);
function applySectionVisibility(hidden) {{
  const hide = new Set((hidden || []).map(String));
  document.querySelectorAll('#sectionsList input[data-section]').forEach((inp) => {{
    const id = inp.dataset.section;
    const on = !hide.has(id);
    inp.checked = on;
    const sec = document.getElementById(id);
    if (sec) sec.classList.toggle('section-hidden', !on);
    const spine = document.querySelector('#spine a[href="#' + id + '"]');
    if (spine) spine.classList.toggle('spine-dim', !on);
  }});
}}
function persistSections() {{
  const hidden = [...document.querySelectorAll('#sectionsList input[data-section]')]
    .filter((inp) => !inp.checked).map((inp) => inp.dataset.section);
  try {{
    const raw = localStorage.getItem('listlogic_edits_' + (RUN_ID || 'local'));
    const payload = raw ? JSON.parse(raw) : {{}};
    payload.hiddenSections = hidden;
    localStorage.setItem('listlogic_edits_' + (RUN_ID || 'local'), JSON.stringify(payload));
    if (RUN_ID) {{
      fetch('/api/runs/' + RUN_ID + '/edits', {{
        method: 'POST',
        headers: {{ 'Content-Type': 'application/json' }},
        body: JSON.stringify(payload),
      }}).catch(() => {{}});
    }}
  }} catch (e) {{}}
}}
document.getElementById('sectionsList')?.addEventListener('change', (e) => {{
  const inp = e.target.closest('input[data-section]');
  if (!inp) return;
  const sec = document.getElementById(inp.dataset.section);
  if (sec) sec.classList.toggle('section-hidden', !inp.checked);
  const spine = document.querySelector('#spine a[href="#' + inp.dataset.section + '"]');
  if (spine) spine.classList.toggle('spine-dim', !inp.checked);
  persistSections();
}});
document.getElementById('btnResetSections')?.addEventListener('click', () => {{
  document.querySelectorAll('#sectionsList input[data-section]').forEach((inp) => {{ inp.checked = true; }});
  applySectionVisibility([]);
  persistSections();
}});
document.getElementById('menuSignOut')?.addEventListener('click', async () => {{
  try {{ await fetch('/api/logout', {{ method: 'POST', credentials: 'same-origin' }}); }} catch (err) {{}}
  location.href = '/saas/login.html';
}});
fetch('/api/auth-status', {{ credentials: 'same-origin' }})
  .then(r => r.json())
  .then(data => {{
    // Gate the floating agent account chip: only show it to logged-in users.
    // Public/shared (seller) viewers should never see edit/sections/sign-out.
    const menuWrap = document.getElementById('agentMenuWrap');
    const authed = !!(data && data.authenticated && data.user);
    if (!authed) {{
      if (menuWrap) menuWrap.style.display = 'none';
      return;
    }}
    if (menuWrap) menuWrap.classList.add('ll-shown');
    enableInlineEdits();
    loadAccountCopyDefaults();
    const appNav = document.getElementById('reportAppNav');
    if (appNav) appNav.hidden = false;
    const teamLink = document.getElementById('reportNavTeam');
    if (teamLink && data.user.is_brokerage_owner) teamLink.hidden = false;
    if (!(data?.user?.role === 'admin')) return;
    let adminLink = document.getElementById('menuAdminLink');
    if (!adminLink) {{
      const menu = document.getElementById('agentMenu');
      const signOut = document.getElementById('menuSignOut');
      if (menu && signOut) {{
        adminLink = document.createElement('a');
        adminLink.href = '/saas/admin.html';
        adminLink.id = 'menuAdminLink';
        adminLink.setAttribute('role', 'menuitem');
        adminLink.innerHTML = '<span class="mi-ico">⚙</span><span class="mi-copy"><strong>Admin</strong><span>Users, reports &amp; feedback</span></span>';
        menu.insertBefore(adminLink, signOut);
      }}
    }}
    if (adminLink) adminLink.hidden = false;
    const ownerNav = document.getElementById('reportNavOwner');
    if (ownerNav) ownerNav.hidden = false;
  }})
  .catch(() => {{}});
document.addEventListener('click', (e) => {{
  const wrap = document.getElementById('agentMenuWrap');
  if (wrap && !wrap.contains(e.target)) closeAgentMenu();
}});
document.addEventListener('keydown', (e) => {{
  if (e.key === 'Escape') {{ closeAgentMenu(); closeAgentPanel(); }}
}});
document.getElementById('closePanel').onclick = overlay.onclick = closeAgentPanel;
function collectLedes() {{
  return {{
    comps: (document.getElementById('editLedeComps') || {{}}).value || '',
    condition: (document.getElementById('editLedeCondition') || {{}}).value || '',
    close: (document.getElementById('editLedeClose') || {{}}).value || '',
  }};
}}
function applyLedesToDom(ledes) {{
  if (!ledes) return;
  document.querySelectorAll('[data-lede]').forEach(el => {{
    const key = el.getAttribute('data-lede');
    if (ledes[key]) el.textContent = ledes[key];
  }});
}}
function enableInlineEdits() {{
  document.body.classList.add('ll-agent');
  const mark = (el) => {{ if (el) {{ el.contentEditable = 'true'; el.spellcheck = true; }} }};
  document.querySelectorAll('[data-lede], [data-edit]').forEach(mark);
  document.querySelectorAll('#advList li, #riskList li').forEach(mark);
  if (document.body.dataset.inlineEdits === '1') return;
  document.body.dataset.inlineEdits = '1';
  document.addEventListener('focusin', (e) => {{
    if (e.target && e.target.id === 'blText') {{
      const editBL = document.getElementById('editBL');
      if (editBL) editBL.dataset.manual = '1';
    }}
  }});
  document.addEventListener('focusout', (e) => {{
    const t = e.target;
    if (!t) return;
    if (t.id === 'blText' && document.getElementById('editBL')) document.getElementById('editBL').value = t.textContent.trim();
    if (t.getAttribute && t.getAttribute('data-lede')) {{
      const key = t.getAttribute('data-lede');
      const map = {{ comps: 'editLedeComps', condition: 'editLedeCondition', close: 'editLedeClose' }};
      const inp = document.getElementById(map[key]);
      if (inp) inp.value = t.textContent.trim();
    }}
    if (t.closest && t.closest('#advList')) {{
      document.getElementById('editAdv').value = [...document.querySelectorAll('#advList li')].map(li => li.textContent.trim()).join('\\n');
    }}
    if (t.closest && t.closest('#riskList')) {{
      document.getElementById('editRisk').value = [...document.querySelectorAll('#riskList li')].map(li => li.textContent.trim()).join('\\n');
    }}
    if (t.closest && t.closest('[data-lede], [data-edit], #advList, #riskList')) persistStoryEdits();
  }});
}}
async function loadAccountCopyDefaults() {{
  try {{
    const res = await fetch('/api/profile/copy', {{ credentials: 'same-origin' }});
    if (!res.ok) return;
    const data = await res.json();
    const copy = data.copy_defaults || {{}};
    if (document.getElementById('editExtraAdv')) document.getElementById('editExtraAdv').value = (copy.extraAdv || []).join('\\n');
    if (document.getElementById('editExtraRisk')) document.getElementById('editExtraRisk').value = (copy.extraRisk || []).join('\\n');
    if (copy.ledes && !document.getElementById('editLedeComps')?.value) {{
      if (copy.ledes.comps) document.getElementById('editLedeComps').value = copy.ledes.comps;
      if (copy.ledes.condition) document.getElementById('editLedeCondition').value = copy.ledes.condition;
      if (copy.ledes.close) document.getElementById('editLedeClose').value = copy.ledes.close;
    }}
  }} catch (e) {{}}
}}
function persistStoryEdits() {{
  const rec = +document.getElementById('editRec').value;
  const low = +document.getElementById('editLow').value;
  const high = +document.getElementById('editHigh').value;
  const dom = +document.getElementById('editDom').value;
  const bl = document.getElementById('editBL').value;
  const adv = document.getElementById('editAdv').value.trim().split('\\n').filter(Boolean);
  const risk = document.getElementById('editRisk').value.trim().split('\\n').filter(Boolean);
  const obj = document.getElementById('editObj').value;
  const ledes = collectLedes();
  const payload = {{ rec, low, high, dom, bl, adv: adv.join('\\n'), risk: risk.join('\\n'), obj, ledes, rating: currentRating, excluded:[...excluded], selectedComps: selectedCompMls.slice() }};
  try {{
    const prev = JSON.parse(localStorage.getItem('listlogic_edits_'+(RUN_ID||'local')) || '{{}}');
    if (prev.netSheet) payload.netSheet = prev.netSheet;
    if (prev.hiddenSections) payload.hiddenSections = prev.hiddenSections;
  }} catch (e) {{}}
  localStorage.setItem('listlogic_edits_'+(RUN_ID||'local'), JSON.stringify(payload));
  if (RUN_ID) {{
    fetch('/api/runs/'+RUN_ID+'/edits', {{ method:'POST', headers:{{'Content-Type':'application/json'}}, credentials:'same-origin', body: JSON.stringify(payload) }}).catch(()=>{{}});
  }}
  return {{ rec, low, high, dom, bl, adv, risk, obj, ledes }};
}}
function refreshDeckHtml() {{
  if (!RUN_ID) return;
  fetch('/api/runs/'+RUN_ID+'/refresh-deck', {{ method:'POST', credentials:'same-origin' }}).catch(()=>{{}});
}}
function applyEdits() {{
  const rec = +document.getElementById('editRec').value;
  const low = +document.getElementById('editLow').value;
  const high = +document.getElementById('editHigh').value;
  const dom = +document.getElementById('editDom').value;
  const bl = document.getElementById('editBL').value;
  const adv = document.getElementById('editAdv').value.trim().split('\\n').filter(Boolean);
  const risk = document.getElementById('editRisk').value.trim().split('\\n').filter(Boolean);
  const obj = document.getElementById('editObj').value;
  setVerdict(rec, low, high, dom);
  document.getElementById('blText').textContent = bl;
  document.getElementById('advList').innerHTML = adv.map(a => '<li>'+escapeHtml(a)+'</li>').join('');
  document.getElementById('riskList').innerHTML = risk.map(r => '<li>'+escapeHtml(r)+'</li>').join('');
  if (document.body.classList.contains('ll-agent')) {{
    document.querySelectorAll('#advList li, #riskList li').forEach(el => {{ el.contentEditable = 'true'; }});
  }}
  applyLedesToDom(collectLedes());
  renderObjections(obj);
  persistStoryEdits();
  const opts = arguments[0] || {{}};
  if (opts.refreshDeck !== false) refreshDeckHtml();
  if (opts.close !== false) closeAgentPanel();
}}
document.getElementById('btnApply').onclick = () => applyEdits();
document.getElementById('btnSaveDefaults')?.addEventListener('click', async () => {{
  const toast = document.getElementById('storyToast');
  const setToast = (msg) => {{ if (toast) toast.textContent = msg; }};
  setToast('Saving account defaults…');
  try {{
    const res = await fetch('/api/profile/copy', {{
      method: 'POST',
      credentials: 'same-origin',
      headers: {{ 'Content-Type': 'application/json' }},
      body: JSON.stringify({{
        ledes: collectLedes(),
        extraAdv: (document.getElementById('editExtraAdv') || {{}}).value || '',
        extraRisk: (document.getElementById('editExtraRisk') || {{}}).value || '',
        coachTemplates: (document.getElementById('editObj') || {{}}).value || '',
      }}),
    }});
    if (!res.ok) throw new Error('Sign in to save account defaults');
    setToast('Saved for future reports. This listing’s bottom line was not copied.');
  }} catch (err) {{
    setToast(String(err.message || err));
  }}
}});
document.getElementById('btnResetDefaults')?.addEventListener('click', async () => {{
  const toast = document.getElementById('storyToast');
  const setToast = (msg) => {{ if (toast) toast.textContent = msg; }};
  setToast('Resetting account defaults…');
  try {{
    const res = await fetch('/api/profile/copy', {{
      method: 'POST',
      credentials: 'same-origin',
      headers: {{ 'Content-Type': 'application/json' }},
      body: JSON.stringify({{ ledes: {{}}, extraAdv: [], extraRisk: [], coachTemplates: '' }}),
    }});
    if (!res.ok) throw new Error('Sign in to reset account defaults');
    if (document.getElementById('editExtraAdv')) document.getElementById('editExtraAdv').value = '';
    if (document.getElementById('editExtraRisk')) document.getElementById('editExtraRisk').value = '';
    if (defaults.ledes) {{
      if (document.getElementById('editLedeComps')) document.getElementById('editLedeComps').value = defaults.ledes.comps || '';
      if (document.getElementById('editLedeCondition')) document.getElementById('editLedeCondition').value = defaults.ledes.condition || '';
      if (document.getElementById('editLedeClose')) document.getElementById('editLedeClose').value = defaults.ledes.close || '';
    }}
    setToast('Account wording cleared. New reports use ListLogic copy. This listing is unchanged until you Apply or Reset this listing.');
  }} catch (err) {{
    setToast(String(err.message || err));
  }}
}});
document.getElementById('btnReset').onclick = () => {{
  const editBL = document.getElementById('editBL');
  if (editBL) delete editBL.dataset.manual;
  document.getElementById('editRec').value = defaults.rec;
  document.getElementById('editLow').value = defaults.low;
  document.getElementById('editHigh').value = defaults.high;
  document.getElementById('editDom').value = defaults.dom;
  document.getElementById('editBL').value = defaults.bl;
  document.getElementById('editAdv').value = defaults.adv;
  document.getElementById('editRisk').value = defaults.risk;
  document.getElementById('editObj').value = defaults.obj;
  if (defaults.ledes) {{
    if (document.getElementById('editLedeComps')) document.getElementById('editLedeComps').value = defaults.ledes.comps || '';
    if (document.getElementById('editLedeCondition')) document.getElementById('editLedeCondition').value = defaults.ledes.condition || '';
    if (document.getElementById('editLedeClose')) document.getElementById('editLedeClose').value = defaults.ledes.close || '';
  }}
  excluded.clear();
  selectedCompMls = [...AUTO_COMP_MLS];
  if (window.__AUTO_COMPS_CACHE) {{
    liveComps = window.__AUTO_COMPS_CACHE.map(c => Object.assign({{}}, c));
    DATA.comps = liveComps;
    renderLiveComps();
  }}
  renderTable(); applyRating(5); applyEdits();
}};

async function loadSavedEdits() {{
  let saved = null;
  if (RUN_ID) {{ try {{ const res = await fetch('/api/runs/'+RUN_ID+'/edits'); if (res.ok) saved = await res.json(); }} catch(e) {{}} }}
  if (!saved || !Object.keys(saved).length) {{
    try {{ saved = JSON.parse(localStorage.getItem('listlogic_edits_'+(RUN_ID||'local')) || 'null'); }} catch(e) {{ saved = null; }}
  }}
  if (!saved || !Object.keys(saved).length) return;
  if (saved.rec!=null) document.getElementById('editRec').value = saved.rec;
  if (saved.low!=null) document.getElementById('editLow').value = saved.low;
  if (saved.high!=null) document.getElementById('editHigh').value = saved.high;
  if (saved.dom!=null) document.getElementById('editDom').value = saved.dom;
  if (saved.bl!=null) document.getElementById('editBL').value = saved.bl;
  if (saved.adv!=null) document.getElementById('editAdv').value = saved.adv;
  if (saved.risk!=null) document.getElementById('editRisk').value = saved.risk;
  if (saved.obj!=null) document.getElementById('editObj').value = saved.obj;
  if (saved.ledes && typeof saved.ledes === 'object') {{
    if (saved.ledes.comps!=null && document.getElementById('editLedeComps')) document.getElementById('editLedeComps').value = saved.ledes.comps;
    if (saved.ledes.condition!=null && document.getElementById('editLedeCondition')) document.getElementById('editLedeCondition').value = saved.ledes.condition;
    if (saved.ledes.close!=null && document.getElementById('editLedeClose')) document.getElementById('editLedeClose').value = saved.ledes.close;
  }}
  if (Array.isArray(saved.excluded)) saved.excluded.forEach(i => excluded.add(String(i)));
  if (Array.isArray(saved.selectedComps) && saved.selectedComps.length) {{
    selectedCompMls = saved.selectedComps.map(String);
    rebuildCompsFromSelection();
  }}
  if (saved.rating!=null) applyRating(+saved.rating);
  if (saved.netSheet && typeof saved.netSheet === 'object') {{
    const ns = saved.netSheet;
    const setNet = (id, v) => {{ if (v != null && v !== '') document.getElementById(id).value = v; }};
    setNet('netSellerFeePct', ns.sellerFeePct);
    setNet('netBuyerFeePct', ns.buyerFeePct);
    setNet('netConcession', ns.concession);
    setNet('netRepairs', ns.repairs);
    setNet('netTaxRate', ns.taxRate);
    setNet('netPayoff', ns.payoff);
    setNet('netCloseDate', ns.closeDate);
    setNet('netOec', ns.oec);
    setNet('netBundled', ns.bundled);
    setNet('netWater', ns.water);
    if (ns.titleAuto === false) {{
      setNet('netTitle', ns.title);
      delete document.getElementById('netTitle').dataset.auto;
      const tag = document.getElementById('netTitleTag');
      if (tag) tag.textContent = 'manual';
    }}
  }}
  if (Array.isArray(saved.hiddenSections)) applySectionVisibility(saved.hiddenSections);
  renderTable(); applyEdits({{ refreshDeck: false, close: false }});
}}
loadSavedEdits();
</script>
<script src="/saas/assistant.js"></script>
</body>
</html>
"""
    return html


def save_interactive_html(report: dict, output_path: str | Path) -> Path:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_interactive_html(report), encoding="utf-8")
    return path


if __name__ == "__main__":
    data = json.loads(Path("presentation_data.json").read_text(encoding="utf-8"))
    out = save_interactive_html(data, "presentation.html")
    print(f"Wrote {out} ({out.stat().st_size:,} bytes)")
