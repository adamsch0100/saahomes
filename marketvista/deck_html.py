"""Landscape flipbook + printable leave-behind deck for ListLogic presentations."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any


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
    exec_sum = report.get("executive_summary") or ""
    advantages = pos.get("advantages") or []
    risks = pos.get("risks") or []
    scenarios = pos.get("price_scenarios") or []
    comps = (pos.get("closest_comps") or [])[:8]

    brand_primary = meta.get("brand_primary") or "#0c3c6e"
    brand_accent = meta.get("brand_accent") or "#1a5f9e"
    logo_url = meta.get("logo_url") or ""
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

    temp_label = (
        "Strong seller's market" if inv < 2.5 else
        "Seller-favorable" if inv < 4 else
        "Balanced market" if inv < 6 else
        "Buyer-favorable"
    )

    logo_html = (
        f'<img class="logo" src="{_esc(logo_url)}" alt="">'
        if logo_url else ""
    )
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
        ("1", "Custom-Fit Market", "Size, garage, area, and timeframe — not the whole city."),
        ("2", "Absorption Sets Pace", f"{sales_mo:.1f} sales/mo vs {active_n} active → {inv:.1f} mo inventory."),
        ("3", "Active = Competition", f"Pending/Backup are spoken for. List, and buyers choose among {with_yours}."),
        ("4", "Closes Set Value", "Asking prices are opinions. Sold prices are facts."),
        ("5", "Condition Moves It", "We start at typical 5/10 — adjust together and the list responds."),
        ("6", "Price Buys Time", f"Well-priced homes here go UC in ~{median_dom:.0f} days."),
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
        (f"{s.get('sold_count', 0)}", "Recently Closed"),
        (f"{median_dom:.0f}", "Median DOM"),
        (f"${(s.get('median_sold_price') or 0)/1000:.0f}k", "Median Sold"),
        (f"${(s.get('median_price_per_sqft') or 0):.0f}", "Median $/Sf"),
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
        f'<div class="sc{" sc-main" if "Balanced" in (sc.get("label") or "") else ""}">'
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
    <section class="slide" data-title="Supply">
      <div class="slide-top"><span>{logo_html}Market</span><span>Supply Stream</span></div>
      <div class="slide-body">
        <div class="eyebrow">While a Home Sits</div>
        <h2>{_esc(supply_headline)}</h2>
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

    # —— While You Wait: the queue cost of overpricing ——
    wyw_slide = ""
    if show_supply and rec:
        wyw_total = lf_active_below + lf_wait_fresh
        # Stretch scenario: ~+6% above recommended
        stretch_price = round(rec * 1.06 / 1000) * 1000
        stretch_sc = next(
            (sc for sc in scenarios if "Premium" in (sc.get("label") or "") or "High" in (sc.get("label") or "")),
            scenarios[-1] if scenarios else None,
        )
        stretch_dom = float((stretch_sc or {}).get("expected_dom") or exp_dom * 1.6 or 0)
        stretch_fresh = lf_below * (stretch_dom / 30.44) if lf_below and stretch_dom else 0
        stretch_total = lf_active_below + stretch_fresh
        wyw_slide = f'''
    <section class="slide slide-wyw" data-title="While You Wait">
      <div class="slide-top"><span>{logo_html}Price It</span><span>The Cost of Waiting</span></div>
      <div class="slide-body">
        <div class="eyebrow">While You Wait</div>
        <h2>Overpricing Doesn't Pause the Market —<br>It Lets Other Homes Cut in Line.</h2>
        <p class="lede">Buyers tour the best value first. While a home sits overpriced, the homes already cheaper keep selling — and new ones keep listing under it.</p>
        <div class="wyw-grid">
          <div class="wyw-cell">
            <div class="wyw-v">{lf_active_below}</div>
            <div class="wyw-l">Already cheaper today</div>
            <div class="wyw-d">Active homes asking under ${rec:,.0f} — on the tour list first</div>
          </div>
          <div class="wyw-cell">
            <div class="wyw-v">~{lf_below:.1f}<span class="wyw-unit">/mo</span></div>
            <div class="wyw-l">New ones list under you</div>
            <div class="wyw-d">Similar homes that come on cheaper every month</div>
          </div>
          <div class="wyw-cell wyw-hot">
            <div class="wyw-v">~{wyw_total:.0f}</div>
            <div class="wyw-l">Pass you in ~{lf_wait_dom:.0f} days</div>
            <div class="wyw-d">Homes that sell or list ahead during one typical sale window</div>
          </div>
        </div>
        <div class="wyw-compare">
          <div class="wyw-row">
            <span class="wyw-row-label">At recommended <strong>${rec:,.0f}</strong></span>
            <div class="wyw-track"><div class="wyw-fill good" style="width:{min(92, max(8, 100 * (lf_wait_fresh / max(wyw_total + stretch_total, 1)) * 2)):.0f}%"></div></div>
            <span class="wyw-row-n">~{lf_wait_fresh:.1f} pass in ~{lf_wait_dom:.0f}d</span>
          </div>
          <div class="wyw-row">
            <span class="wyw-row-label">Stretch <strong>${stretch_price:,.0f}</strong></span>
            <div class="wyw-track"><div class="wyw-fill bad" style="width:{min(96, max(10, 100 * (stretch_total / max(wyw_total + stretch_total, 1)) * 2)):.0f}%"></div></div>
            <span class="wyw-row-n">~{stretch_total:.0f} pass in ~{stretch_dom:.0f}d</span>
          </div>
        </div>
        <p class="lede" style="margin-top:12px;max-width:64ch">Every week overpriced, your listing becomes the <strong>comp that sells the newer, cheaper one</strong>. At the recommended list, the queue works for you instead.</p>
      </div>
      <div class="slide-foot"><span>Queue math: cheaper Actives now + cheaper arrivals while you wait</span><span>ListLogic</span></div>
    </section>
'''

    ask = story.get("seller_questions") or {}
    ask_slide = f'''
    <section class="slide" data-title="Seller Qs">
      <div class="slide-top"><span>{logo_html}Market</span><span>What Sellers Ask</span></div>
      <div class="slide-body">
        <div class="eyebrow">Straight Answers</div>
        <h2>What Sellers Ask First</h2>
        <div class="facts-grid" style="margin-top:14px">
          <div class="fact"><span class="fn">?</span><div><div class="ft">How Long Should It Take?</div><div class="fb">{_plain(ask.get("how_long") or f"About {median_dom:.0f} days when priced well.")}</div></div></div>
          <div class="fact"><span class="fn">?</span><div><div class="ft">What Are the Odds?</div><div class="fb">{_plain(ask.get("odds") or f"About {odds_pct:.0f}% in ~30 days when priced well.")}</div></div></div>
          <div class="fact"><span class="fn">?</span><div><div class="ft">When Is the Market Active?</div><div class="fb">{_plain(ask.get("when_active") or f"About {sales_mo:.1f} sales per month.")}</div></div></div>
          <div class="fact"><span class="fn">?</span><div><div class="ft">New Supply?</div><div class="fb">{_plain(ask.get("new_supply") or "See the supply stream slide.")}</div></div></div>
        </div>
      </div>
      <div class="slide-foot"><span>{_esc(address)}</span><span>ListLogic</span></div>
    </section>
'''

    bands = report.get("chart_active_price_bands") or {}
    band_labels = bands.get("labels") or []
    band_values = bands.get("values") or []
    yours_idx = bands.get("subject_band_index")
    bands_slide = ""
    if band_labels and band_values:
        band_rows = ""
        for i, (lab, val) in enumerate(zip(band_labels[:8], band_values[:8])):
            mark = " yours" if yours_idx is not None and i == yours_idx else ""
            band_rows += (
                f'<div class="band-row{mark}"><span>{_esc(lab)}</span>'
                f'<strong>{int(val)}</strong></div>'
            )
        bands_slide = f'''
    <section class="slide" data-title="Price Bands">
      <div class="slide-top"><span>{logo_html}Market</span><span>Active List Bands</span></div>
      <div class="slide-body">
        <div class="eyebrow">Where Actives Sit by Ask</div>
        <h2>Active Competition by List-Price Band</h2>
        <p class="lede">{_esc(bands.get("insight") or "Highlighted band is the market-supported value line.")}</p>
        <div class="band-list">{band_rows}</div>
      </div>
      <div class="slide-foot"><span>Buyers shop by price first</span><span>ListLogic</span></div>
    </section>
'''

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
    position_slide = f'''
    <section class="slide" data-title="Position">
      <div class="slide-top"><span>{logo_html}Your Home</span><span>Market Position</span></div>
      <div class="slide-body">
        <div class="eyebrow">Where the List Sits</div>
        <h2>Position in Recent Sales</h2>
        <p class="lede">{_esc(top_stmt)}</p>
        <div class="duo" style="margin-top:16px">
          <div class="d"><div class="n">Top {top_mkt:.0f}%</div><div class="t">of similar sales</div></div>
          <div class="d yours"><div class="n">{rating}/10</div><div class="t">{_esc(rating_label)}</div></div>
        </div>
        <p class="lede" style="margin-top:12px">{_esc(trend_line)}</p>
        <p class="lede">{_esc(pos.get("competitive_statement") or "")}</p>
      </div>
      <div class="slide-foot"><span>Starts at typical 5/10 in live story</span><span>ListLogic</span></div>
    </section>
'''
    yoy = report.get("chart_yoy") or {}
    yoy_summary = yoy.get("summary") or []
    yoy_slide = ""
    if yoy_summary:
        yoy_kpis = "".join(
            f'<div class="kpi"><div class="kv">{_esc(y.get("year"))}</div>'
            f'<div class="kl">{y.get("sales", 0)} sales · ${(y.get("median_price") or 0)/1000:.0f}k · '
            f'{(y.get("median_dom") or 0):.0f}d DOM</div></div>'
            for y in yoy_summary[:4]
        )
        yoy_slide = f'''
    <section class="slide" data-title="YoY">
      <div class="slide-top"><span>{logo_html}Market Detail</span><span>Year Over Year</span></div>
      <div class="slide-body">
        <div class="eyebrow">Context Behind the Number</div>
        <h2>Year-Over-Year Market Detail</h2>
        <p class="lede">Sales, median sold price, and DOM by year in this segment.</p>
        <div class="kpis" style="margin-top:18px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">{yoy_kpis}</div>
      </div>
      <div class="slide-foot"><span>{_esc(address)}</span><span>ListLogic</span></div>
    </section>
'''

    objections = story.get("objection_cards") or []
    obj_slide = ""
    if objections:
        obj_cards = "".join(
            f'<div class="fact"><span class="fn">!</span><div><div class="ft">{_esc(c.get("title"))}</div>'
            f'<div class="fb">{_esc(c.get("body"))}</div></div></div>'
            for c in objections[:4]
        )
        obj_slide = f'''
    <section class="slide" data-title="Watch-Outs">
      <div class="slide-top"><span>{logo_html}Objections</span><span>What Often Comes Up</span></div>
      <div class="slide-body">
        <div class="eyebrow">Honest Conversation</div>
        <h2>What Often Comes Up at the Table</h2>
        <div class="facts-grid" style="margin-top:14px">{obj_cards}</div>
      </div>
      <div class="slide-foot"><span>Data keeps the talk on the market</span><span>ListLogic</span></div>
    </section>
'''

    adv_html = "".join(f"<li>{_esc(a)}</li>" for a in advantages[:4]) or "<li>Solid fundamentals</li>"
    risk_html = "".join(f"<li>{_esc(r)}</li>" for r in risks[:4]) or "<li>Overpricing risk</li>"

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
  min-height: 100vh; padding: 64px 18px 28px;
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
  transform: none !important; width: 100%; aspect-ratio: 16 / 9;
  break-after: page; page-break-after: always; box-shadow: 0 8px 28px rgba(0,0,0,.25);
}}

.slide-top {{
  display: flex; justify-content: space-between; align-items: center; gap: 12px;
  padding: 16px 22px 0; color: var(--muted); font-size: .72rem; font-weight: 700;
  letter-spacing: .08em; text-transform: uppercase;
}}
.slide-top .logo {{ height: 22px; background: #fff; border-radius: 4px; padding: 2px 4px; }}
.slide-body {{ padding: 12px 28px 8px; overflow: hidden; }}
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
.duo .d {{
  background: #fff; border: 1px solid var(--border); border-radius: 16px; padding: 22px; text-align: center;
}}
.duo .d.yours {{
  background: linear-gradient(145deg, var(--navy), var(--accent)); color: #fff; border: none;
}}
.duo .n {{ font-size: clamp(2.4rem, 5vw, 3.4rem); font-weight: 800; letter-spacing: -.03em; line-height: 1; }}
.duo .t {{ margin-top: 8px; font-size: .75rem; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; opacity: .85; }}
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

/* Comps */
.comps-grid {{
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 10px;
}}
.cc {{ background: #fff; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }}
.cc-photo {{ height: 110px; background-size: cover; background-position: center; background: #1a2332; }}
.cc-photo.cc-empty {{ background: linear-gradient(135deg, #0f2740, #1a4568); }}
.cc-body {{ padding: 8px 10px 10px; }}
.cc-price {{ font-size: 1.05rem; font-weight: 800; color: var(--navy); }}
.cc-addr {{ font-size: .75rem; font-weight: 700; margin-top: 2px; line-height: 1.25; }}
.cc-meta {{ font-size: .65rem; color: var(--muted); margin-top: 3px; }}

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

@media print {{
  @page {{ size: landscape; margin: 0.35in; }}
  html, body {{ background: #fff !important; }}
  .deck-chrome, .nav-fab, .hint {{ display: none !important; }}
  .stage {{ padding: 0 !important; background: #fff !important; }}
  .deck {{ max-width: none !important; width: 100% !important; gap: 0 !important; }}
  .slide {{
    position: relative !important; opacity: 1 !important; transform: none !important;
    box-shadow: none !important; border-radius: 0 !important;
    width: 100% !important; height: auto !important; min-height: 0 !important;
    aspect-ratio: 16 / 9; break-after: page; page-break-after: always;
    border: 1px solid #e5e7eb;
  }}
  .slide:last-child {{ break-after: auto; page-break-after: auto; }}
}}
</style>
</head>
<body class="mode-flip">
<header class="deck-chrome">
  <div class="left">
    <span class="brand">ListLogic · Listing flipbook</span>
    <a href="{_esc(interactive_href)}" id="linkInteractive">Interactive</a>
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

    <section class="slide slide-cover is-on" data-title="Cover">
      <div class="slide-top"><span>{logo_html}ListLogic</span><span>Pricing Story</span></div>
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

    <section class="slide" data-title="How We Price">
      <div class="slide-top"><span>{logo_html}How We Price</span><span>Ground Rules</span></div>
      <div class="slide-body">
        <div class="eyebrow">Core Facts of ListLogic — Data Driven Pricing</div>
        <h2>Built Around This Home — Not the Citywide Average</h2>
        <p class="lede">Every number comes from <strong>{_esc(market_label)}</strong>: homes a buyer would actually cross-shop with yours.</p>
        <div class="facts-grid">{facts_html}</div>
      </div>
      <div class="slide-foot"><span>{_esc(address)}</span><span>ListLogic</span></div>
    </section>

    <section class="slide" data-title="Competition">
      <div class="slide-top"><span>{logo_html}Market</span><span>Competition</span></div>
      <div class="slide-body">
        <div class="eyebrow">Your Competitive Market</div>
        <h2>{_esc(market_label)}</h2>
        <div class="pills">{chip_html}</div>
        <p class="lede" style="margin-top:10px">Only <strong>Active</strong> homes compete. Pending + Backup are already spoken for.</p>
        <div class="duo">
          <div class="d"><div class="n">{active_n}</div><div class="t">Active on Market</div></div>
          <div class="d yours"><div class="n">{with_yours}</div><div class="t">With Your Home Included</div></div>
        </div>
      </div>
      <div class="slide-foot"><span>{_esc(temp_label)} · {inv:.1f} mo inventory</span><span>ListLogic</span></div>
    </section>

    <section class="slide" data-title="Market Pulse">
      <div class="slide-top"><span>{logo_html}Market</span><span>Pulse</span></div>
      <div class="slide-body">
        <div class="eyebrow">Segment Snapshot</div>
        <h2>What the Numbers Say Right Now</h2>
        <p class="lede">Absorption, inventory, and pace — the leverage behind the list.</p>
        <div class="kpis" style="margin-top:18px">{kpis_html}</div>
      </div>
      <div class="slide-foot"><span>{_esc(address)}</span><span>ListLogic</span></div>
    </section>
{ask_slide}
{supply_slide}
{bands_slide}
    <section class="slide" data-title="Comps">
      <div class="slide-top"><span>{logo_html}Comparables</span><span>Closest Sales</span></div>
      <div class="slide-body">
        <div class="eyebrow">Proof on the Ground</div>
        <h2>Closest Comparable Sales</h2>
        <p class="lede">Does it look like yours — or nicer / dated — and does the sold price match that story?</p>
        <div class="comps-grid">{comps_html}</div>
      </div>
      <div class="slide-foot"><span>{len(comps)} close sales</span><span>ListLogic</span></div>
    </section>

    <section class="slide" data-title="Condition">
      <div class="slide-top"><span>{logo_html}Your Home</span><span>Condition</span></div>
      <div class="slide-body">
        <div class="eyebrow">Location Is Fixed · We Start at Typical 5/10</div>
        <h2>Condition Moves the Number</h2>
        <p class="lede">Within your segment, updates and presentation decide where you land. We start at a typical <strong>5/10</strong>, rate together, then lock the list.</p>
        <div class="facts-grid" style="margin-top:20px">
          <div class="fact"><span class="fn">1–3</span><div><div class="ft">Needs Work</div><div class="fb">Dated finishes or deferred maintenance vs comps.</div></div></div>
          <div class="fact"><span class="fn">4–6</span><div><div class="ft">Typical</div><div class="fb">5 is average for this set — nothing special, nothing broken.</div></div></div>
          <div class="fact"><span class="fn">7–8</span><div><div class="ft">Strong</div><div class="fb">Updated kitchen/baths — buyers notice.</div></div></div>
          <div class="fact"><span class="fn">9–10</span><div><div class="ft">Exceptional</div><div class="fb">Turnkey premium — top of the set.</div></div></div>
        </div>
      </div>
      <div class="slide-foot"><span>Rate together at the table</span><span>ListLogic</span></div>
    </section>
{position_slide}
{yoy_slide}
    <section class="slide slide-verdict" data-title="Recommended">
      <div class="slide-top"><span>{logo_html}Price It</span><span>Recommendation</span></div>
      <div class="slide-body">
        <div class="verdict-wrap">
          <div class="eyebrow">Recommended List Price</div>
          <div class="big">${rec:,.0f}</div>
          <div class="sub">Range <strong>${low:,.0f} – ${high:,.0f}</strong> · target under contract in ~<strong>{exp_dom:.0f} days</strong></div>
          <div class="top">Top {top_mkt:.0f}% of similar recent sales</div>
          <div class="pos-bar"><div class="pos-marker"></div></div>
          <div class="bl">{_esc(exec_sum)}</div>
        </div>
      </div>
      <div class="slide-foot"><span>{_esc(address)}</span><span>ListLogic</span></div>
    </section>
{wyw_slide}
    <section class="slide" data-title="Strategy">
      <div class="slide-top"><span>{logo_html}Strategy</span><span>Trade-Offs</span></div>
      <div class="slide-body">
        <div class="eyebrow">If You Go Higher or Lower</div>
        <h2>Price Strategies &amp; Trade-Offs</h2>
        <p class="lede" style="margin-bottom:8px">Buyers choose better value first. Higher list → longer wait and weaker odds as cheaper homes cut in line.</p>
        <div class="sc-grid">{scenarios_html or '<p class="muted">Strategies available in interactive view</p>'}</div>
        <div class="split">
          <div><h3>Advantages</h3><ul>{adv_html}</ul></div>
          <div><h3>Watch-Outs</h3><ul>{risk_html}</ul></div>
        </div>
      </div>
      <div class="slide-foot"><span>Pick a lane — the market answers</span><span>ListLogic</span></div>
    </section>
{obj_slide}

    <section class="slide slide-close" data-title="Next">
      <div class="slide-top"><span>{logo_html}Next Steps</span><span>Let's List It Right</span></div>
      <div class="slide-body">
        <div class="close-inner">
          <div class="eyebrow">Ready When You Are</div>
          <h1>Price with the data.<br>Win with the story.</h1>
          <p class="lede" style="color:rgba(255,255,255,.85)">We'll fine-tune condition, lock the list, and launch with a plan buyers can believe.</p>
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
<div class="hint">← → to flip · P for print layout · Esc back to interactive</div>

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
  }}

  document.getElementById('btnPrev').onclick = () => go(i - 1, true);
  document.getElementById('btnNext').onclick = () => go(i + 1, true);
  document.getElementById('fabPrev').onclick = () => go(i - 1, true);
  document.getElementById('fabNext').onclick = () => go(i + 1, true);
  btnFlip.onclick = () => setMode('flip');
  btnPrintMode.onclick = () => setMode('print');
  document.getElementById('btnPrint').onclick = () => {{
    setMode('print');
    setTimeout(() => window.print(), 120);
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

  setMode(mode);
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
