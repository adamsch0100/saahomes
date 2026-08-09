"""
ListLogic – Landscape, Visual-First Presentation
Bigger charts, interactive controls, one clear view at a time.
"""

from __future__ import annotations
import json
from pathlib import Path
from datetime import datetime
from core import (
    create_full_report, SubjectProperty, load_export, filter_market,
    build_scatter_data, compute_market_stats, compute_listing_flow,
    estimate_price_outcome, format_month_label, build_price_response_model,
)
import pandas as pd
import numpy as np


def _bottom_line_from_report(report: dict) -> str:
    """Seller bottom-line paragraph locked to the *current* recommended list/range.

    Core + LLM sometimes write this before the presentation opens at a typical 5/10
    rating (which shifts the recommended dollars). Always rebuild from live positioning
    so the Price It verdict and Bottom Line never disagree.
    """
    s = report.get("stats") or {}
    pos = report.get("positioning") or {}
    inv = float(s.get("months_of_inventory") or 0)
    if inv < 2.5:
        climate = "a strong seller's market"
    elif inv < 4.5:
        climate = "a seller-favorable market"
    elif inv < 7:
        climate = "a balanced market"
    else:
        climate = "a buyer's market"
    rec = float(pos.get("recommended_price") or 0)
    low = float(pos.get("price_low") or 0)
    high = float(pos.get("price_high") or 0)
    dom = float(pos.get("expected_dom") or s.get("median_dom") or 0)
    sold_n = int(s.get("sold_count") or 0)
    if not rec:
        return (
            f"This is {climate} with {inv:.1f} months of inventory and {sold_n} recent sales. "
            "Price with the comps and launch inside the competitive range."
        )
    return (
        f"This is {climate} with {inv:.1f} months of inventory. "
        f"Based on {sold_n} recent sales, your home is best positioned "
        f"between ${low:,.0f} and ${high:,.0f}, "
        f"with a recommended list price of ${rec:,.0f}. "
        f"At that level we would expect roughly {dom:.0f} days to contract. "
        f"Launch inside the competitive range — that creates the strongest outcome."
    )


