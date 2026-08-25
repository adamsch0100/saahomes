"""Landscape flipbook + printable leave-behind deck for ListLogic presentations."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from copy_defaults import DEFAULT_LEDES


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


def _esc(s: Any) -> str:
    return (
        str(s or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _plain(s: Any) -> str:
    """Strip simple HTML tags then escape for text nodes."""
    text = re.sub(r"<[^>]+>", "", str(s or ""))
    return _esc(text)


def _md_strip(s: Any) -> str:
    """Plain-text version of light LLM markdown (**bold**, ## heads, - bullets)."""
    text = str(s or "")
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"\1", text)
    text = re.sub(r"^#{1,4}\s*", "", text, flags=re.M)
    text = re.sub(r"^\s*[-*]\s+", "• ", text, flags=re.M)
    return re.sub(r"\n{2,}", "\n", text).strip()


def render_deck_html(report: dict, *, interactive_href: str = "presentation.html") -> str:
    report = _clean(report)
    s = report.get("stats") or {}
    pos = report.get("positioning") or {}
    subject = report.get("subject") or {}
    meta = report.get("meta") or {}
    story = report.get("story") or {}
    mdef = report.get("market_definition") or story.get("market_definition") or {}

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
    median_dom = float(story.get("median_dom") or s.get("median_dom") or 45)
    top_mkt = float(story.get("top_of_market_pct") or 50)
    exec_sum = _md_strip(report.get("executive_summary") or "")
    copy_ledes = report.get("copy_ledes") if isinstance(report.get("copy_ledes"), dict) else {}
    lede_comps = copy_ledes.get("comps") or DEFAULT_LEDES["comps"]
    lede_condition = copy_ledes.get("condition") or DEFAULT_LEDES["condition"]
    lede_close = copy_ledes.get("close") or DEFAULT_LEDES["close"]
    advantages = pos.get("advantages") or []
    risks = pos.get("risks") or []
    scenarios = pos.get("price_scenarios") or []
    comps = (pos.get("closest_comps") or [])[:8]

    brand_primary = meta.get("brand_primary") or "#0c3c6e"
    brand_accent = meta.get("brand_accent") or "#1a5f9e"
    logo_url = meta.get("logo_url") or "/saas/listlogic-logo.png"
    area = report.get("area") or ""
    generated = meta.get("generated") or report.get("generated_at") or ""
    agent_name = meta.get("agent_name") or ""
    brokerage = meta.get("brokerage") or ""
    agent_phone = meta.get("agent_phone") or ""
    agent_email = meta.get("agent_email") or ""

    address = subject.get("address") or "Your home"
    sqft = subject.get("living_area") or 0
    beds = subject.get("beds") or 0
    baths = subject.get("baths") or 0
    year = subject.get("year_built") or ""
    garage = subject.get("garage_spaces") or 0
    subject_photo = subject.get("photo_url") or subject.get("photo") or ""
    if not subject_photo and subject.get("photos"):
        subject_photo = (subject.get("photos") or [""])[0]

    market_label = mdef.get("label") or area or "Your competitive market"
    chips = [c for c in (mdef.get("chips") or []) if c][:6]
    portal_values = meta.get("portal_values") if isinstance(meta.get("portal_values"), dict) else {}
    portal_line = ""
    try:
        portal_amt = float((portal_values or {}).get("amount") or 0)
    except (TypeError, ValueError):
        portal_amt = 0
    if meta.get("portal_chip") == "on" and portal_amt > 0:
        portal_line = f'<div class="portal-quiet">Zillow estimate ${portal_amt:,.0f}</div>'

    temp_label = (
        "Strong seller's market" if inv < 2.5 else
        "Seller-favorable" if inv < 4 else
        "Balanced market" if inv < 6 else
        "Buyer-favorable"
    )

    logo_html = (
        f'<img class="logo" src="{_esc(logo_url)}" alt="ListLogic">'
        if logo_url else ""
    )
    cover_brand = "" if logo_html else "ListLogic"
    agent_line = " · ".join(x for x in [agent_name, brokerage] if x)
    contact_line = " · ".join(x for x in [agent_phone, agent_email] if x)

    chip_html = "".join(f'<span class="pill">{_esc(c)}</span>' for c in chips)
    sub_bits = []
    if sqft:
        sub_bits.append(f"{sqft:,.0f} sq ft")
    if beds:
        sub_bits.append(f"{beds:.0f} bed · {baths:.0f} bath")
    if year:
        sub_bits.append(f"Built {int(year) if isinstance(year, float) else year}")
    if garage:
        sub_bits.append(f"{garage:.0f}-car")
    subject_meta = " · ".join(sub_bits)

    cover_visual = (
        f'<div class="cover-photo" style="background-image:url(\'{_esc(subject_photo)}\')"></div>'
        if subject_photo else
        '<div class="cover-photo cover-photo--empty"></div>'
    )

    facts = [
        ("1", "Your Home’s Market Fingerprint", "Custom market fit to your home — size, beds, baths, garage, lot size, and location."),
        ("2", "Supply and Demand", "How many homes are for sale versus how fast they sell. That balance is who has leverage."),
        ("3", "Your Competition", "Active, available homes — the ones a buyer can actually go see. Pending and backup are already spoken for."),
        ("4", "Three Levers — Price, Condition, Location", "That’s what buyers compare. You can’t move the house. You can still change the asking price, and improve the condition."),
        ("5", "Providing Value or Are the Value", "If a similar home lists under you, they’re providing the value — they look like the better buy next to yours. If they list over you, you are the value. Same kind of house; the ask is what makes one of you look like the deal."),
        ("6", "Pricing Determines Time to Contract", "The asking price is what determines how long it takes to go under contract. Priced with the market, homes here move. Overpriced listings linger — and help sell everyone else’s house."),
    ]
    facts_html = "".join(
        f'<div class="fact"><span class="fn">{n}</span><div><div class="ft">{_esc(t)}</div>'
        f'<div class="fb">{_esc(b)}</div></div></div>'
        for n, t, b in facts
    )

    kpi_items = [
        (f"{uc_n}", "Under Contract"),
        (f"{sales_mo:.1f}", "Sales / Month"),
        (f"{inv:.1f}", "Months Inventory"),
        (f"{odds_pct:.0f}%", "30-Day Odds"),
    ]
    kpis_html = "".join(
        f'<div class="kpi"><div class="kv">{_esc(v)}</div><div class="kl">{_esc(l)}</div></div>'
        for v, l in kpi_items
    )

    def _comp_card(c: dict) -> str:
        photos = c.get("photos") or ([c.get("photo_url")] if c.get("photo_url") else [])
        photo = photos[0] if photos else ""
        img = (
            f'<div class="cc-photo" style="background-image:url(\'{_esc(photo)}\')"></div>'
            if photo else '<div class="cc-photo cc-empty"></div>'
        )
        return (
            f'<article class="cc">{img}'
            f'<div class="cc-body">'
            f'<div class="cc-price">${(c.get("sold_price") or 0):,.0f}</div>'
            f'<div class="cc-addr">{_esc((c.get("address") or "")[:36])}</div>'
            f'<div class="cc-meta">Sold {_esc((c.get("sold_date") or "")[:10])} · '
            f'{(c.get("living_area") or 0):.0f} sf · '
            f'{(c.get("beds") or 0):.0f}/{(c.get("baths") or 0):.0f}</div>'
            f'</div></article>'
        )

    comps_html = "".join(_comp_card(c) for c in comps) or '<p class="muted">No close comps</p>'

    scenarios_html = "".join(
        f'<div class="sc{" sc-main" if "Balanced" in (sc.get("label") or "") else ""}" data-price="{(sc.get("list_price") or 0)}">'
        f'<div class="sc-l">{_esc(sc.get("label") or "")}</div>'
        f'<div class="sc-p">${(sc.get("list_price") or 0):,.0f}</div>'
        f'<div class="sc-m">~{(sc.get("expected_dom") or 0):.0f}d · '
        f'{((sc.get("odds_30_day") or 0) * 100):.0f}% in 30d'
        f'{(" · +" + str(int(sc.get("fresh_competitors_below") or 0)) + " fresh below") if sc.get("fresh_competitors_below") else ""}'
        f'</div></div>'
        for sc in scenarios[:5]
    )

    lf = report.get("listing_flow") or {}
    lf_new = float(lf.get("new_listings_per_month") or 0)
    lf_sales = float(lf.get("sales_per_month") or sales_mo)
    lf_pressure = float(lf.get("supply_pressure") or 0)
    lf_below = float(lf.get("new_below_recommended_per_month") or 0)
    lf_active_below = int(lf.get("active_below_recommended_now") or 0)
    lf_wait_fresh = float(lf.get("fresh_during_median_dom") or 0)
    lf_wait_dom = float(lf.get("median_dom_for_wait") or median_dom or 0)
    lf_insight = lf.get("overprice_insight") or lf.get("insight") or ""
    show_supply = lf_new > 0
    if lf_pressure >= 1.15:
        supply_headline = "Supply Is Building"
    elif lf_pressure >= 0.85:
        supply_headline = "Supply Is Roughly Balanced"
    else:
        supply_headline = "Sales Are Outpacing New Listings"
    supply_slide = ""
    if show_supply:
        supply_slide = f'''
    <section class="slide" data-title="2 · Supply">
      <div class="slide-top"><span>{logo_html}2 · Supply</span><span>Supply Stream</span></div>
      <div class="slide-body">
        <h2 class="slide-title"><span class="step-badge">2</span>{_esc(supply_headline)}</h2>
        <p class="lede">New listings keep arriving. Price too high, and fresher, better-value homes get the tours first.</p>
        <div class="kpis" style="margin-top:16px">
          <div class="kpi"><div class="kv">{lf_new:.1f}</div><div class="kl">New / month</div></div>
          <div class="kpi"><div class="kv">{lf_sales:.1f}</div><div class="kl">Sales / month</div></div>
          <div class="kpi"><div class="kv">{lf_pressure:.2f}×</div><div class="kl">Supply pressure</div></div>
          <div class="kpi"><div class="kv">{lf_below:.1f}</div><div class="kl">New below rec / mo</div></div>
        </div>
        <p class="lede" style="margin-top:14px;max-width:60ch">{lf_active_below} Active homes sit under the recommended line now. {_esc(lf_insight)}</p>
      </div>
      <div class="slide-foot"><span>Pipeline, not just today's snapshot</span><span>ListLogic</span></div>
    </section>
'''

    # Compact While-You-Wait block (folded into Price It page)
    wyw_inline = ""
    if show_supply and rec:
        wyw_total = lf_active_below + lf_wait_fresh
        wyw_inline = f'''
            <div style="margin-top:12px;padding:10px 12px;border-radius:12px;background:#fdf6ea;border:1px solid #ecdfc2">
              <div style="font-size:.68rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#9a6a3a">While You Wait</div>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px;text-align:center">
                <div><div id="deckWywAhead" style="font-family:Fraunces,Georgia,serif;font-size:1.4rem;font-weight:700;color:#8a4a12">{lf_active_below}</div><div style="font-size:.62rem;font-weight:700;color:#9a6a3a;text-transform:uppercase">Already cheaper</div></div>
                <div><div id="deckWywArrive" style="font-family:Fraunces,Georgia,serif;font-size:1.4rem;font-weight:700;color:#8a4a12">~{lf_below:.1f}/mo</div><div style="font-size:.62rem;font-weight:700;color:#9a6a3a;text-transform:uppercase">New under you</div></div>
                <div><div id="deckWywTotal" style="font-family:Fraunces,Georgia,serif;font-size:1.4rem;font-weight:700;color:#8a4a12">~{wyw_total:.0f}</div><div style="font-size:.62rem;font-weight:700;color:#9a6a3a;text-transform:uppercase">In <span id="deckWywWait">~{lf_wait_dom:.0f}d</span> wait</div></div>
              </div>
            </div>
'''

    ask = story.get("seller_questions") or {}

    bands = report.get("chart_active_price_bands") or {}
    band_labels = bands.get("labels") or []
    band_values = bands.get("values") or []
    yours_idx = bands.get("subject_band_index")
    bands_inline = ""
    if band_labels and band_values:
        max_v = max(float(v or 0) for v in band_values[:8]) or 1
        bars = ""
        for i, (lab, val) in enumerate(zip(band_labels[:8], band_values[:8])):
            pct = max(6, round(100 * float(val or 0) / max_v))
            mark = " yours" if yours_idx is not None and i == yours_idx else ""
            bars += (
                f'<div class="band-bar{mark}"><span class="bb-l">{_esc(lab)}</span>'
                f'<span class="bb-track"><i style="width:{pct}%"></i></span>'
                f'<span class="bb-n">{int(val)}</span></div>'
            )
        bands_inline = (
            f'<div class="band-chart grow"><div class="eyebrow">Active Competition by List-Price Band</div>'
            f'<div class="band-bars">{bars}</div></div>'
        )

    rating = int(story.get("home_rating") or 5)
    rating_label = story.get("home_rating_label") or "Average / typical for the area"
    top_stmt = story.get("top_percent_statement") or f"Top {top_mkt:.0f}% of similar recent sales."
    trend_val = story.get("trend_value")
    if trend_val:
        try:
            trend_line = f"Size-trend anchor ≈ ${float(trend_val):,.0f}"
        except (TypeError, ValueError):
            trend_line = "Anchored to closest comparable closes."
    else:
        trend_line = "Anchored to closest comparable closes."

    yoy = report.get("chart_yoy") or {}
    yoy_summary = yoy.get("summary") or []

    def _deck_pct(new, old):
        try:
            if old is None or new is None or float(old) == 0:
                return None
            return (float(new) - float(old)) / float(old) * 100.0
        except (TypeError, ValueError, ZeroDivisionError):
            return None

    talk_pace = "Sales volume shows whether demand is building or thinning in this segment."
    talk_price = "Median sold price is what buyers actually paid — the facts behind the list."
    talk_timing = f"Homes here typically go under contract in about {median_dom:.0f} days when priced with the market."
    if len(yoy_summary) >= 2:
        prior, latest = yoy_summary[-2], yoy_summary[-1]
        sd = _deck_pct(latest.get("sales"), prior.get("sales"))
        pd_ = _deck_pct(latest.get("median_price"), prior.get("median_price"))
        dd = _deck_pct(latest.get("median_dom"), prior.get("median_dom"))
        if sd is not None:
            talk_pace = (
                f"{latest.get('year')}: {int(latest.get('sales') or 0)} sales "
                f"({sd:+.0f}% vs {prior.get('year')})."
            )
        if pd_ is not None:
            talk_price = (
                f"Median sold ${(latest.get('median_price') or 0)/1000:.0f}k "
                f"({pd_:+.1f}% vs {prior.get('year')})."
            )
        if dd is not None and latest.get("median_dom") is not None:
            talk_timing = (
                f"Median DOM {latest.get('median_dom'):.0f} days "
                f"({dd:+.0f}% vs {prior.get('year')})."
            )

    yoy_slide = ""
    if yoy_summary:
        max_sales = max(float(y.get("sales") or 0) for y in yoy_summary[:4]) or 1
        max_price = max(float(y.get("median_price") or 0) for y in yoy_summary[:4]) or 1
        max_dom_y = max(float(y.get("median_dom") or 0) for y in yoy_summary[:4]) or 1
        pace_bars = "".join(
            f'<div class="yr-bar"><span class="yr-l">{_esc(y.get("year"))}</span>'
            f'<span class="yr-track"><i style="height:{max(8, round(100 * float(y.get("sales") or 0) / max_sales))}%"></i></span>'
            f'<span class="yr-n">{int(y.get("sales") or 0)}</span></div>'
            for y in yoy_summary[:4]
        )
        price_bars = "".join(
            f'<div class="yr-bar"><span class="yr-l">{_esc(y.get("year"))}</span>'
            f'<span class="yr-track price"><i style="height:{max(8, round(100 * float(y.get("median_price") or 0) / max_price))}%"></i></span>'
            f'<span class="yr-n">${(y.get("median_price") or 0)/1000:.0f}k</span></div>'
            for y in yoy_summary[:4]
        )
        dom_bars = "".join(
            f'<div class="yr-bar"><span class="yr-l">{_esc(y.get("year"))}</span>'
            f'<span class="yr-track timing"><i style="height:{max(8, round(100 * float(y.get("median_dom") or 0) / max_dom_y))}%"></i></span>'
            f'<span class="yr-n">{(y.get("median_dom") or 0):.0f}d</span></div>'
            for y in yoy_summary[:4]
        )
        yoy_slide = f'''
    <section class="slide" data-title="6 · Pace">
      <div class="slide-top"><span>{logo_html}6 · Pace</span><span>Market Detail</span></div>
      <div class="slide-body">
        <h2 class="slide-title"><span class="step-badge">6</span>Pace — Sales Volume</h2>
        <p class="lede">{_esc(talk_pace)}</p>
        <div class="yr-chart grow"><div class="eyebrow">Sales by year</div><div class="yr-bars">{pace_bars}</div></div>
        <p class="talk-chip">More closes = more proof of what buyers will pay. A thinner year means pricing accuracy matters more.</p>
      </div>
      <div class="slide-foot"><span>{_esc(address)}</span><span>ListLogic</span></div>
    </section>
    <section class="slide" data-title="6b · Prices">
      <div class="slide-top"><span>{logo_html}6b · Prices</span><span>What Buyers Paid</span></div>
      <div class="slide-body">
        <h2 class="slide-title"><span class="step-badge">6</span>Prices — What the Market Is Paying</h2>
        <p class="lede">{_esc(talk_price)}</p>
        <div class="duo">
          <div class="d yours"><div class="n">${(yoy_summary[-1].get("median_price") or 0)/1000:.0f}k</div><div class="t">Latest-year median sold</div></div>
          <div class="d"><div class="n" id="deckYoYRec">${rec/1000:.0f}k</div><div class="t">Recommended list</div></div>
        </div>
        <div class="yr-chart grow"><div class="eyebrow">Median sold by year</div><div class="yr-bars">{price_bars}</div></div>
      </div>
      <div class="slide-foot"><span>{_esc(address)}</span><span>ListLogic</span></div>
    </section>
    <section class="slide" data-title="6c · Timing">
      <div class="slide-top"><span>{logo_html}6c · Timing</span><span>Days on Market</span></div>
      <div class="slide-body">
        <h2 class="slide-title"><span class="step-badge">6</span>Timing — How Long Homes Take</h2>
        <p class="lede">{_esc(talk_timing)}</p>
        <div class="duo">
          <div class="d"><div class="n">{median_dom:.0f}d</div><div class="t">Market median DOM</div></div>
          <div class="d yours"><div class="n" id="deckYoYDom">~{exp_dom:.0f}d</div><div class="t">Expected at recommended</div></div>
        </div>
        <div class="yr-chart grow"><div class="eyebrow">Median DOM by year</div><div class="yr-bars">{dom_bars}</div></div>
      </div>
      <div class="slide-foot"><span>{_esc(address)}</span><span>ListLogic</span></div>
    </section>
'''
    else:
        yoy_slide = ""

    adv_html = "".join(f"<li>{_esc(a)}</li>" for a in advantages[:6]) or "<li>Solid fundamentals</li>"
    risk_html = "".join(f"<li>{_esc(r)}</li>" for r in risks[:6]) or "<li>Overpricing risk</li>"

    sold_prices = story.get("sold_prices") or []
    if not sold_prices:
        sold_prices = [
            float(p.get("SoldPrice") or 0)
            for p in (report.get("points") or [])
            if p.get("SoldPrice")
        ]
    deck_data = {
        "soldPrices": sold_prices,
        "rec": rec,
        "low": low,
        "high": high,
        "dom": exp_dom,
        "topMkt": top_mkt,
        "marketOdds": (s.get("odds_of_selling") or story.get("market_odds") or 0),
        "medianDom": median_dom,
        "inv": inv,
        "soldCount": int(s.get("sold_count") or story.get("sold_count") or 0),
        "homeRating": rating,
        "scenarios": [
            {
                "label": sc.get("label"),
                "price": sc.get("list_price"),
                "dom": sc.get("expected_dom"),
                "odds": sc.get("odds_30_day"),
            }
            for sc in scenarios[:5]
        ],
        "listingFlow": {
            "newPm": lf_new,
            "salesPm": lf_sales,
            "supplyPressure": lf_pressure,
            "newBelowRecPm": lf_below,
            "activeBelowRec": lf_active_below,
            "freshDuringMedianDom": lf_wait_fresh,
            "medianDomForWait": lf_wait_dom,
            "subjectSqft": float(lf.get("subject_living_area") or subject.get("living_area") or 0),
            "samples": lf.get("samples") or [],
            "insight": lf_insight,
        },
        "priceResponse": report.get("price_response") or {},
    }
    deck_defaults = {
        "rec": rec,
        "low": low,
        "high": high,
        "dom": exp_dom,
        "rating": 5,
        "bl": exec_sum,
        "adv": "\n".join(advantages),
        "risk": "\n".join(risks),
        "ledes": {
            "comps": lede_comps,
            "condition": lede_condition,
            "close": lede_close,
        },
    }

    # —— Net Sheet slide (mirrors live spine-net defaults) ——
    net_slide = ""
    net_price = rec or float((report.get("subject") or {}).get("list_price") or 0)
    if net_price:
        from datetime import date, timedelta

        def _m(v):
            return f"${float(v):,.0f}"

        seller_fee = net_price * 0.03
        buyer_fee = net_price * 0.03
        repairs = 2000.0
        close = date.today() + timedelta(days=30)
        jan1 = date(close.year, 1, 1)
        days = max(1, min(365, (close - jan1).days + 1))
        tax = round(net_price * 0.76 / 100 * days / 365)
        title = max(0, round(net_price * 0.0015 / 50) * 50)
        oec, bundled, water = 150.0, 190.0, 200.0
        selling = seller_fee + buyer_fee + repairs
        closing = tax + title + oec + bundled + water
        deductions = selling + closing
        net = net_price - deductions
        pct = max(0.0, min(100.0, round(net / net_price * 1000) / 10))

        def _nrow(label, note, val, total=False):
            v = _m(val) if val else "—"
            cls = ' class="ns-total"' if total else ""
            note_html = f'<span class="ns-note">{_esc(note)}</span>' if note else ""
            return (f'<div class="ns-row{cls}"><div class="ns-l">{_esc(label)}{note_html}</div>'
                    f'<div class="ns-v">{v}</div></div>')

        net_rows = (
            '<div class="ns-subhead">Selling costs</div>'
            + _nrow("Seller broker fee", "3.0% of price", seller_fee)
            + _nrow("Buyer broker fee", "3.0% of price", buyer_fee)
            + _nrow("Misc. — inspection repairs", "standard allowance", repairs)
            + _nrow("Total selling costs", "", selling, total=True)
            + '<div class="ns-subhead">Closing expenses · seller-paid</div>'
            + _nrow("Prop. taxes", f"0.76% annual · prorated to day {days} of {close.year}", tax)
            + _nrow("Owner's title policy", "auto · ≈0.15% of price", title)
            + _nrow("Owner's extended coverage", "", oec)
            + _nrow("Bundled closing fees", "", bundled)
            + _nrow("Final water", "final utility reading", water)
            + _nrow("Total closing expenses", "", closing, total=True)
            + '<div class="ns-subhead">Mortgage payoff</div>'
            + _nrow("Seller loan balance", "enter on live net sheet — not a selling cost", 0)
            + _nrow("Total deductions", "selling + closing + payoff", deductions, total=True)
        )
        net_slide = f'''
    <section class="slide" data-title="8 · Net Sheet">
      <div class="slide-top"><span>{logo_html}8 · Net Sheet</span><span>What You Walk Away With</span></div>
      <div class="slide-body">
        <h2 class="slide-title"><span class="step-badge">8</span>Net Sheet — What You Walk Away With</h2>
        <p class="lede">Estimated proceeds at the recommended price. Estimates only — not a closing statement.</p>
        <div class="net-sheet-wrap">
          <div class="ns-lines">{net_rows}</div>
          <div class="ns-summary">
            <div class="ns-eyebrow">Estimated net to seller</div>
            <div class="ns-big">{_m(net)}</div>
            <div class="ns-sub">at {_m(net_price)} · {pct:.1f}% of list</div>
            <div class="ns-fine">Loan balance, concessions, and fees change this the most. Your closer issues official figures.</div>
          </div>
        </div>
      </div>
      <div class="slide-foot"><span>Estimates only · not a closing statement</span><span>ListLogic</span></div>
    </section>
'''

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ListLogic Deck · {_esc(address)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;700&family=Source+Sans+3:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
:root {{
  --navy: {brand_primary};
  --accent: {brand_accent};
  --ink: #0f1c2e;
  --muted: #5b6b7c;
  --gold: #e8c46a;
  --gold-soft: #fde68a;
  --paper: #f4f7fb;
  --card: #ffffff;
  --border: #d5deea;
  --shadow: 0 18px 50px rgba(8,30,55,.22);
}}
* {{ box-sizing: border-box; }}
html, body {{ margin: 0; padding: 0; background: #0a1626; color: var(--ink);
  font-family: "Source Sans 3", "Segoe UI", sans-serif; }}
button {{ font: inherit; }}
a {{ color: inherit; }}

.deck-chrome {{
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 16px; background: rgba(10,22,38,.92); backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255,255,255,.08); color: #fff;
}}
.deck-chrome .left, .deck-chrome .right {{ display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }}
.deck-chrome .brand {{ font-weight: 800; letter-spacing: .02em; font-size: .85rem; opacity: .95; }}
.deck-chrome a, .deck-chrome button {{
  border: 1px solid rgba(255,255,255,.22); background: rgba(255,255,255,.06);
  color: #fff; border-radius: 999px; padding: 7px 12px; font-size: .75rem; font-weight: 700;
  text-decoration: none; cursor: pointer;
}}
.deck-chrome a.on, .deck-chrome button.on {{ background: var(--gold-soft); color: #0f2740; border-color: transparent; }}
.deck-chrome .prog {{ font-size: .72rem; color: rgba(255,255,255,.7); min-width: 4.5rem; text-align: center; }}

.stage {{
  min-height: 100vh; padding: 64px 18px 118px;
  display: flex; align-items: center; justify-content: center;
}}
body.mode-print .stage {{
  display: block; padding: 72px 18px 40px; background: #1a2636;
}}

.deck {{
  position: relative; width: min(1180px, 96vw);
  aspect-ratio: 16 / 9; max-height: calc(100vh - 100px);
}}
body.mode-print .deck {{
  width: 100%; max-width: 1100px; margin: 0 auto; aspect-ratio: auto; max-height: none;
  display: flex; flex-direction: column; gap: 18px;
}}

.slide {{
  position: absolute; inset: 0; border-radius: 18px; overflow: hidden;
  background: var(--paper); box-shadow: var(--shadow);
  opacity: 0; pointer-events: none; transform: translateX(28px) scale(.985);
  transition: opacity .35s ease, transform .45s cubic-bezier(.22,1,.36,1);
  display: grid; grid-template-rows: auto 1fr auto;
}}
.slide.is-on {{ opacity: 1; pointer-events: auto; transform: none; z-index: 2; }}
.slide.is-exit {{ opacity: 0; transform: translateX(-24px) scale(.985); z-index: 1; }}
body.mode-print .slide {{
  position: relative; inset: auto; opacity: 1 !important; pointer-events: auto;
  transform: none !important; width: 100%;
  aspect-ratio: 11 / 8.5; max-height: none;
  break-after: page; page-break-after: always; box-shadow: 0 8px 28px rgba(0,0,0,.25);
  overflow: hidden;
}}

.slide-top {{
  display: flex; justify-content: space-between; align-items: center; gap: 12px;
  padding: 16px 22px 0; color: var(--muted); font-size: .72rem; font-weight: 700;
  letter-spacing: .08em; text-transform: uppercase;
}}
.slide-top .logo {{ height: 24px; background: #fff; border-radius: 6px; padding: 3px 8px; }}
.slide-body {{
  padding: 10px 24px 8px; overflow: hidden;
  display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 6px;
}}
.slide-body > .lede {{ flex: none; max-width: 62ch; }}
.slide-body > .lede:first-of-type {{ flex: none; }}
.slide .comps-grid {{ flex: 1 1 auto; align-content: stretch; }}
.slide .kpis {{ flex: none; }}
.slide .duo {{ flex: none; margin: 8px 0; }}
.slide .ask-trio {{ flex: none; }}
.slide .facts-grid {{ flex: 1 1 auto; align-content: center; }}
.slide .net-sheet-wrap {{ flex: 1 1 auto; min-height: 0; }}
.slide-foot {{
  padding: 8px 22px 14px; display: flex; justify-content: space-between; align-items: center;
  color: var(--muted); font-size: .68rem; border-top: 1px solid transparent;
}}

h1, h2, h3 {{ font-family: Fraunces, Georgia, serif; font-weight: 700; letter-spacing: -.02em; margin: 0; color: var(--navy); }}
.eyebrow {{ font-size: .72rem; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); font-weight: 800; margin-bottom: 8px; }}
.lede {{ font-size: clamp(1rem, 1.6vw, 1.2rem); color: var(--muted); line-height: 1.45; max-width: 42ch; margin-top: 8px; }}
.muted {{ color: var(--muted); }}

/* Cover */
.slide-cover {{
  background:
    radial-gradient(ellipse 70% 60% at 85% 15%, rgba(232,196,106,.18), transparent 55%),
    linear-gradient(135deg, #0a1f38 0%, var(--navy) 45%, var(--accent) 100%);
  color: #fff;
}}
.slide-cover h1, .slide-cover h2, .slide-cover .eyebrow {{ color: #fff; }}
.slide-cover .slide-top, .slide-cover .slide-foot {{ color: rgba(255,255,255,.7); }}
.cover-grid {{ display: grid; grid-template-columns: 1.15fr .95fr; gap: 22px; height: 100%; align-items: stretch; }}
.cover-copy {{ display: flex; flex-direction: column; justify-content: center; padding-right: 8px; }}
.cover-copy h1 {{ font-size: clamp(2rem, 4.2vw, 3.3rem); line-height: 1.05; max-width: 14ch; }}
.cover-copy .meta-line {{ margin-top: 14px; font-size: .95rem; opacity: .88; }}
.cover-copy .agent {{ margin-top: 22px; font-size: .9rem; opacity: .9; line-height: 1.45; }}
.cover-photo {{
  border-radius: 14px; background-size: cover; background-position: center;
  min-height: 100%; box-shadow: 0 16px 40px rgba(0,0,0,.35);
  border: 1px solid rgba(255,255,255,.12);
}}
.cover-photo--empty {{
  background: linear-gradient(160deg, rgba(255,255,255,.08), rgba(255,255,255,.02));
}}

/* Facts */
.facts-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }}
.fact {{
  display: grid; grid-template-columns: 34px 1fr; gap: 10px; align-items: start;
  background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px;
}}
.fn {{
  width: 28px; height: 28px; border-radius: 50%; background: var(--gold-soft); color: #0f2740;
  display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: .8rem;
}}
.ft {{ font-weight: 800; color: var(--navy); font-size: .92rem; }}
.fb {{ font-size: .78rem; color: var(--muted); line-height: 1.35; margin-top: 3px; }}

/* Price bands */
.band-list {{
  display: grid; gap: 6px; margin-top: 14px; max-width: 34rem;
}}
.band-row {{
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 12px; border-radius: 10px; background: #fff;
  border: 1px solid var(--border); font-size: .85rem; font-weight: 600; color: var(--ink);
}}
.band-row.yours {{
  background: linear-gradient(145deg, var(--navy), var(--accent)); color: #fff; border: none;
}}
.band-row strong {{ font-weight: 800; }}

/* Market */
.duo {{ display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 14px 0 12px; }}
.duo.compact {{ gap: 8px; margin: 6px 0; }}
.duo .d {{
  background: #fff; border: 1px solid var(--border); border-radius: 16px; padding: 22px; text-align: center;
}}
.duo.compact .d {{ padding: 12px 10px; border-radius: 12px; }}
.duo .d.yours {{
  background: linear-gradient(145deg, var(--navy), var(--accent)); color: #fff; border: none;
}}
.duo .n {{ font-size: clamp(2.4rem, 5vw, 3.4rem); font-weight: 800; letter-spacing: -.03em; line-height: 1; }}
.duo.compact .n {{ font-size: clamp(1.7rem, 3.2vw, 2.3rem); }}
.duo .t {{ margin-top: 8px; font-size: .75rem; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; opacity: .85; }}
.duo.compact .t {{ margin-top: 4px; font-size: .62rem; }}
.lede.tight {{ font-size: .9rem; max-width: none; margin-top: 4px; }}
.market-layout {{
  display: grid; grid-template-columns: 1.05fr 1fr; gap: 14px; min-height: 0; margin-top: 4px;
}}
.market-left, .market-right {{ display: flex; flex-direction: column; min-height: 0; gap: 6px; }}
.market-right .band-chart {{ flex: 1; margin-top: 0; }}
.market-right .band-bars {{ justify-content: space-evenly; }}
.ask-card .aa {{
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}}
.price-rec-bl {{
  display: block; overflow: visible; max-width: none;
  font-size: .86rem; line-height: 1.42;
}}
.net-sheet-wrap {{ min-height: 0; overflow: hidden; }}
.ns-lines {{ overflow: hidden; max-height: 100%; }}
.ns-row {{ padding: 3px 0; }}
.ns-l {{ font-size: .74rem; }}
.ns-v {{ font-size: .74rem; }}
.ns-subhead {{ padding: 5px 0 2px; }}
.ns-summary .ns-big {{ font-size: 1.85rem; }}
@media (max-width: 900px) {{
  .market-layout {{ grid-template-columns: 1fr; }}
}}
.pills {{ display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }}
.pill {{
  background: #fff; border: 1px solid var(--border); border-radius: 999px; padding: 4px 10px;
  font-size: .7rem; font-weight: 700; color: var(--navy);
}}
.kpis {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }}
.kpi {{
  background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 12px 8px; text-align: center;
}}
.kv {{ font-size: 1.25rem; font-weight: 800; color: var(--navy); }}
.kl {{ font-size: .62rem; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-top: 4px; font-weight: 700; }}

/* Comps — fill slide like leave-behind 4×2 */
.comps-grid {{
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 10px;
}}
.comps-grid-8 {{
  flex: 1 1 auto; min-height: 0;
  grid-template-rows: 1fr 1fr;
  gap: 8px; align-content: stretch;
}}
.comps-grid-8 .cc {{
  display: flex; flex-direction: column; min-height: 0; height: 100%;
}}
.comps-grid-8 .cc-photo {{
  flex: 1 1 auto; min-height: 72px; height: auto; max-height: none;
}}
.comps-grid-8 .cc-body {{ padding: 7px 8px 8px; flex: none; }}
.comps-grid-8 .cc-price {{ font-size: .95rem; }}
.comps-grid-8 .cc-addr {{ font-size: .7rem; }}
.comps-grid-8 .cc-meta {{ font-size: .6rem; }}
.cc {{ background: #fff; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }}
.cc-photo {{ height: 110px; background-size: cover; background-position: center; background-color: #1a2332; }}
.cc-photo.cc-empty {{ background: linear-gradient(135deg, #0f2740, #1a4568); }}
.cc-body {{ padding: 8px 10px 10px; }}
.cc-price {{ font-size: 1.05rem; font-weight: 800; color: var(--navy); }}
.cc-addr {{ font-size: .75rem; font-weight: 700; margin-top: 2px; line-height: 1.25; }}
.cc-meta {{ font-size: .65rem; color: var(--muted); margin-top: 3px; }}

.grow {{ flex: 1 1 auto; min-height: 0; }}
.talk-chip {{
  margin-top: auto; padding: 10px 12px; border-radius: 10px; background: #eef4fb;
  border-left: 3px solid var(--accent); font-size: .85rem; color: var(--muted); line-height: 1.4;
}}
.band-chart {{ display: flex; flex-direction: column; margin-top: 8px; min-height: 0; }}
.band-bars {{ display: flex; flex-direction: column; gap: 5px; flex: 1; justify-content: center; }}
.band-bar {{ display: grid; grid-template-columns: 7.5rem 1fr 2rem; gap: 8px; align-items: center; }}
.band-bar .bb-l {{ font-size: .72rem; font-weight: 700; color: var(--muted); }}
.band-bar .bb-track {{ height: 12px; border-radius: 6px; background: #e8eef6; overflow: hidden; }}
.band-bar .bb-track i {{ display: block; height: 100%; background: linear-gradient(90deg, var(--navy), var(--accent)); border-radius: 6px; }}
.band-bar.yours .bb-track i {{ background: linear-gradient(90deg, #b3541e, #e0a458); }}
.band-bar .bb-n {{ font-size: .75rem; font-weight: 800; color: var(--navy); text-align: right; }}
.yr-chart {{ display: flex; flex-direction: column; margin-top: 10px; }}
.yr-bars {{ display: flex; gap: 14px; align-items: flex-end; flex: 1; min-height: 140px; padding: 8px 4px 0; }}
.yr-bar {{ flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; justify-content: flex-end; }}
.yr-track {{ width: 100%; max-width: 64px; flex: 1; min-height: 80px; border-radius: 10px 10px 4px 4px; background: #e8eef6; display: flex; align-items: flex-end; overflow: hidden; }}
.yr-track i {{ display: block; width: 100%; background: linear-gradient(180deg, var(--accent), var(--navy)); border-radius: 10px 10px 0 0; }}
.yr-track.price i {{ background: linear-gradient(180deg, #e0a458, #8a4a12); }}
.yr-track.timing i {{ background: linear-gradient(180deg, #14b8a6, #0e7a6d); }}
.yr-l {{ font-size: .72rem; font-weight: 800; color: var(--muted); }}
.yr-n {{ font-size: .8rem; font-weight: 800; color: var(--navy); }}
.price-rec-grid {{ display: grid; grid-template-columns: 1.35fr .9fr; gap: 18px; align-items: stretch; margin-top: 8px; flex: 1; min-height: 0; }}
.price-rec-main {{ display: flex; flex-direction: column; justify-content: center; }}
.price-rec-num {{ font-family: Fraunces, Georgia, serif; font-size: clamp(2.8rem, 6vw, 4.2rem); font-weight: 700; color: var(--navy); letter-spacing: -.03em; line-height: 1; }}
.price-rec-range {{ margin-top: 10px; font-size: 1rem; color: var(--muted); }}
.portal-quiet {{ margin-top: 8px; font-size: .78rem; color: var(--muted); font-weight: 600; }}
.price-rec-top {{ margin-top: 8px; color: var(--accent); font-weight: 700; }}
.price-rec-bl {{ color: var(--ink); background: #f0f5fb; border-left-color: var(--accent); }}
.price-rec-side {{ display: flex; flex-direction: column; justify-content: center; }}
.sc-grid-fill {{ grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); align-content: stretch; flex: 1; }}
.sc-grid-fill .sc {{ display: flex; flex-direction: column; justify-content: center; min-height: 88px; }}
@media (max-width: 900px) {{
  .price-rec-grid {{ grid-template-columns: 1fr; }}
  .band-bar {{ grid-template-columns: 5.5rem 1fr 1.5rem; }}
}}

/* Verdict */
.slide-verdict {{
  background:
    radial-gradient(ellipse 60% 50% at 90% 10%, rgba(253,230,138,.2), transparent 50%),
    linear-gradient(135deg, var(--navy) 0%, var(--accent) 70%, #2d7ec4 100%);
  color: #fff;
}}
.slide-verdict h1, .slide-verdict h2, .slide-verdict .eyebrow {{ color: #fff; }}
.slide-verdict .slide-top, .slide-verdict .slide-foot {{ color: rgba(255,255,255,.75); }}
.verdict-wrap {{ display: flex; flex-direction: column; justify-content: center; height: 100%; max-width: 36rem; }}
.verdict-wrap .big {{
  font-family: Fraunces, Georgia, serif; font-size: clamp(3rem, 7vw, 5rem);
  font-weight: 700; letter-spacing: -.03em; line-height: 1; margin-top: 6px;
}}
.verdict-wrap .sub {{ font-size: 1.15rem; margin-top: 14px; opacity: .95; }}
.verdict-wrap .top {{ margin-top: 12px; color: var(--gold-soft); font-weight: 700; font-size: 1.05rem; }}
.pos-bar {{
  position: relative; height: 12px; border-radius: 6px; margin-top: 22px; max-width: 420px;
  background: linear-gradient(90deg,#16a34a 0%,#84cc16 30%,#facc15 55%,#f97316 75%,#dc2626 100%);
}}
.pos-marker {{
  position: absolute; top: -5px; width: 4px; height: 22px; background: #fff; border-radius: 2px;
  box-shadow: 0 0 0 2px rgba(12,60,110,.45); left: {max(2, min(98, 100 - top_mkt)):.1f}%;
}}
.bl {{
  margin-top: 18px; padding: 12px 14px; border-left: 3px solid var(--gold-soft);
  background: rgba(255,255,255,.08); border-radius: 0 10px 10px 0; font-size: .92rem; line-height: 1.45;
  max-width: 48ch;
}}

/* Strategy */
.sc-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 14px; }}
.sc {{
  background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 14px 12px; text-align: center;
}}
.sc-main {{ border-color: var(--navy); box-shadow: 0 0 0 2px rgba(12,60,110,.15); background: linear-gradient(180deg,#f0f7ff,#fff); }}
.sc-l {{ font-size: .62rem; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); font-weight: 800; }}
.sc-p {{ font-size: 1.25rem; font-weight: 800; color: var(--navy); margin: 6px 0; }}
.sc-m {{ font-size: .7rem; color: var(--muted); }}
.split {{ display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }}
.split h3 {{ font-size: .95rem; margin-bottom: 6px; }}
.split ul {{ margin: 0; padding-left: 1.1rem; font-size: .88rem; line-height: 1.45; color: var(--muted); }}
.split li {{ margin: 4px 0; }}

/* While You Wait */
.slide-wyw {{
  background:
    radial-gradient(ellipse 55% 45% at 88% 8%, rgba(224,164,88,.16), transparent 55%),
    linear-gradient(160deg, #fdf6ea 0%, var(--paper) 55%);
}}
.wyw-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 16px; }}
.wyw-cell {{
  background: #fff; border: 1px solid #ecdfc2; border-radius: 14px; padding: 16px 14px;
  text-align: center; box-shadow: 0 6px 18px -10px rgba(138,74,18,.25);
}}
.wyw-cell.wyw-hot {{
  background: linear-gradient(155deg, #b3541e, #8a3c10); color: #fff; border: none;
  box-shadow: 0 14px 30px -12px rgba(138,60,16,.55);
}}
.wyw-v {{ font-family: Fraunces, Georgia, serif; font-size: clamp(1.8rem, 3.4vw, 2.5rem); font-weight: 700; color: #8a4a12; line-height: 1; letter-spacing: -.02em; }}
.wyw-hot .wyw-v {{ color: #fff; }}
.wyw-unit {{ font-size: .9rem; font-weight: 700; }}
.wyw-l {{ font-size: .68rem; text-transform: uppercase; letter-spacing: .06em; font-weight: 800; color: #9a6a3a; margin-top: 6px; }}
.wyw-hot .wyw-l {{ color: rgba(255,255,255,.88); }}
.wyw-d {{ font-size: .72rem; color: #a07a4a; margin-top: 5px; line-height: 1.35; }}
.wyw-hot .wyw-d {{ color: rgba(255,255,255,.8); }}
.wyw-compare {{ margin-top: 18px; display: grid; gap: 10px; max-width: 46rem; }}
.wyw-row {{ display: grid; grid-template-columns: 11rem 1fr 9.5rem; align-items: center; gap: 12px; }}
.wyw-row-label {{ font-size: .8rem; color: var(--muted); }}
.wyw-row-label strong {{ color: var(--navy); }}
.wyw-row-n {{ font-size: .78rem; font-weight: 800; color: #8a4a12; text-align: right; white-space: nowrap; }}
.wyw-track {{ height: 14px; border-radius: 7px; background: #f0e4cb; overflow: hidden; }}
.wyw-fill {{ height: 100%; border-radius: 7px; }}
.wyw-fill.good {{ background: linear-gradient(90deg, #0e7a6d, #14b8a6); }}
.wyw-fill.bad {{ background: linear-gradient(90deg, #e0a458, #b3541e); }}

/* Close */
.slide-close {{
  background: linear-gradient(160deg, #0a1f38, var(--navy) 60%, #123a5c);
  color: #fff;
}}
.slide-close h1, .slide-close h2, .slide-close .eyebrow {{ color: #fff; }}
.slide-close .slide-top, .slide-close .slide-foot {{ color: rgba(255,255,255,.7); }}
.close-inner {{ display: flex; flex-direction: column; justify-content: center; height: 100%; max-width: 34rem; }}
.close-inner h1 {{ font-size: clamp(1.8rem, 3.5vw, 2.6rem); }}
.close-inner .cta {{
  margin-top: 22px; display: inline-flex; align-self: flex-start; gap: 10px; flex-wrap: wrap;
}}
.close-inner .cta span {{
  background: var(--gold-soft); color: #0f2740; font-weight: 800; border-radius: 999px;
  padding: 10px 16px; font-size: .88rem;
}}

.nav-fab {{
  position: fixed; bottom: 22px; right: 22px; z-index: 90; display: flex; gap: 8px;
}}
.nav-fab button {{
  width: 48px; height: 48px; border-radius: 50%; border: none; cursor: pointer;
  background: var(--gold-soft); color: #0f2740; font-size: 1.4rem; font-weight: 800;
  box-shadow: 0 8px 24px rgba(0,0,0,.3);
}}
body.mode-print .nav-fab {{ display: none; }}

.hint {{
  position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
  color: rgba(255,255,255,.55); font-size: .72rem; z-index: 80; pointer-events: none;
}}
body.mode-print .hint {{ display: none; }}

@media (max-width: 900px) {{
  .cover-grid, .facts-grid, .duo, .split, .sc-grid, .wyw-grid {{ grid-template-columns: 1fr; }}
  .wyw-row {{ grid-template-columns: 1fr; gap: 4px; }}
  .wyw-row-n {{ text-align: left; }}
  .comps-grid, .kpis {{ grid-template-columns: repeat(2, 1fr); }}
  .deck {{ aspect-ratio: auto; min-height: calc(100vh - 110px); max-height: none; }}
  .slide {{ position: relative; min-height: calc(100vh - 110px); }}
  body:not(.mode-print) .slide:not(.is-on) {{ display: none; }}
}}

/* Compact layouts for denser spine slides */
.ask-trio {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px; }}
.ask-card {{
  background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px;
}}
.ask-card .aq {{ font-size: .68rem; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; color: var(--accent); }}
.ask-card .aa {{ font-size: .78rem; color: var(--muted); margin-top: 4px; line-height: 1.35; }}
.price-it-grid {{ display: grid; grid-template-columns: 1.05fr 1fr; gap: 14px; height: 100%; align-items: stretch; }}
.price-it-left, .price-it-right {{ display: flex; flex-direction: column; justify-content: center; }}
.step-badge {{
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 50%; background: var(--gold-soft); color: #0f2740;
  font-size: .72rem; font-weight: 800; margin-right: 8px; vertical-align: middle;
}}
.slide-title {{ display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }}

/* Net Sheet slide */
.net-sheet-wrap {{ display: grid; grid-template-columns: 1.5fr 1fr; gap: 18px; margin-top: 14px; align-items: start; }}
.ns-lines {{ background: #fff; border: 1px solid var(--border); border-radius: 14px; padding: 8px 14px; }}
.ns-subhead {{ font-size: .62rem; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--accent); padding: 8px 0 3px; }}
.ns-row {{ display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 4px 0; border-bottom: 1px solid #eef2f8; }}
.ns-row.ns-total {{ border-bottom: 0; border-top: 2px solid var(--navy); margin-top: 4px; padding-top: 8px; font-weight: 800; }}
.ns-l {{ font-size: .8rem; color: var(--ink); }}
.ns-l .ns-note {{ display: block; font-size: .62rem; color: var(--muted); }}
.ns-v {{ font-size: .8rem; font-weight: 700; color: var(--ink); white-space: nowrap; }}
.ns-row.ns-total .ns-v {{ color: var(--navy); }}
.ns-summary {{ background: linear-gradient(160deg, var(--navy), var(--accent)); border-radius: 14px; padding: 20px 18px; color: #fff; }}
.ns-summary .ns-eyebrow {{ font-size: .62rem; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; opacity: .8; }}
.ns-summary .ns-big {{ font-family: 'Fraunces', serif; font-size: 2.2rem; font-weight: 700; margin: 6px 0 2px; }}
.ns-summary .ns-sub {{ font-size: .8rem; opacity: .9; }}
.ns-summary .ns-fine {{ font-size: .64rem; opacity: .75; margin-top: 12px; line-height: 1.4; }}
@media (max-width: 900px) {{ .net-sheet-wrap {{ grid-template-columns: 1fr; }} }}

.presenter-dock {{
  display: none !important;
  position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%);
  z-index: 80; width: min(720px, calc(100vw - 28px));
  background: rgba(10,22,38,.94); color: #fff; border: 1px solid rgba(255,255,255,.14);
  border-radius: 16px; padding: 10px 14px 12px; box-shadow: 0 16px 40px rgba(0,0,0,.35);
  backdrop-filter: blur(12px);
}}
.presenter-dock .pd-row {{ display: flex; align-items: center; gap: 10px; margin-top: 6px; }}
.presenter-dock .pd-label {{
  font-size: .62rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
  color: rgba(255,255,255,.62); min-width: 4.6rem;
}}
.pd-rates {{ display: flex; flex-wrap: wrap; gap: 4px; }}
.pd-rate {{
  width: 28px; height: 28px; border-radius: 8px; border: 1px solid rgba(255,255,255,.2);
  background: rgba(255,255,255,.06); color: #fff; font-size: .75rem; font-weight: 800; cursor: pointer;
}}
.pd-rate.active {{ background: var(--gold-soft); color: #0f2740; border-color: transparent; }}
.pd-slider {{ flex: 1; min-width: 0; }}
.pd-slider input {{ width: 100%; accent-color: var(--gold-soft); }}
.pd-price {{ font-family: Fraunces, Georgia, serif; font-weight: 700; font-size: 1.05rem; min-width: 5.8rem; text-align: right; }}
.pd-meta {{
  display: flex; flex-wrap: wrap; gap: 10px 16px; margin-top: 8px;
  font-size: .72rem; color: rgba(255,255,255,.78); font-weight: 700;
  align-items: center;
}}
.pd-reset {{
  margin-left: auto; border: 1px solid rgba(255,255,255,.22); background: transparent;
  color: #fff; border-radius: 999px; padding: 4px 10px; font-size: .68rem; font-weight: 800;
  cursor: pointer;
}}
body.mode-print .presenter-dock {{ display: none !important; }}
body.ll-agent [data-lede], body.ll-agent [data-edit] {{
  outline: 1px dashed transparent; border-radius: 4px; cursor: text;
}}
body.ll-agent [data-lede]:hover, body.ll-agent [data-edit]:hover,
body.ll-agent #deckAdvList li:hover, body.ll-agent #deckRiskList li:hover {{
  outline-color: rgba(12,60,110,.35);
}}
body.ll-agent [data-lede]:focus, body.ll-agent [data-edit]:focus,
body.ll-agent #deckAdvList li:focus, body.ll-agent #deckRiskList li:focus {{
  outline-color: var(--navy);
}}

@media print {{
  @page {{ size: 11in 8.5in; margin: 0; }}
  * {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
  html, body {{ background: #fff !important; margin: 0; padding: 0; }}
  .deck-chrome, .nav-fab, .hint, .presenter-dock {{ display: none !important; }}
  .stage {{ padding: 0 !important; background: #fff !important; min-height: 0 !important; }}
  .deck {{
    max-width: none !important; width: 11in !important; margin: 0 !important; gap: 0 !important;
    aspect-ratio: auto !important; max-height: none !important;
  }}
  .slide {{
    position: relative !important; opacity: 1 !important; transform: none !important;
    box-shadow: none !important; border-radius: 0 !important; border: none !important;
    box-sizing: border-box;
    width: 10.5in !important; height: 7.9in !important; max-height: 7.9in !important;
    min-height: 7.9in !important; aspect-ratio: auto !important;
    margin: 0.3in auto !important;
    overflow: hidden !important;
    break-after: page; page-break-after: always;
    page-break-inside: avoid; break-inside: avoid;
  }}
  .slide:last-child {{ break-after: auto; page-break-after: auto; }}
  .slide-body {{ overflow: hidden; padding: 10px 22px 6px; display: flex; flex-direction: column; }}
  .comps-grid {{ gap: 8px; margin-top: 8px; flex: 1; align-content: stretch; }}
  .comps-grid-8 .cc-photo {{ height: auto !important; min-height: 72px !important; flex: 1 1 auto !important; }}
  .yr-bars {{ min-height: 120px !important; }}
  .band-bars {{ flex: 1; }}
  .price-rec-grid {{ grid-template-columns: 1.3fr .9fr; }}
  .market-layout {{ grid-template-columns: 1.05fr 1fr !important; }}
  .duo.compact .n {{ font-size: 1.7rem !important; }}
  .ns-summary .ns-big {{ font-size: 1.6rem !important; }}
  .ns-row {{ padding: 2px 0 !important; }}
  .slide-body {{ padding: 8px 18px 4px !important; gap: 4px !important; }}
  .slide-top {{ padding: 10px 18px 0 !important; }}
  .slide-foot {{ padding: 4px 18px 8px !important; }}
  h2, .slide-title {{ font-size: 1.15rem !important; }}
  .lede {{ font-size: .88rem !important; }}
  .cc-body {{ padding: 6px 8px 8px; }}
  .cc-price {{ font-size: .9rem; }}
  .cc-addr {{ font-size: .66rem; }}
  .slide[data-title^="5 ·"] .lede {{ font-size: .88rem; }}
  .slide[data-title^="6"] .lede {{ font-size: .88rem; max-width: none; }}
}}
</style>
</head>
<body class="mode-flip" data-deck-spine="v7">
<header class="deck-chrome">
  <div class="left">
    <span class="brand">ListLogic · Listing flipbook</span>
    <a href="{_esc(interactive_href)}" id="linkInteractive">Live Story</a>
    <button type="button" class="on" id="btnFlip" data-mode="flip">Flipbook</button>
    <button type="button" id="btnPrintMode" data-mode="print">Print layout</button>
  </div>
  <div class="right">
    <span class="prog" id="progLabel">1 / 8</span>
    <button type="button" id="btnPrev">‹ Prev</button>
    <button type="button" id="btnNext">Next ›</button>
    <button type="button" id="btnPrint">Print / PDF</button>
  </div>
</header>

<main class="stage">
  <div class="deck" id="deck">

    <!-- Cover -->
    <section class="slide slide-cover is-on" data-title="Cover">
      <div class="slide-top"><span>{logo_html}{cover_brand}</span><span>Pricing Story</span></div>
      <div class="slide-body">
        <div class="cover-grid">
          <div class="cover-copy">
            <div class="eyebrow">Seller Pricing Presentation</div>
            <h1>{_esc(address)}</h1>
            <div class="meta-line">{_esc(subject_meta)}</div>
            <div class="meta-line">{_esc(area)} · {_esc(temp_label)}</div>
            <div class="agent">{_esc(agent_line)}<br>{_esc(contact_line)}</div>
          </div>
          {cover_visual}
        </div>
      </div>
      <div class="slide-foot"><span>{_esc(generated)}</span><span>Confidential · for sellers</span></div>
    </section>

    <!-- How It Works (matches Live Story core-facts) -->
    <section class="slide" data-title="How It Works">
      <div class="slide-top"><span>{logo_html}How It Works</span><span>Ground Rules</span></div>
      <div class="slide-body">
        <div class="eyebrow">Core Facts of ListLogic</div>
        <h2>How we look at this listing</h2>
        <p class="lede">The numbers live on the next slides. These are the rules behind them.</p>
        <div class="facts-grid">{facts_html}</div>
      </div>
      <div class="slide-foot"><span>{_esc(address)}</span><span>ListLogic</span></div>
    </section>

    <!-- 1 · Market -->
    <section class="slide" data-title="1 · Market">
      <div class="slide-top"><span>{logo_html}1 · Market</span><span>{_esc(temp_label)} · {inv:.1f} mo inventory</span></div>
      <div class="slide-body">
        <h2 class="slide-title"><span class="step-badge">1</span>Homes on the Market</h2>
        <div class="market-layout grow">
          <div class="market-left">
            <div class="pills">{chip_html}</div>
            <p class="lede tight">Competition = <strong>Active only</strong>. Pending + Backup are already under contract.</p>
            <div class="duo compact">
              <div class="d"><div class="n">{active_n}</div><div class="t">Active on Market</div></div>
              <div class="d yours"><div class="n">{with_yours}</div><div class="t">With Your Home</div></div>
            </div>
            <div class="ask-trio">
              <div class="ask-card"><div class="aq">How Long?</div><div class="aa">{_plain(ask.get("how_long") or f"About {median_dom:.0f} days when priced well.")}</div></div>
              <div class="ask-card"><div class="aq">Odds?</div><div class="aa">{_plain(ask.get("odds") or f"About {odds_pct:.0f}% in ~30 days when priced well.")}</div></div>
              <div class="ask-card"><div class="aq">Pace?</div><div class="aa">{_plain(ask.get("when_active") or f"About {sales_mo:.1f} sales per month.")}</div></div>
            </div>
            <div class="kpis">{kpis_html}</div>
          </div>
          <div class="market-right">
            {bands_inline or '<div class="talk-chip">Open Live Story for the active list-price band chart.</div>'}
          </div>
        </div>
      </div>
      <div class="slide-foot"><span>{_esc(market_label)}</span><span>ListLogic</span></div>
    </section>
{supply_slide}
    <!-- 3 · Comps -->
    <section class="slide" data-title="3 · Comps">
      <div class="slide-top"><span>{logo_html}3 · Comps</span><span>Closest Sales</span></div>
      <div class="slide-body">
        <h2 class="slide-title"><span class="step-badge">3</span>Closest Comparable Sales</h2>
        <p class="lede" data-lede="comps">{_esc(lede_comps)}</p>
        <div class="comps-grid comps-grid-8">{comps_html}</div>
      </div>
      <div class="slide-foot"><span>{len(comps)} close sales</span><span>ListLogic</span></div>
    </section>

    <!-- 4 · Position -->
    <section class="slide" data-title="4 · Position">
      <div class="slide-top"><span>{logo_html}4 · Position</span><span>Market Position</span></div>
      <div class="slide-body">
        <h2 class="slide-title"><span class="step-badge">4</span>Position in Recent Sales</h2>
        <p class="lede" id="deckTopStmt">{_esc(top_stmt)}</p>
        <div class="duo compact" style="margin-top:12px">
          <div class="d"><div class="n" id="deckPosTop">Top {top_mkt:.0f}%</div><div class="t">of similar sales</div></div>
          <div class="d yours"><div class="n" id="deckPosRate">{rating}/10</div><div class="t" id="deckPosRateLabel">{_esc(rating_label)}</div></div>
        </div>
        <p class="lede tight">{_esc(trend_line)}</p>
        <p class="talk-chip">{_esc((pos.get("competitive_statement") or "")[:280])}</p>
      </div>
      <div class="slide-foot"><span>Condition is set in Live Story</span><span>ListLogic</span></div>
    </section>
{yoy_slide}
    <!-- 7 · Recommendation -->
    <section class="slide" data-title="7 · Price It">
      <div class="slide-top"><span>{logo_html}7 · Price It</span><span>Recommendation</span></div>
      <div class="slide-body">
        <h2 class="slide-title"><span class="step-badge">7</span>Recommended List Price</h2>
        <div class="price-rec-grid">
          <div class="price-rec-main">
            <div class="price-rec-num" id="deckRec">${rec:,.0f}</div>
            {portal_line}
            <div class="price-rec-range">Range <strong id="deckRange">${low:,.0f} – ${high:,.0f}</strong> · ~<strong id="deckDom">{exp_dom:.0f} days</strong> to contract</div>
            <div class="price-rec-top" id="deckTopPct">Top {top_mkt:.0f}% of similar recent sales</div>
            <div class="pos-bar" style="margin-top:14px"><div class="pos-marker" id="deckPosMarker"></div></div>
            <div class="bl price-rec-bl" id="deckBL" data-edit="bl">{_esc(exec_sum).replace(chr(10), '<br/>')}</div>
          </div>
          <div class="price-rec-side">{wyw_inline or '<div class="talk-chip">Strategy cards on the next slide show higher vs lower asks.</div>'}</div>
        </div>
      </div>
      <div class="slide-foot"><span>Then choose a strategy lane</span><span>ListLogic</span></div>
    </section>

    <!-- 7b · Strategy -->
    <section class="slide" data-title="7b · Strategy">
      <div class="slide-top"><span>{logo_html}7b · Strategy</span><span>Trade-Offs</span></div>
      <div class="slide-body">
        <h2 class="slide-title"><span class="step-badge">7</span>If You Go Higher or Lower</h2>
        <p class="lede">Strategy cards snap you to a lane — days and odds respond.</p>
        <div class="sc-grid sc-grid-fill" id="deckScGrid">{scenarios_html or '<p class="muted">Open Live Story for the live what-if slider.</p>'}</div>
        <div class="split">
          <div><h3>Advantages</h3><ul id="deckAdvList">{adv_html}</ul></div>
          <div><h3>Watch-Outs</h3><ul id="deckRiskList">{risk_html}</ul></div>
        </div>
      </div>
      <div class="slide-foot"><span>Pick a lane — the market answers</span><span>ListLogic</span></div>
    </section>

{net_slide}

    <!-- Close -->
    <section class="slide slide-close" data-title="Next">
      <div class="slide-top"><span>{logo_html}Next Steps</span><span>Let's List It Right</span></div>
      <div class="slide-body">
        <div class="close-inner">
          <div class="eyebrow">Ready When You Are</div>
          <h1>Price with the data.<br>Win with the story.</h1>
          <p class="lede" data-lede="close" style="color:rgba(255,255,255,.85)">{_esc(lede_close)}</p>
          <div class="cta">
            <span>{_esc(agent_name or "Your agent")}</span>
            {f'<span>{_esc(agent_phone)}</span>' if agent_phone else ''}
          </div>
          <div class="agent" style="margin-top:18px;opacity:.85">{_esc(brokerage)}<br>{_esc(agent_email)}</div>
        </div>
      </div>
      <div class="slide-foot"><span>{_esc(address)}</span><span>ListLogic · {_esc(generated)}</span></div>
    </section>

  </div>
</main>

<div class="nav-fab">
  <button type="button" id="fabPrev" aria-label="Previous">‹</button>
  <button type="button" id="fabNext" aria-label="Next">›</button>
</div>
<div class="hint">← → to flip · P for print layout · Esc back to Live Story</div>

<script>
(function() {{
  const slides = [...document.querySelectorAll('.slide')];
  const prog = document.getElementById('progLabel');
  const btnFlip = document.getElementById('btnFlip');
  const btnPrintMode = document.getElementById('btnPrintMode');
  const linkInteractive = document.getElementById('linkInteractive');
  let i = 0;
  let mode = 'flip';

  const params = new URLSearchParams(location.search);
  if (params.get('print') === '1' || location.hash === '#print') mode = 'print';

  // Resolve interactive href when served under /runs/id/
  const runMatch = location.pathname.match(/\\/runs\\/([^\\/]+)/);
  if (runMatch) {{
    linkInteractive.href = '/runs/' + runMatch[1] + '/';
  }} else if (location.pathname.endsWith('deck.html')) {{
    linkInteractive.href = location.pathname.replace(/deck\\.html$/i, 'presentation.html');
  }}

  function fitBodies() {{
    document.querySelectorAll('.slide').forEach(slide => {{
      const body = slide.querySelector('.slide-body');
      if (!body) return;
      body.style.transform = '';
      body.style.width = '';
      body.style.transformOrigin = '';
      // Only fit when slide is laid out (on-screen or print mode)
      if (!slide.classList.contains('is-on') && mode !== 'print') return;
      const avail = body.clientHeight;
      const need = body.scrollHeight;
      if (!avail || need <= avail + 2) return;
      const scale = Math.max(0.78, Math.min(1, avail / need));
      body.style.transformOrigin = 'top center';
      body.style.transform = 'scale(' + scale.toFixed(3) + ')';
      body.style.width = (100 / scale).toFixed(2) + '%';
      body.style.marginLeft = ((100 - (100 / scale)) / 2).toFixed(2) + '%';
    }});
  }}

  function setMode(next) {{
    mode = next;
    document.body.classList.toggle('mode-flip', mode === 'flip');
    document.body.classList.toggle('mode-print', mode === 'print');
    btnFlip.classList.toggle('on', mode === 'flip');
    btnPrintMode.classList.toggle('on', mode === 'print');
    if (mode === 'print') {{
      slides.forEach(s => {{ s.classList.add('is-on'); s.classList.remove('is-exit'); }});
      prog.textContent = slides.length + ' pages';
    }} else {{
      go(i, false);
    }}
    const url = new URL(location.href);
    if (mode === 'print') url.searchParams.set('print', '1');
    else url.searchParams.delete('print');
    history.replaceState(null, '', url);
    requestAnimationFrame(() => requestAnimationFrame(fitBodies));
  }}

  function go(n, animate) {{
    if (mode === 'print') return;
    n = Math.max(0, Math.min(slides.length - 1, n));
    const prev = i;
    i = n;
    slides.forEach((s, idx) => {{
      s.classList.toggle('is-on', idx === i);
      s.classList.toggle('is-exit', animate && idx === prev && idx !== i);
    }});
    prog.textContent = (i + 1) + ' / ' + slides.length;
    requestAnimationFrame(() => requestAnimationFrame(fitBodies));
  }}

  document.getElementById('btnPrev').onclick = () => go(i - 1, true);
  document.getElementById('btnNext').onclick = () => go(i + 1, true);
  document.getElementById('fabPrev').onclick = () => go(i - 1, true);
  document.getElementById('fabNext').onclick = () => go(i + 1, true);
  btnFlip.onclick = () => setMode('flip');
  btnPrintMode.onclick = () => setMode('print');
  document.getElementById('btnPrint').onclick = () => {{
    setMode('print');
    setTimeout(() => {{ fitBodies(); window.print(); }}, 160);
  }};

  document.addEventListener('keydown', e => {{
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {{
      e.preventDefault(); go(i + 1, true);
    }} else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {{
      e.preventDefault(); go(i - 1, true);
    }} else if (e.key === 'Home') go(0, true);
    else if (e.key === 'End') go(slides.length - 1, true);
    else if (e.key === 'p' || e.key === 'P') setMode(mode === 'print' ? 'flip' : 'print');
    else if (e.key === 'Escape') location.href = linkInteractive.href;
  }});

  // Touch swipe
  let tx = null;
  document.getElementById('deck').addEventListener('touchstart', e => {{
    tx = e.changedTouches[0].screenX;
  }}, {{ passive: true }});
  document.getElementById('deck').addEventListener('touchend', e => {{
    if (tx == null) return;
    const dx = e.changedTouches[0].screenX - tx;
    if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1), true);
    tx = null;
  }}, {{ passive: true }});

  window.addEventListener('resize', () => requestAnimationFrame(fitBodies));
  window.addEventListener('beforeprint', fitBodies);
  window.__deckFit = fitBodies;

  setMode(mode);
}})();
</script>
<script>
const DATA = {json.dumps(deck_data, allow_nan=False)};
const defaults = {json.dumps(deck_defaults, allow_nan=False)};
const RUN_ID = (location.pathname.match(/\\/runs\\/([^\\/]+)/)||[])[1] || '';
(function() {{
  const ratingMult = {{1:0.90,2:0.92,3:0.94,4:0.96,5:0.98,6:1.00,7:1.025,8:1.045,9:1.07,10:1.09}};
  let currentRec = defaults.rec, currentLow = defaults.low, currentHigh = defaults.high, currentDom = defaults.dom, currentRating = 5;
  let blManual = false;

  function money(n) {{ return '$' + Math.round(Number(n)).toLocaleString('en-US'); }}
  function ratingLabel(r) {{
    if (r <= 3) return 'Needs Work';
    if (r <= 6) return 'Typical';
    if (r <= 8) return 'Strong';
    return 'Exceptional';
  }}
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
      expectedDom = queueDom;
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
    return {{ expectedDom, odds, freshBelow: Math.round(freshBelow * 10) / 10 }};
  }}
  function supplyStatsAtPrice(price) {{
    const lf = DATA.listingFlow || {{}};
    const samples = lf.samples || [];
    const sqft = +lf.subjectSqft || 0;
    const dom = +lf.medianDomForWait || DATA.medianDom || 45;
    const inBand = (row) => !sqft || !row.s || (row.s >= sqft * 0.8 && row.s <= sqft * 1.2);
    if (!price || !samples.length) {{
      return {{ belowPm: lf.newBelowRecPm || 0, activeBelow: lf.activeBelowRec || 0, waitFresh: lf.freshDuringMedianDom || 0, dom }};
    }}
    const band = samples.filter(inBand);
    const below = band.filter(row => row.p < price);
    const byMonth = {{}};
    below.forEach(row => {{ if (row.m) byMonth[row.m] = (byMonth[row.m] || 0) + 1; }});
    const months = Object.keys(byMonth).sort().slice(-6);
    const belowPm = months.length ? months.reduce((sum, m) => sum + byMonth[m], 0) / months.length : 0;
    const activeBelow = band.filter(row => row.a && row.p < price).length;
    return {{ belowPm, activeBelow, waitFresh: belowPm * (dom / 30.44), dom }};
  }}
  function setText(id, text) {{
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }}
  function climateLine(rec, low, high, dom) {{
    const inv = +(DATA.inv || 0);
    let climate = "a buyer's market";
    if (inv < 2.5) climate = "a strong seller's market";
    else if (inv < 4.5) climate = "a seller-favorable market";
    else if (inv < 7) climate = "a balanced market";
    const soldN = Math.round(+(DATA.soldCount || 0));
    return 'This is ' + climate + ' with ' + inv.toFixed(1) + ' months of inventory. Based on ' +
      soldN + ' recent sales, your home is best positioned between ' + money(low) + ' and ' +
      money(high) + ', with a recommended list price of ' + money(rec) +
      '. At that level we would expect roughly ' + Math.round(dom) + ' days to contract. Launch inside the competitive range — that creates the strongest outcome.';
  }}
  function setupPriceSlider(rec, selectedPrice) {{
    const slider = document.getElementById('deckPriceSlider');
    if (!slider) return;
    const lo = Math.round(rec * 0.92 / 1000) * 1000;
    const hi = Math.round(rec * 1.12 / 1000) * 1000;
    slider.dataset.lo = lo; slider.dataset.hi = hi; slider.dataset.rec = rec;
    const thumb = selectedPrice != null ? selectedPrice : rec;
    slider.value = Math.min(100, Math.max(0, Math.round(100 * (thumb - lo) / Math.max(hi - lo, 1))));
  }}
  function priceFromSlider() {{
    const slider = document.getElementById('deckPriceSlider');
    if (!slider) return currentRec;
    const lo = +slider.dataset.lo || currentRec * 0.92;
    const hi = +slider.dataset.hi || currentRec * 1.12;
    return Math.round((lo + (hi - lo) * (+slider.value / 100)) / 1000) * 1000;
  }}
  function paintPrice(rec, low, high, dom, askPrice) {{
    currentRec = rec; currentLow = low; currentHigh = high; currentDom = dom;
    const ask = askPrice != null ? askPrice : rec;
    const out = estimateAtPrice(rec, ask, DATA.medianDom, DATA.marketOdds, DATA.inv);
    const top = topPct(ask);
    setText('deckRec', money(ask));
    setText('deckRange', money(low) + ' – ' + money(high));
    setText('deckDom', Math.round(out.expectedDom) + ' days');
    setText('deckTopPct', 'Top ' + top + '% of similar recent sales');
    setText('deckTopStmt', 'At this list, you would be priced in the top ' + top + '% of recent similar sales.');
    setText('deckPosTop', 'Top ' + top + '%');
    setText('deckSlidePrice', money(ask));
    setText('deckDockRec', 'Rec ' + money(rec));
    setText('deckDockRange', money(low) + ' – ' + money(high));
    setText('deckDockDom', '~' + Math.round(out.expectedDom) + ' days');
    setText('deckDockOdds', Math.round(out.odds * 100) + '% in 30d');
    setText('deckYoYRec', '$' + Math.round(rec / 1000) + 'k');
    setText('deckYoYDom', '~' + Math.round(out.expectedDom) + 'd');
    const marker = document.getElementById('deckPosMarker');
    if (marker) marker.style.left = 'calc(' + Math.min(98, Math.max(2, 100 - top)) + '% - 2px)';
    if (!blManual) {{
      const bl = document.getElementById('deckBL');
      if (bl) bl.textContent = climateLine(rec, low, high, out.expectedDom);
    }}
    const stats = supplyStatsAtPrice(ask);
    setText('deckWywAhead', String(stats.activeBelow || 0));
    setText('deckWywArrive', '~' + (stats.belowPm || 0).toFixed(1) + '/mo');
    const total = (stats.activeBelow || 0) + (stats.belowPm || 0) * (out.expectedDom / 30.44);
    setText('deckWywTotal', '~' + Math.max(0, Math.round(total)));
    setText('deckWywWait', '~' + Math.round(out.expectedDom) + 'd');
    document.querySelectorAll('#deckScGrid .sc[data-price]').forEach(card => {{
      const p = +card.dataset.price;
      if (!p) return;
      const sc = estimateAtPrice(rec, p, DATA.medianDom, DATA.marketOdds, DATA.inv);
      const meta = card.querySelector('.sc-m');
      if (meta) meta.textContent = '~' + sc.expectedDom + 'd · ' + Math.round(sc.odds * 100) + '% in 30d';
    }});
    if (window.__deckFit) requestAnimationFrame(window.__deckFit);
  }}
  function applyRating(r) {{
    currentRating = r;
    document.querySelectorAll('.pd-rate').forEach(b => b.classList.toggle('active', +b.dataset.rating === r));
    const base = defaults.rec / (ratingMult[defaults.rating] || 1);
    const newRec = Math.round(base * (ratingMult[r] || 1) / 1000) * 1000;
    const newLow = Math.round(newRec * 0.965 / 1000) * 1000;
    const newHigh = Math.round(newRec * 1.04 / 1000) * 1000;
    const out = estimateAtPrice(newRec, newRec, DATA.medianDom, DATA.marketOdds, DATA.inv);
    setText('deckRateScore', r + '/10');
    setText('deckRateLabel', ratingLabel(r));
    setText('deckPosRate', r + '/10');
    setText('deckPosRateLabel', ratingLabel(r));
    setupPriceSlider(newRec);
    paintPrice(newRec, newLow, newHigh, out.expectedDom, newRec);
  }}
  document.getElementById('deckRateRow')?.addEventListener('click', e => {{
    const btn = e.target.closest('.pd-rate');
    if (btn) applyRating(+btn.dataset.rating);
  }});
  let raf = 0;
  document.getElementById('deckPriceSlider')?.addEventListener('input', () => {{
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {{
      raf = 0;
      paintPrice(currentRec, currentLow, currentHigh, currentDom, priceFromSlider());
    }});
  }});

  function listHtml(id, text) {{
    const el = document.getElementById(id);
    if (!el) return;
    const items = String(text || '').split('\\n').map(s => s.trim()).filter(Boolean);
    el.innerHTML = items.length ? items.map(s => '<li>' + s.replace(/[&<>]/g, c => ({{'&':'&amp;','<':'&lt;','>':'&gt;'}}[c])) + '</li>').join('') : el.innerHTML;
  }}
  function applyStory(saved) {{
    if (!saved) return;
    if (saved.bl != null) {{
      blManual = true;
      setText('deckBL', saved.bl);
    }}
    if (saved.adv != null) listHtml('deckAdvList', saved.adv);
    if (saved.risk != null) listHtml('deckRiskList', saved.risk);
    const ledes = saved.ledes || {{}};
    document.querySelectorAll('[data-lede]').forEach(el => {{
      const key = el.getAttribute('data-lede');
      if (ledes[key]) el.textContent = ledes[key];
    }});
    if (saved.rating != null) applyRating(+saved.rating);
    else if (saved.rec != null) {{
      paintPrice(+saved.rec, +(saved.low || currentLow), +(saved.high || currentHigh), +(saved.dom || currentDom), +saved.rec);
      setupPriceSlider(+saved.rec);
    }}
  }}
  function collectLedes() {{
    const out = {{}};
    document.querySelectorAll('[data-lede]').forEach(el => {{
      out[el.getAttribute('data-lede')] = el.textContent.trim();
    }});
    return out;
  }}
  function persistDeckEdits() {{
    if (!RUN_ID) return;
    const payload = {{
      rec: currentRec, low: currentLow, high: currentHigh, dom: currentDom,
      rating: currentRating,
      bl: (document.getElementById('deckBL') || {{}}).textContent || '',
      adv: [...document.querySelectorAll('#deckAdvList li')].map(li => li.textContent.trim()).join('\\n'),
      risk: [...document.querySelectorAll('#deckRiskList li')].map(li => li.textContent.trim()).join('\\n'),
      ledes: collectLedes(),
    }};
    try {{
      const prev = JSON.parse(localStorage.getItem('listlogic_edits_' + RUN_ID) || '{{}}');
      Object.assign(prev, payload);
      localStorage.setItem('listlogic_edits_' + RUN_ID, JSON.stringify(prev));
      fetch('/api/runs/' + RUN_ID + '/edits', {{
        method: 'POST', headers: {{ 'Content-Type': 'application/json' }},
        credentials: 'same-origin', body: JSON.stringify(prev),
      }}).catch(() => {{}});
    }} catch (e) {{}}
  }}
  function enableInlineEdits() {{
    document.body.classList.add('ll-agent');
    const mark = (el) => {{
      if (!el) return;
      el.contentEditable = 'true';
      el.spellcheck = true;
    }};
    document.querySelectorAll('[data-lede], [data-edit]').forEach(mark);
    document.querySelectorAll('#deckAdvList li, #deckRiskList li').forEach(mark);
    document.addEventListener('focusin', e => {{
      if (e.target && e.target.id === 'deckBL') blManual = true;
    }});
    document.addEventListener('focusout', e => {{
      if (!e.target || !e.target.closest('[data-lede], [data-edit], #deckAdvList, #deckRiskList')) return;
      persistDeckEdits();
    }});
  }}

  document.getElementById('deckReset')?.addEventListener('click', () => {{
    blManual = false;
    if (defaults.bl) setText('deckBL', defaults.bl);
    if (defaults.adv != null) listHtml('deckAdvList', defaults.adv);
    if (defaults.risk != null) listHtml('deckRiskList', defaults.risk);
    const ledes = defaults.ledes || {{}};
    document.querySelectorAll('[data-lede]').forEach(el => {{
      const key = el.getAttribute('data-lede');
      if (ledes[key]) el.textContent = ledes[key];
    }});
    applyRating(5);
    persistDeckEdits();
  }});

  setupPriceSlider(currentRec);
  applyRating(5);

  async function boot() {{
    let saved = null;
    if (RUN_ID) {{
      try {{
        const res = await fetch('/api/runs/' + RUN_ID + '/edits');
        if (res.ok) saved = await res.json();
      }} catch (e) {{}}
    }}
    if (!saved || !Object.keys(saved).length) {{
      try {{ saved = JSON.parse(localStorage.getItem('listlogic_edits_' + (RUN_ID || 'local')) || 'null'); }} catch (e) {{ saved = null; }}
    }}
    applyStory(saved);
    try {{
      const auth = await fetch('/api/auth-status', {{ credentials: 'same-origin' }}).then(r => r.json());
      if (auth && auth.authenticated && auth.user) enableInlineEdits();
    }} catch (e) {{}}
  }}
  boot();
}})();
</script>
</body>
</html>
"""
    return html


def save_deck_html(
    report: dict,
    output_path: str | Path,
    *,
    interactive_href: str = "presentation.html",
) -> Path:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        render_deck_html(report, interactive_href=interactive_href),
        encoding="utf-8",
    )
    return path