def build_presentation(
    export_path: str,
    subject: SubjectProperty,
    area_name: str = "Greeley, CO",
    city_filter: str = "",
    agent_name: str = "Your Agent",
    agent_phone: str = "",
    agent_email: str = "",
    brokerage: str = "",
    mode: str = "listing",
    market_notes: str = "",
) -> dict:
    report = create_full_report(
        export_path,
        area_name=area_name,
        city_filter=city_filter or "",
        subject=subject,
        market_notes=market_notes or "",
    )
    report["meta"] = {
        "mode": mode,
        "agent_name": agent_name,
        "agent_phone": agent_phone,
        "agent_email": agent_email,
        "brokerage": brokerage,
        "generated": datetime.now().strftime("%B %d, %Y"),
        "market_notes": market_notes or "",
        "market_label": area_name,
    }

    df = load_export(export_path)
    market = filter_market(df, city=city_filter or None)
    sold = market[market["StatusNorm"] == "Sold"].copy()
    active = market[market["StatusNorm"] == "Active"].copy()
    pending = market[market["StatusNorm"] == "Pending"].copy()

    # Monthly sales
    if len(sold) and sold["SoldDate"].notna().any():
        sold["Month"] = sold["SoldDate"].dt.to_period("M").astype(str)
        monthly = sold.groupby("Month").size()
        report["chart_monthly_sales"] = {
            "labels": [format_month_label(m, short=True) for m in monthly.index.tolist()],
            "values": monthly.values.tolist(),
        }
        # Yearly
        sold["Year"] = sold["SoldDate"].dt.year.astype(str)
        yearly = sold.groupby("Year").size()
        report["chart_yearly_sales"] = {
            "labels": yearly.index.tolist(),
            "values": yearly.values.tolist(),
        }
        # Median price by month
        med_price = sold.groupby("Month")["SoldPrice"].median()
        report["chart_monthly_price"] = {
            "labels": [format_month_label(m, short=True) for m in med_price.index.tolist()],
            "values": [round(v) for v in med_price.values.tolist()],
        }
        # Median sold price by month, split at the recommended list — shows whether
        # homes above or below the subject's price line are the ones actually closing
        rec_for_bands = float((report.get("positioning") or {}).get("recommended_price") or 0)
        if not rec_for_bands:
            med_all = sold["SoldPrice"].median()
            rec_for_bands = float(med_all) if pd.notna(med_all) else 0
        if rec_for_bands:
            below = sold[sold["SoldPrice"] < rec_for_bands].groupby("Month")["SoldPrice"].median()
            above = sold[sold["SoldPrice"] >= rec_for_bands].groupby("Month")["SoldPrice"].median()
            below_n = sold[sold["SoldPrice"] < rec_for_bands].groupby("Month").size()
            above_n = sold[sold["SoldPrice"] >= rec_for_bands].groupby("Month").size()
            months_all = med_price.index.tolist()
            report["chart_monthly_price_bands"] = {
                "labels": [format_month_label(m, short=True) for m in months_all],
                "below": [round(float(below.get(m))) if pd.notna(below.get(m)) else None for m in months_all],
                "above": [round(float(above.get(m))) if pd.notna(above.get(m)) else None for m in months_all],
                "below_counts": [int(below_n.get(m, 0)) for m in months_all],
                "above_counts": [int(above_n.get(m, 0)) for m in months_all],
                "split_price": round(rec_for_bands),
            }
        # Median DOM by month
        med_dom = sold.groupby("Month")["DOM"].median()
        report["chart_monthly_dom"] = {
            "labels": [format_month_label(m, short=True) for m in med_dom.index.tolist()],
            "values": [round(v, 1) if pd.notna(v) else 0 for v in med_dom.values.tolist()],
        }

        # Year-over-year comparisons (two-year MLS pull)
        years = sorted(sold["SoldDate"].dt.year.dropna().unique().tolist())
        yoy_years = [int(y) for y in years[-2:]] if years else []
        yoy_summary = []
        yoy_sales = {"labels": [], "values": []}
        yoy_price = {"labels": [], "values": []}
        yoy_dom = {"labels": [], "values": []}
        for y in yoy_years:
            ydf = sold[sold["SoldDate"].dt.year == y]
            label = str(y)
            yoy_sales["labels"].append(label)
            yoy_sales["values"].append(int(len(ydf)))
            yoy_price["labels"].append(label)
            yoy_price["values"].append(int(round(float(ydf["SoldPrice"].median()))) if len(ydf) else 0)
            yoy_dom["labels"].append(label)
            yoy_dom["values"].append(round(float(ydf["DOM"].median()), 1) if len(ydf) and ydf["DOM"].notna().any() else 0)
            yoy_summary.append({
                "year": int(y),
                "sales": int(len(ydf)),
                "median_price": float(ydf["SoldPrice"].median()) if len(ydf) else None,
                "median_dom": float(ydf["DOM"].median()) if len(ydf) and ydf["DOM"].notna().any() else None,
                "median_ppsf": float(ydf["PricePerSqFt"].median()) if "PricePerSqFt" in ydf.columns and ydf["PricePerSqFt"].notna().any() else None,
            })

        # Same-month alignment: this year vs last year by calendar month
        yoy_monthly = {"labels": [], "this_year": [], "last_year": [], "this_year_label": "", "last_year_label": ""}
        if len(yoy_years) >= 2:
            last_y, this_y = yoy_years[-2], yoy_years[-1]
            yoy_monthly["last_year_label"] = str(last_y)
            yoy_monthly["this_year_label"] = str(this_y)
            month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            last_df = sold[sold["SoldDate"].dt.year == last_y]
            this_df = sold[sold["SoldDate"].dt.year == this_y]
            last_counts = last_df.groupby(last_df["SoldDate"].dt.month).size()
            this_counts = this_df.groupby(this_df["SoldDate"].dt.month).size()
            # Only show months that exist in either year
            months = sorted(set(last_counts.index.tolist()) | set(this_counts.index.tolist()))
            for m in months:
                yoy_monthly["labels"].append(month_names[int(m) - 1])
                yoy_monthly["last_year"].append(int(last_counts.get(m, 0)))
                yoy_monthly["this_year"].append(int(this_counts.get(m, 0)))
        elif len(yoy_years) == 1:
            yoy_monthly["this_year_label"] = str(yoy_years[0])

        report["chart_yoy"] = {
            "years": yoy_years,
            "summary": yoy_summary,
            "sales": yoy_sales,
            "median_price": yoy_price,
            "median_dom": yoy_dom,
            "monthly_sales": yoy_monthly,
        }
    else:
        report["chart_monthly_sales"] = {"labels": [], "values": []}
        report["chart_yearly_sales"] = {"labels": [], "values": []}
        report["chart_monthly_price"] = {"labels": [], "values": []}
        report["chart_monthly_dom"] = {"labels": [], "values": []}
        report["chart_yoy"] = {
            "years": [],
            "summary": [],
            "sales": {"labels": [], "values": []},
            "median_price": {"labels": [], "values": []},
            "median_dom": {"labels": [], "values": []},
            "monthly_sales": {"labels": [], "this_year": [], "last_year": [], "this_year_label": "", "last_year_label": ""},
        }

    # DOM distribution
    doms = sold["DOM"].dropna()
    if len(doms):
        bins = [0, 15, 30, 45, 60, 90, 120, 999]
        labels = ["0-15", "16-30", "31-45", "46-60", "61-90", "91-120", "120+"]
        cats = pd.cut(doms, bins=bins, labels=labels, right=True)
        counts = cats.value_counts().reindex(labels, fill_value=0)
        report["chart_dom"] = {
            "labels": labels,
            "values": counts.values.tolist(),
            "median": float(doms.median()),
            "mean": float(doms.mean()),
        }
    else:
        report["chart_dom"] = {"labels": [], "values": [], "median": 0, "mean": 0}

    report["active_count"] = len(active)
    report["under_contract_count"] = len(pending)
    report["active_median_price"] = float(active["Price"].median()) if len(active) else 0

    # Full market data table for Agent Tools / presentation grid
    table_cols = [
        "Status", "MLSNumber", "Address", "DisplayPrice", "SoldPrice", "Price",
        "LivingArea", "Beds", "Baths", "YearBuilt", "DOM", "PPSF", "Subdivision", "Garage",
        "SoldDate", "City",
    ]
    # Optional listing photo columns if agent included them in the MLS export
    for photo_col in (
        "PhotoURL", "PrimaryPhotoURL", "PrimaryPhoto", "MediaURL", "Photo",
        "ImageURL", "ListingPhoto", "PhotoLink", "MainPhotoURL", "PhotoUrl",
    ):
        if photo_col in market.columns and photo_col not in table_cols:
            table_cols.append(photo_col)
            break
    default_cols = [
        "Status", "MLSNumber", "Address", "DisplayPrice", "LivingArea", "Beds", "Baths",
        "YearBuilt", "DOM", "PPSF",
    ]
    table_df = market.copy()
    table_df["Beds"] = table_df.get("Bdrm")
    table_df["Baths"] = table_df.get("Bath")
    table_df["Garage"] = table_df.get("GarSpaces")
    table_df["PPSF"] = table_df.get("PricePerSqFt")
    table_df["DisplayPrice"] = np.where(
        table_df["StatusNorm"] == "Sold",
        table_df["SoldPrice"],
        table_df["Price"],
    )
    rows = []
    for _, row in table_df.iterrows():
        item = {}
        for col in table_cols:
            val = row.get(col)
            if col == "Status":
                val = row.get("StatusNorm") or row.get("Status")
            if col == "SoldDate" and pd.notna(val):
                try:
                    item[col] = str(pd.Timestamp(val).date())
                    continue
                except Exception:
                    pass
            if pd.isna(val):
                item[col] = None
            elif isinstance(val, (np.floating, float)):
                item[col] = float(val)
            elif isinstance(val, (np.integer, int)):
                item[col] = int(val)
            else:
                item[col] = str(val)
        item["StatusNorm"] = str(row.get("StatusNorm") or "")
        lat = row.get("Latitude")
        lng = row.get("Longitude")
        item["Latitude"] = float(lat) if pd.notna(lat) else None
        item["Longitude"] = float(lng) if pd.notna(lng) else None
        rows.append(item)
    report["full_table"] = rows
    report["table_columns"] = table_cols
    report["default_columns"] = default_cols

    sold_with_prices = sold.dropna(subset=["Price", "SoldPrice"])
    if len(sold_with_prices):
        ratios = sold_with_prices["SoldPrice"] / sold_with_prices["Price"].replace(0, np.nan)
        ratios = ratios.replace([np.inf, -np.inf], np.nan).dropna()
        report["list_to_sale"] = {
            "count": int(len(ratios)),
            "median": float(ratios.median()) if len(ratios) else None,
            "mean": float(ratios.mean()) if len(ratios) else None,
        }
    else:
        report["list_to_sale"] = {"count": 0, "median": None, "mean": None}

    # Storyline metrics for the multi-page seller presentation
    pos = report.get("positioning") or {}
    subj = report.get("subject") or {}
    rec = float(pos.get("recommended_price") or 0)
    cond = str(subj.get("condition") or "average")
    rating_map = {"needs_work": 3, "average": 5, "updated": 8, "renovated": 9}
    home_rating = 5  # presentation always opens at typical 5/10 (0% vs typical)
    cond_adj = {
        "needs_work": 0.93,
        "average": 1.00,
        "updated": 1.045,
        "renovated": 1.08,
    }.get(cond, 1.0)
    rating5_mult = 0.98  # matches client ratingMult[5]
    rec_mls = rec
    if rec_mls and cond_adj:
        rec = round(rec_mls * (rating5_mult / cond_adj) / 1000) * 1000
        low = round(rec * 0.965 / 1000) * 1000
        high = round(rec * 1.04 / 1000) * 1000
        pos["recommended_price"] = rec
        pos["price_low"] = low
        pos["price_high"] = high
        scale = rec / rec_mls if rec_mls else 1.0
        for sc in pos.get("price_scenarios") or []:
            lp = float(sc.get("list_price") or 0)
            if lp:
                sc["list_price"] = round(lp * scale / 1000) * 1000
        # Core executive_summary was written against the pre-5/10 price — rewrite now
        report["positioning"] = pos
        report["executive_summary"] = _bottom_line_from_report(report)

    sold_band = sold.copy()
    living = float(subj.get("living_area") or 0)
    if living and len(sold_band):
        sold_band = sold_band[
            (sold_band["LivingArea"] >= living * 0.8) & (sold_band["LivingArea"] <= living * 1.2)
        ]
    sold_prices = sold_band["SoldPrice"].dropna() if len(sold_band) else sold["SoldPrice"].dropna()
    if rec and len(sold_prices):
        below = int((sold_prices < rec).sum())
        price_percentile = round(100.0 * below / len(sold_prices), 1)
    else:
        price_percentile = 50.0
    # "top X%" = share of similar sales at or above this list
    top_of_market_pct = max(1.0, round(100.0 - price_percentile, 1))

    trend_value = None
    slope = pos.get("trend_slope")
    intercept = pos.get("trend_intercept")
    if living and slope is not None and intercept is not None:
        trend_value = float(slope) * living + float(intercept)

    # Active competition points for scatter (ghost markers)
    active_scatter = []
    for _, row in active.dropna(subset=["LivingArea", "Price"]).head(80).iterrows():
        active_scatter.append({
            "x": float(row["LivingArea"]),
            "y": float(row["Price"]),
            "label": str(row.get("Address") or "")[:32],
        })

    # Active list-price bands (Focus-style competition positioning)
    active_prices = active["Price"].dropna() if len(active) else pd.Series(dtype=float)
    chart_active_price_bands: dict = {
        "labels": [], "values": [], "subject_band_index": None, "band_width": 0, "insight": "",
    }
    if len(active_prices) and rec:
        width = 25000.0 if rec < 500_000 else 50_000.0
        lo = float(np.floor(active_prices.min() / width) * width)
        hi = float(np.ceil(active_prices.max() / width) * width)
        if hi <= lo:
            hi = lo + width
        edges = np.arange(lo, hi + width * 0.5, width)
        if len(edges) < 2:
            edges = np.array([lo, lo + width])
        # Cap bins for readability
        if len(edges) > 12:
            # widen until ≤11 bands
            while len(edges) > 12:
                width *= 2
                lo = float(np.floor(active_prices.min() / width) * width)
                hi = float(np.ceil(active_prices.max() / width) * width)
                edges = np.arange(lo, hi + width * 0.5, width)
        counts, bin_edges = np.histogram(active_prices, bins=edges)
        labels = []
        for a, b in zip(bin_edges[:-1], bin_edges[1:]):
            labels.append(f"${a/1000:.0f}k–${b/1000:.0f}k")
        subj_idx = None
        for i, (a, b) in enumerate(zip(bin_edges[:-1], bin_edges[1:])):
            if a <= rec < b or (i == len(bin_edges) - 2 and rec == b):
                subj_idx = i
                break
        if subj_idx is None and len(labels):
            # Outside range — clamp to nearest edge
            subj_idx = 0 if rec < bin_edges[0] else len(labels) - 1
        in_band = int(counts[subj_idx]) if subj_idx is not None and len(counts) else 0
        total_act = int(len(active_prices))
        insight = (
            f"At ${rec:,.0f}, buyers comparing Active homes in your band see about "
            f"{in_band} competing list{'s' if in_band != 1 else ''} "
            f"(of {total_act} Active overall)."
        )
        chart_active_price_bands = {
            "labels": labels,
            "values": [int(v) for v in counts.tolist()],
            "subject_band_index": subj_idx,
            "band_width": int(width),
            "insight": insight,
            "recommended": rec,
        }
    report["chart_active_price_bands"] = chart_active_price_bands

    sold_price_list = [float(v) for v in sold_prices.tolist() if pd.notna(v)]

    inv_story = float(report["stats"].get("months_of_inventory") or 0)
    odds_story = float(report["stats"].get("odds_of_selling") or 0)
    median_dom_story = float(report["stats"].get("median_dom") or 0)
    sales_mo_story = float(report["stats"].get("absorption_rate") or 0)

    listing_flow = compute_listing_flow(
        market,
        sales_mo_story,
        rec,
        living,
    )
    report["listing_flow"] = listing_flow
    report["chart_listing_flow"] = listing_flow.get("chart") or {}

    stats_d = report["stats"]
    price_response = build_price_response_model(market, stats_d, rec, living)
    report["price_response"] = price_response
    for sc in pos.get("price_scenarios") or []:
        lp = float(sc.get("list_price") or 0)
        if not lp:
            continue
        out = estimate_price_outcome(stats_d, rec, lp, listing_flow, price_response)
        sc["expected_dom"] = out["expected_dom"]
        sc["odds_30_day"] = out["odds_30_day"]
        sc["fresh_competitors_below"] = out.get("fresh_competitors_below", 0)
        sc["method"] = out.get("method")
    bal_sc = next(
        (s for s in pos.get("price_scenarios") or [] if "Balanced" in s.get("label", "")),
        None,
    )
    if bal_sc:
        pos["expected_dom"] = bal_sc["expected_dom"]

    # Peak activity month from monthly sales chart
    monthly = report.get("chart_monthly_sales") or {}
    m_labels = monthly.get("labels") or []
    m_values = monthly.get("values") or []
    peak_month = None
    if m_labels and m_values:
        try:
            peak_i = int(np.argmax(np.array(m_values, dtype=float)))
            peak_month = format_month_label(m_labels[peak_i], short=False)
            peak_n = int(m_values[peak_i])
        except Exception:
            peak_month, peak_n = None, 0
    else:
        peak_n = 0

    wait_fresh = 0.0
    below_pm = float(listing_flow.get("new_below_recommended_per_month") or 0)
    if below_pm > 0 and median_dom_story > 0:
        wait_fresh = below_pm * (median_dom_story / 30.44)
    listing_flow["fresh_during_median_dom"] = round(wait_fresh, 1)
    listing_flow["median_dom_for_wait"] = round(median_dom_story, 0)
    report["listing_flow"] = listing_flow

    seller_questions = {
        "how_long": (
            f"Well-priced homes in this segment typically go under contract in about "
            f"<b>{median_dom_story:.0f} days</b> (median DOM)."
        ),
        "odds": (
            f"A well-priced new listing has about a <b>{odds_story * 100:.0f}%</b> chance "
            f"of going under contract in any given 30-day window at "
            f"<b>{inv_story:.1f}</b> months of inventory."
        ),
        "when_active": (
            f"Recent sales pace is <b>{sales_mo_story:.1f}/month</b>"
            + (
                f"; the busiest recent month was <b>{peak_month}</b> ({peak_n} sales)."
                if peak_month else "."
            )
        ),
        "new_supply": (
            f"About <b>{listing_flow.get('new_listings_per_month', 0):.1f}</b> new listings arrive "
            f"each month vs <b>{listing_flow.get('sales_per_month', sales_mo_story):.1f}</b> sales "
            f"(supply pressure <b>{listing_flow.get('supply_pressure', 0):.2f}×</b>)."
            + (
                f" Against the comp-supported value line of "
                f"<b>${listing_flow.get('threshold_price') or rec:,.0f}</b>, "
                f"~<b>{listing_flow.get('new_below_recommended_per_month', 0):.1f}</b>/month "
                f"list cheaper in your size band."
                if listing_flow.get("new_below_recommended_per_month") else ""
            )
        ),
        "peak_month": peak_month,
        "peak_sales": peak_n,
    }

    objection_cards = [
        {
            "title": "Inventory pressure",
            "body": (
                f"Buyers currently choose among {len(active)} actives. With yours that becomes {len(active) + 1}. "
                f"At {inv_story:.1f} months of inventory, pricing outside the competitive band extends days on market."
            ),
        },
        {
            "title": "Overpricing risk",
            "body": (
                f"A well-priced listing has about {odds_story * 100:.0f}% odds of going under contract in ~30 days. "
                f"About {listing_flow.get('new_listings_per_month', 0):.1f} new listings/month keep arriving — "
                "price too high and fresher, better-value homes become the ones buyers tour first."
            ),
        },
        {
            "title": "Condition vs comps",
            "body": (
                f"Starting home rating {home_rating}/10 "
                f"({{3: 'needs work', 5: 'typical', 8: 'updated', 9: 'renovated'}}.get(home_rating, 'typical')). "
                "Adjust the rating live — the recommended list and market position update with it."
            ),
        },
    ]

    report["story"] = {
        "active_on_market": int(len(active)),
        "with_your_home": int(len(active)) + 1,
        "under_contract": int(len(pending)),
        "closed_sales": int(len(sold)),
        "sales_per_month": sales_mo_story,
        "months_of_inventory": inv_story,
        "home_rating": home_rating,
        "home_rating_label": {
            3: "Needs work vs most comps",
            5: "Average / typical for the area",
            8: "Updated above typical comps",
            9: "Renovated / top of segment",
        }.get(home_rating, "Average / typical for the area"),
        "price_percentile": price_percentile,
        "top_of_market_pct": top_of_market_pct,
        "top_percent_statement": (
            f"At the recommended list, you would be priced in the top {top_of_market_pct:.0f}% of recent similar sales "
            f"(above about {price_percentile:.0f}% of those closes)."
            if rec else "Comparable sales will set the competitive band."
        ),
        "trend_value": round(trend_value / 1000) * 1000 if trend_value else None,
        "sold_prices": sold_price_list,
        "active_scatter": active_scatter,
        "objection_cards": objection_cards,
        "seller_questions": seller_questions,
        "market_odds": odds_story,
        "median_dom": median_dom_story,
        "did_not_sell": report.get("did_not_sell") or {},
        "market_definition": report.get("market_definition") or {},
        "derivation_steps": [
            f"There are {len(active)} actives now — with yours, buyers choose among {len(active) + 1}.",
            "Anchor on the sold-price trend for similar square footage.",
            "Blend the closest comparable sales (weighted by similarity).",
            "Adjust for your home rating (condition / presentation vs comps).",
            "Test aggressive → premium list prices for DOM and odds trade-offs.",
            "Arrive at one recommended list and a competitive range.",
        ],
    }

    try:
        from llm_narrative import NarrativeEngine, enhance_report_with_llm
        report = enhance_report_with_llm(report, NarrativeEngine.auto())
    except Exception as exc:
        print(f"[warn] LLM narrative layer skipped: {exc}")

    # LLM may paraphrase prices — lock Bottom Line to the live recommended list
    report["executive_summary"] = _bottom_line_from_report(report)
    return report


def render_premium_html(report: dict) -> str:
    s = report["stats"]
    pos = report.get("positioning") or {}
    subject = report.get("subject") or {}
    meta = report.get("meta") or {}

    inv = s.get("months_of_inventory", 0)
    odds_pct = s.get("odds_of_selling", 0) * 100
    rec = pos.get("recommended_price") or 0
    low = pos.get("price_low") or 0
    high = pos.get("price_high") or 0
    exp_dom = pos.get("expected_dom") or 0
    active_n = report.get("active_count", s.get("active_count", 0))
    uc_n = report.get("under_contract_count", s.get("pending_count", 0))

    if inv < 2.5:
        temp_label, temp_class = "Strong Seller's Market", "hot"
    elif inv < 4.5:
        temp_label, temp_class = "Seller-Favorable", "warm"
    elif inv < 7:
        temp_label, temp_class = "Balanced", "neutral"
    else:
        temp_label, temp_class = "Buyer's Market", "cool"

    position_line = (
        f"List near <strong>${rec:,.0f}</strong> "
        f"(range <strong>${low:,.0f} – ${high:,.0f}</strong>) "
        f"to target under contract in ~<strong>{exp_dom:.0f} days</strong>."
    )

    points = report.get("scatter_points", [])[:180]
    scatter_js = json.dumps([
        {"x": p["LivingArea"], "y": p["SoldPrice"], "label": (p.get("Address") or "")[:32]}
        for p in points
    ])
    trend = report.get("scatter_trend") or {"slope": 0, "intercept": 0}
    if points:
        xs = [p["LivingArea"] for p in points]
        trend_js = json.dumps([
            {"x": min(xs), "y": trend["slope"] * min(xs) + trend["intercept"]},
            {"x": max(xs), "y": trend["slope"] * max(xs) + trend["intercept"]},
        ])
    else:
        trend_js = "[]"

    subject_js = "null"
    if subject.get("living_area") and rec:
        subject_js = json.dumps({
            "x": subject["living_area"],
            "y": subject.get("list_price") or rec,
            "label": subject.get("address") or "Subject"
        })

    monthly = report.get("chart_monthly_sales") or {"labels": [], "values": []}
    yearly = report.get("chart_yearly_sales") or {"labels": [], "values": []}
    monthly_price = report.get("chart_monthly_price") or {"labels": [], "values": []}
    monthly_dom = report.get("chart_monthly_dom") or {"labels": [], "values": []}
    dom_chart = report.get("chart_dom") or {"labels": [], "values": [], "median": 0}

    sens_rows = ""
    for sc in pos.get("price_scenarios", []):
        cls = "rec" if "Balanced" in sc.get("label", "") else ""
        sens_rows += f"""
        <tr class="{cls}">
          <td>{sc['label']}</td>
          <td>${sc['list_price']:,.0f}</td>
          <td>~{sc['expected_dom']:.0f}d</td>
          <td>{sc['odds_30_day']*100:.0f}%</td>
        </tr>"""

    comps_rows = ""
    for c in pos.get("closest_comps", [])[:7]:
        comps_rows += f"""
        <tr>
          <td>{(c.get('address') or '')[:30]}</td>
          <td>${c['sold_price']:,.0f}</td>
          <td>{c['living_area']:.0f}</td>
          <td>{c['year_built']}</td>
          <td>{c['dom']:.0f}</td>
          <td>${c['price_per_sqft']:.0f}</td>
        </tr>"""

    agent_line = meta.get("agent_name") or ""
    if meta.get("brokerage"):
        agent_line += f" · {meta['brokerage']}"

    subject_line = ""
    if subject:
        bits = [subject.get("address") or "Subject"]
        if subject.get("living_area"):
            bits.append(f"{subject['living_area']:,.0f} sf")
        if subject.get("beds"):
            bits.append(f"{subject['beds']:.0f}/{subject.get('baths',0):.0f}")
        if subject.get("year_built"):
            bits.append(str(subject["year_built"]))
        subject_line = " · ".join(bits)

    exec_sum = report.get("executive_summary") or ""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ListLogic · {report.get('area','')}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
  :root {{
    --navy: #0c3c6e;
    --blue: #1a5f9e;
    --bg: #eef2f6;
    --card: #fff;
    --text: #1a2332;
    --muted: #5a6a7c;
    --border: #d0d9e4;
    --green: #0d7a4f;
    --rec: #e8f5e9;
    --hot: #fef2f2; --hot-t: #b91c1c;
    --warm: #fff7ed; --warm-t: #c2410c;
    --neutral: #eff6ff; --neutral-t: #1d4ed8;
    --cool: #f0fdf4; --cool-t: #15803d;
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    font-size: 14px;
    line-height: 1.4;
  }}
  .page {{
    max-width: 1100px;
    margin: 0 auto;
    padding: 16px 18px 36px;
  }}

  .hero {{
    background: linear-gradient(145deg, var(--navy), var(--blue));
    color: #fff;
    border-radius: 10px;
    padding: 16px 22px;
    margin-bottom: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }}
  .hero .brand {{ font-size: 0.68rem; letter-spacing: 0.14em; opacity: 0.7; text-transform: uppercase; }}
  .hero h1 {{ font-size: 1.35rem; font-weight: 700; }}
  .hero .meta {{ font-size: 0.8rem; opacity: 0.85; text-align: right; }}

  .subject {{
    background: #e4eef8;
    border: 1px solid #c5d6ea;
    border-radius: 8px;
    padding: 7px 14px;
    margin-bottom: 12px;
    font-size: 0.88rem;
  }}

  .bottom-line {{
    background: var(--card);
    border-left: 4px solid var(--navy);
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 12px;
    font-size: 0.92rem;
  }}

  .kpis {{
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }}
  @media (min-width: 700px) {{
    .kpis {{ grid-template-columns: repeat(8, 1fr); }}
  }}
  .kpi {{
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 6px;
    text-align: center;
  }}
  .kpi .v {{ font-size: 1.2rem; font-weight: 700; color: var(--navy); }}
  .kpi .l {{ font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin-top: 2px; }}

  .temp {{
    display: inline-block;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 0.72rem;
    font-weight: 600;
  }}
  .temp.hot {{ background: var(--hot); color: var(--hot-t); }}
  .temp.warm {{ background: var(--warm); color: var(--warm-t); }}
  .temp.neutral {{ background: var(--neutral); color: var(--neutral-t); }}
  .temp.cool {{ background: var(--cool); color: var(--cool-t); }}

  .position-box {{
    background: linear-gradient(135deg, #0c3c6e, #1a5f9e);
    color: #fff;
    border-radius: 10px;
    padding: 14px 20px;
    margin-bottom: 14px;
    text-align: center;
    font-size: 1.08rem;
    line-height: 1.5;
  }}
  .position-box strong {{ color: #fde68a; }}

  .price-row {{
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr;
    gap: 10px;
    margin: 10px 0 4px;
  }}
  .price-block {{
    background: #f8fafc;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    text-align: center;
  }}
  .price-block.main {{ background: var(--navy); color: #fff; border-color: var(--navy); }}
  .price-block .lbl {{ font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.85; }}
  .price-block .amt {{ font-size: 1.4rem; font-weight: 700; margin-top: 2px; }}
  .price-block.main .amt {{ font-size: 1.55rem; }}

  /* Full-width chart sections */
  .section {{
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px 18px;
    margin-bottom: 14px;
  }}
  .section h2 {{
    font-size: 1rem;
    color: var(--navy);
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
  }}
  .section .sub {{ font-size: 0.8rem; color: var(--muted); margin-bottom: 10px; }}

  .controls {{
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }}
  .controls button {{
    border: 1px solid var(--border);
    background: #f8fafc;
    color: var(--text);
    padding: 4px 12px;
    border-radius: 16px;
    font-size: 0.75rem;
    cursor: pointer;
    font-weight: 500;
  }}
  .controls button.active {{
    background: var(--navy);
    color: #fff;
    border-color: var(--navy);
  }}
  .controls button:hover {{ border-color: var(--blue); }}

  .chart-box {{
    position: relative;
    width: 100%;
    height: 340px;
  }}
  .chart-box.short {{ height: 260px; }}

  table {{ width: 100%; border-collapse: collapse; font-size: 0.82rem; }}
  th {{
    text-align: left;
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
    padding: 6px 8px;
    border-bottom: 1px solid var(--border);
  }}
  td {{ padding: 7px 8px; border-bottom: 1px solid var(--border); }}
  tr.rec {{ background: var(--rec); font-weight: 600; }}

  .two-col {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }}
  @media (max-width: 720px) {{
    .two-col {{ grid-template-columns: 1fr; }}
    .price-row {{ grid-template-columns: 1fr; }}
    .kpis {{ grid-template-columns: repeat(4, 1fr); }}
  }}

  .split {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }}
  .split ul {{ padding-left: 16px; font-size: 0.85rem; }}
  .muted {{ color: var(--muted); font-size: 0.8rem; }}

  footer {{
    text-align: center;
    color: var(--muted);
    font-size: 0.72rem;
    margin-top: 18px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
  }}

  @media print {{
    body {{ background: #fff; }}
    .page {{ max-width: 100%; }}
    .chart-box {{ height: 280px; }}
  }}
</style>
</head>
<body>
<div class="page">

<div class="hero">
  <div>
    <div class="brand">ListLogic</div>
    <h1>Market Presentation</h1>
  </div>
  <div class="meta">{agent_line}<br>{meta.get('generated','')} · {report.get('area','')}</div>
</div>

{f'<div class="subject"><strong>Subject:</strong> {subject_line}</div>' if subject_line else ''}

<div class="bottom-line"><strong>Bottom Line</strong> — {exec_sum}</div>

<div class="kpis">
  <div class="kpi"><div class="v">{s.get('sold_count',0)}</div><div class="l">Closed</div></div>
  <div class="kpi"><div class="v">{s.get('absorption_rate',0)}</div><div class="l">Sales/Mo</div></div>
  <div class="kpi"><div class="v">{active_n}</div><div class="l">Active</div></div>
  <div class="kpi"><div class="v">{uc_n}</div><div class="l">Under Contract</div></div>
  <div class="kpi"><div class="v">{inv}</div><div class="l">Mo Inventory</div></div>
  <div class="kpi"><div class="v">{odds_pct:.0f}%</div><div class="l">Sale Odds</div></div>
  <div class="kpi"><div class="v">${s.get('median_sold_price',0)/1000:.0f}k</div><div class="l">Median Sold</div></div>
  <div class="kpi"><div class="v">{s.get('median_dom',0):.0f}</div><div class="l">Med DOM</div></div>
</div>

<div class="position-box">{position_line}</div>

<div class="section">
  <h2>
    Recommended Pricing
    <span class="temp {temp_class}">{temp_label} · {inv} mo inventory</span>
  </h2>
  <div class="price-row">
    <div class="price-block main">
      <div class="lbl">Recommended List</div>
      <div class="amt">${rec:,.0f}</div>
    </div>
    <div class="price-block">
      <div class="lbl">Competitive Range</div>
      <div class="amt" style="font-size:1.2rem">${low:,.0f} – ${high:,.0f}</div>
    </div>
    <div class="price-block">
      <div class="lbl">Expected to Contract</div>
      <div class="amt" style="font-size:1.2rem">~{exp_dom:.0f} days</div>
    </div>
  </div>
  <p class="muted" style="margin-top:8px">
    Active listings = available inventory. Under contract (Pending + Backup) are already spoken for and not counted in months-of-inventory.
  </p>
</div>

<!-- SCATTER – full width, large -->
<div class="section">
  <h2>Price vs Square Feet</h2>
  <p class="sub">Each point is a closed sale. Orange line = market trend. Red pin = your home.</p>
  <div class="chart-box"><canvas id="scatter"></canvas></div>
</div>

<!-- SALES TREND – interactive MoM / YoY -->
<div class="section">
  <h2>
    Sales Volume Trend
    <span class="controls">
      <button type="button" class="active" data-chart="sales" data-mode="month">Month</button>
      <button type="button" data-chart="sales" data-mode="year">Year</button>
    </span>
  </h2>
  <p class="sub">Closed sales over time — switch between monthly and yearly view.</p>
  <div class="chart-box"><canvas id="salesTrend"></canvas></div>
</div>

<!-- PRICE TREND -->
<div class="section">
  <h2>Median Sold Price by Month</h2>
  <p class="sub">How pricing has moved in this market area.</p>
  <div class="chart-box short"><canvas id="priceTrend"></canvas></div>
</div>

<!-- DOM -->
<div class="section">
  <h2>
    Days on Market
    <span class="controls">
      <button type="button" class="active" data-chart="dom" data-mode="dist">Distribution</button>
      <button type="button" data-chart="dom" data-mode="trend">By Month</button>
    </span>
  </h2>
  <p class="sub">Median DOM overall: <strong>{dom_chart.get('median',0):.0f} days</strong>. Toggle distribution vs monthly trend.</p>
  <div class="chart-box short"><canvas id="domChart"></canvas></div>
</div>

<!-- PRICE STRATEGY + COMPS -->
<div class="two-col">
  <div class="section">
    <h2>Price Strategy</h2>
    <table>
      <thead><tr><th>Strategy</th><th>Price</th><th>DOM</th><th>Odds</th></tr></thead>
      <tbody>{sens_rows}</tbody>
    </table>
    <p class="muted" style="margin-top:8px">Highlighted = recommended.</p>
  </div>
  <div class="section">
    <h2>Closest Sales</h2>
    <table>
      <thead><tr><th>Address</th><th>Sold</th><th>SqFt</th><th>Year</th><th>DOM</th><th>$/SF</th></tr></thead>
      <tbody>{comps_rows}</tbody>
    </table>
  </div>
</div>

<div class="section">
  <div class="split">
    <div>
      <h2 style="border:none;margin:0 0 6px;font-size:0.9rem">Advantages</h2>
      <ul>{"".join(f"<li>{a}</li>" for a in (pos.get("advantages") or ["Solid fundamentals"]))}</ul>
    </div>
    <div>
      <h2 style="border:none;margin:0 0 6px;font-size:0.9rem">Watch-outs</h2>
      <ul>{"".join(f"<li>{r}</li>" for r in (pos.get("risks") or ["Overpricing vs demand"]))}</ul>
    </div>
  </div>
</div>

<footer>
  ListLogic · Active = available · Under Contract = Pending + Backup · Months of inventory uses Active only · {meta.get('generated','')}
</footer>

</div>

<script>
const navy = '#0c3c6e';
const orange = '#c2410c';
const blue = '#1a5f9e';

// Data payloads
const monthlySales = {json.dumps(monthly)};
const yearlySales = {json.dumps(yearly)};
const monthlyPrice = {json.dumps(monthly_price)};
const monthlyDom = {json.dumps(monthly_dom)};
const domDist = {json.dumps(dom_chart)};

// --- Scatter ---
new Chart(document.getElementById('scatter'), {{
  type: 'scatter',
  data: {{
    datasets: [
      {{
        label: 'Sold',
        data: {scatter_js},
        backgroundColor: 'rgba(12,60,110,0.4)',
        borderColor: navy,
        pointRadius: 5,
        pointHoverRadius: 7,
      }},
      {{
        label: 'Trend',
        data: {trend_js},
        type: 'line',
        borderColor: orange,
        borderWidth: 2.5,
        pointRadius: 0,
        fill: false,
      }},
      {f'''{{
        label: 'Your Home',
        data: [{subject_js}],
        backgroundColor: '#b91c1c',
        borderColor: '#b91c1c',
        pointRadius: 10,
        pointStyle: 'rectRot',
      }}''' if subject_js != 'null' else ''}
    ].filter(Boolean)
  }},
  options: {{
    responsive: true,
    maintainAspectRatio: false,
    plugins: {{
      legend: {{ position: 'top', labels: {{ boxWidth: 12, font: {{ size: 11 }} }} }},
      tooltip: {{
        callbacks: {{
          label: (c) => {{
            const p = c.raw;
            if (p && p.label) return p.label + ' · $' + Math.round(p.y).toLocaleString() + ' · ' + Math.round(p.x) + ' sf';
            return 'Trend';
          }}
        }}
      }}
    }},
    scales: {{
      x: {{ title: {{ display: true, text: 'Living Area (sq ft)' }}, grid: {{ color: '#e8eef5' }} }},
      y: {{
        title: {{ display: true, text: 'Sold Price' }},
        ticks: {{ callback: v => '$' + (v/1000) + 'k' }},
        grid: {{ color: '#e8eef5' }}
      }}
    }}
  }}
}});

// --- Sales trend (interactive) ---
let salesChart = new Chart(document.getElementById('salesTrend'), {{
  type: 'bar',
  data: {{
    labels: monthlySales.labels,
    datasets: [{{
      label: 'Closed Sales',
      data: monthlySales.values,
      backgroundColor: 'rgba(12,60,110,0.75)',
      borderRadius: 4,
    }}]
  }},
  options: {{
    responsive: true,
    maintainAspectRatio: false,
    plugins: {{ legend: {{ display: false }} }},
    scales: {{
      x: {{ ticks: {{ maxRotation: 45, font: {{ size: 10 }} }}, grid: {{ display: false }} }},
      y: {{ beginAtZero: true, grid: {{ color: '#e8eef5' }} }}
    }}
  }}
}});

// --- Price trend ---
new Chart(document.getElementById('priceTrend'), {{
  type: 'line',
  data: {{
    labels: monthlyPrice.labels,
    datasets: [{{
      label: 'Median Sold Price',
      data: monthlyPrice.values,
      borderColor: navy,
      backgroundColor: 'rgba(12,60,110,0.1)',
      fill: true,
      tension: 0.25,
      pointRadius: 3,
    }}]
  }},
  options: {{
    responsive: true,
    maintainAspectRatio: false,
    plugins: {{ legend: {{ display: false }} }},
    scales: {{
      x: {{ ticks: {{ maxRotation: 45, font: {{ size: 10 }} }}, grid: {{ display: false }} }},
      y: {{
        ticks: {{ callback: v => '$' + (v/1000) + 'k' }},
        grid: {{ color: '#e8eef5' }}
      }}
    }}
  }}
}});

// --- DOM chart (interactive) ---
let domChart = new Chart(document.getElementById('domChart'), {{
  type: 'bar',
  data: {{
    labels: domDist.labels,
    datasets: [{{
      label: 'Homes',
      data: domDist.values,
      backgroundColor: 'rgba(26,95,158,0.75)',
      borderRadius: 4,
    }}]
  }},
  options: {{
    responsive: true,
    maintainAspectRatio: false,
    plugins: {{ legend: {{ display: false }} }},
    scales: {{
      x: {{ title: {{ display: true, text: 'Days on Market' }}, grid: {{ display: false }} }},
      y: {{ beginAtZero: true, grid: {{ color: '#e8eef5' }} }}
    }}
  }}
}});

// Control buttons
document.querySelectorAll('.controls button').forEach(btn => {{
  btn.addEventListener('click', () => {{
    const chart = btn.dataset.chart;
    const mode = btn.dataset.mode;
    // toggle active state within group
    btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (chart === 'sales') {{
      if (mode === 'month') {{
        salesChart.data.labels = monthlySales.labels;
        salesChart.data.datasets[0].data = monthlySales.values;
      }} else {{
        salesChart.data.labels = yearlySales.labels;
        salesChart.data.datasets[0].data = yearlySales.values;
      }}
      salesChart.update();
    }}
    if (chart === 'dom') {{
      if (mode === 'dist') {{
        domChart.config.type = 'bar';
        domChart.data.labels = domDist.labels;
        domChart.data.datasets[0].data = domDist.values;
        domChart.data.datasets[0].label = 'Homes';
        domChart.options.scales.x.title = {{ display: true, text: 'Days on Market' }};
      }} else {{
        domChart.config.type = 'line';
        domChart.data.labels = monthlyDom.labels;
        domChart.data.datasets[0].data = monthlyDom.values;
        domChart.data.datasets[0].label = 'Median DOM';
        domChart.data.datasets[0].borderColor = navy;
        domChart.data.datasets[0].backgroundColor = 'rgba(12,60,110,0.1)';
        domChart.data.datasets[0].fill = true;
        domChart.data.datasets[0].tension = 0.25;
        domChart.options.scales.x.title = {{ display: true, text: 'Month' }};
      }}
      domChart.update();
    }}
  }});
}});
</script>
</body>
</html>
"""
    return html


def save_presentation(
    export_path: str,
    subject: SubjectProperty,
    output_dir: str = "output",
    area_name: str = "Greeley, CO",
    city_filter: str = "",
    agent_name: str = "Adam Schwartz",
    agent_phone: str = "(970) 533-3990",
    agent_email: str = "adam@saahomes.com",
    brokerage: str = "Schwartz and Associates, Coldwell Banker Realty",
    mode: str = "listing",
    market_notes: str = "",
):
    report = build_presentation(
        export_path,
        subject=subject,
        area_name=area_name,
        city_filter=city_filter or "",
        agent_name=agent_name,
        agent_phone=agent_phone,
        agent_email=agent_email,
        brokerage=brokerage,
        mode=mode,
        market_notes=market_notes or "",
    )
    try:
        from reef_photos import enrich_report_photos, reef_enabled

        if reef_enabled():
            photo_map = enrich_report_photos(report, run_dir=Path(output_dir), run_id="")
            print(f"[ok] Hosted photos: {len([v for v in photo_map.values() if v])} (MLS cache · Reef only on miss)")
    except Exception as exc:
        print(f"[warn] Reef photo enrichment skipped: {exc}")

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    with open(out / "presentation.json", "w") as f:
        json.dump(report, f, indent=2, default=str)

    from interactive_html import save_interactive_html
    from deck_html import save_deck_html
    from pdf_export import build_pdf, build_story_pdf

    html_path = save_interactive_html(report, out / "presentation.html")
    deck_path = save_deck_html(report, out / "deck.html")

    agent_name = report.get("meta", {}).get("agent_name") or ""
    brokerage = report.get("meta", {}).get("brokerage") or ""
    try:
        build_pdf(report, out / "presentation.pdf", agent_name=agent_name, brokerage=brokerage)
        build_story_pdf(report, out / "story.pdf", agent_name=agent_name, brokerage=brokerage)
        print(f"[ok] Seller packet PDF -> {out / 'presentation.pdf'}")
        print(f"[ok] Seller packet -> {out / 'story.pdf'}")
    except Exception as exc:
        print(f"[warn] PDF export skipped: {exc}")

    print(f"[ok] HTML -> {html_path}")
    print(f"[ok] Listing flipbook -> {deck_path}")
    if report.get("positioning"):
        p = report["positioning"]
        print(f"[ok] Recommended: ${p['recommended_price']:,.0f}")
        print(f"[ok] Months inventory (Active only): {report['stats']['months_of_inventory']}")
        print(f"[ok] Active: {report.get('active_count')} | Under contract: {report.get('under_contract_count')}")
        if report.get("llm_enhanced"):
            print("[ok] Narratives: AI-enhanced")
    return report, html_path


if __name__ == "__main__":
    from subject import resolve_subject, SUBJECT_2845_DEFAULTS
    _root = Path(__file__).resolve().parent
    _export = _root / "data" / "export-71.txt"
    subject = resolve_subject(
        str(_export),
        address="2845 W 13th Street Greeley 80634",
        defaults=SUBJECT_2845_DEFAULTS,
        overrides={"living_area": 2392},
    )
    save_presentation(
        str(_export),
        subject=subject,
        output_dir=str(_root / "output"),
        area_name="Greeley, CO (West / 80634)",
        city_filter="Greeley",
    )
