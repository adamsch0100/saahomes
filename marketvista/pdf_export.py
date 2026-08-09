"""
ListLogic – Clean PDF Export
Print-ready leave-behind for listing appointments.
"""

from __future__ import annotations
from pathlib import Path
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white, black
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, ListFlowable, ListItem, PageBreak,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from core import create_full_report, SubjectProperty


NAVY = HexColor("#0c3c6e")
BLUE = HexColor("#1a5f9e")
MUTED = HexColor("#5c6b7a")
LIGHT = HexColor("#f5f8fc")
GREEN = HexColor("#0d7a4f")
BORDER = HexColor("#e1e8f0")
RECOMMEND_BG = HexColor("#ecf8f0")
AMBER = HexColor("#b3541e")
AMBER_DARK = HexColor("#8a3c10")
AMBER_BG = HexColor("#fdf3e3")
AMBER_LINE = HexColor("#ecd9b8")


def _esc_pdf(text: object) -> str:
    return (
        str(text or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _styles():
    base = getSampleStyleSheet()
    styles = {
        "brand": ParagraphStyle(
            "brand", parent=base["Normal"],
            fontSize=9, textColor=MUTED, letterSpacing=1.5,
            spaceAfter=2, fontName="Helvetica"
        ),
        "title": ParagraphStyle(
            "title", parent=base["Normal"],
            fontSize=18, textColor=NAVY, fontName="Helvetica-Bold",
            spaceAfter=4, leading=22
        ),
        "subtitle": ParagraphStyle(
            "subtitle", parent=base["Normal"],
            fontSize=10, textColor=MUTED, spaceAfter=8
        ),
        "section": ParagraphStyle(
            "section", parent=base["Normal"],
            fontSize=12, textColor=NAVY, fontName="Helvetica-Bold",
            spaceBefore=14, spaceAfter=6, leading=15
        ),
        "body": ParagraphStyle(
            "body", parent=base["Normal"],
            fontSize=9.5, textColor=black, leading=13, spaceAfter=4
        ),
        "body_bold": ParagraphStyle(
            "body_bold", parent=base["Normal"],
            fontSize=9.5, textColor=NAVY, fontName="Helvetica-Bold", leading=13
        ),
        "small": ParagraphStyle(
            "small", parent=base["Normal"],
            fontSize=8, textColor=MUTED, leading=11
        ),
        "kpi_val": ParagraphStyle(
            "kpi_val", parent=base["Normal"],
            fontSize=14, textColor=NAVY, fontName="Helvetica-Bold",
            alignment=TA_CENTER, leading=17
        ),
        "kpi_lbl": ParagraphStyle(
            "kpi_lbl", parent=base["Normal"],
            fontSize=7, textColor=MUTED, alignment=TA_CENTER,
            letterSpacing=0.5
        ),
        "price_big": ParagraphStyle(
            "price_big", parent=base["Normal"],
            fontSize=16, textColor=white, fontName="Helvetica-Bold",
            alignment=TA_CENTER, leading=20
        ),
        "price_lbl": ParagraphStyle(
            "price_lbl", parent=base["Normal"],
            fontSize=7.5, textColor=HexColor("#d0dce8"),
            alignment=TA_CENTER, letterSpacing=0.4
        ),
        "footer": ParagraphStyle(
            "footer", parent=base["Normal"],
            fontSize=7.5, textColor=MUTED, alignment=TA_CENTER
        ),
        "wyw_title": ParagraphStyle(
            "wyw_title", parent=base["Normal"],
            fontSize=12, textColor=AMBER_DARK, fontName="Helvetica-Bold",
            spaceBefore=2, spaceAfter=3, leading=15
        ),
        "wyw_val": ParagraphStyle(
            "wyw_val", parent=base["Normal"],
            fontSize=15, textColor=AMBER_DARK, fontName="Helvetica-Bold",
            alignment=TA_CENTER, leading=18
        ),
        "wyw_val_inv": ParagraphStyle(
            "wyw_val_inv", parent=base["Normal"],
            fontSize=15, textColor=white, fontName="Helvetica-Bold",
            alignment=TA_CENTER, leading=18
        ),
        "wyw_lbl": ParagraphStyle(
            "wyw_lbl", parent=base["Normal"],
            fontSize=7, textColor=HexColor("#9a6a3a"), alignment=TA_CENTER,
            letterSpacing=0.5
        ),
        "wyw_lbl_inv": ParagraphStyle(
            "wyw_lbl_inv", parent=base["Normal"],
            fontSize=7, textColor=HexColor("#f5e3c8"), alignment=TA_CENTER,
            letterSpacing=0.5
        ),
        "wyw_body": ParagraphStyle(
            "wyw_body", parent=base["Normal"],
            fontSize=9, textColor=HexColor("#6b4a22"), leading=12.5, spaceAfter=4
        ),
    }
    return styles


def build_pdf(report: dict, output_path: str | Path, agent_name: str = "", brokerage: str = ""):
    """Seller packet — consolidated with build_story_pdf."""
    return build_story_pdf(report, output_path, agent_name=agent_name, brokerage=brokerage)


def export_presentation_pdf(
    export_path: str,
    subject: SubjectProperty,
    output_dir: str = "output",
    area_name: str = "Greeley, CO",
    city_filter: str = "Greeley",
    agent_name: str = "Adam Schwartz",
    brokerage: str = "Schwartz and Associates, Coldwell Banker Realty",
):
    from presentation import build_presentation
    report = build_presentation(
        export_path,
        subject=subject,
        area_name=area_name,
        city_filter=city_filter,
        agent_name=agent_name,
        brokerage=brokerage,
    )
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    pdf_path = out / "presentation.pdf"
    build_pdf(report, pdf_path, agent_name=agent_name, brokerage=brokerage)
    print(f"[ok] PDF -> {pdf_path}")
    return pdf_path


def build_story_pdf(report: dict, output_path: str | Path, agent_name: str = "", brokerage: str = ""):
    """Portrait seller packet — printable leave-behind mirroring the live story."""
    styles = _styles()
    s = report["stats"]
    pos = report.get("positioning") or {}
    subject = report.get("subject") or {}
    meta = report.get("meta") or {}
    story = report.get("story") or {}
    yoy = report.get("chart_yoy") or {}
    bands = report.get("chart_active_price_bands") or {}
    ask = story.get("seller_questions") or {}

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=letter,
        leftMargin=0.6 * inch,
        rightMargin=0.6 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.55 * inch,
    )
    flow = []
    addr = (subject.get("address") or "Your home") if subject else "Your home"
    flow.append(Paragraph("ListLogic · Seller Packet", styles["brand"]))
    flow.append(Paragraph(addr, styles["title"]))
    sub = f"{report.get('area', '')}  ·  {meta.get('generated') or datetime.now().strftime('%B %d, %Y')}"
    if agent_name:
        sub += f"  ·  {agent_name}"
    if brokerage:
        sub += f"  ·  {brokerage}"
    flow.append(Paragraph(sub, styles["subtitle"]))
    flow.append(HRFlowable(width="100%", thickness=1.5, color=NAVY, spaceAfter=8))

    active_n = story.get("active_on_market", report.get("active_count", 0))
    with_yours = story.get("with_your_home", active_n + 1)
    uc_n = story.get("under_contract", report.get("under_contract_count", 0))
    inv = float(story.get("months_of_inventory", s.get("months_of_inventory", 0)) or 0)
    odds_pct = float(story.get("market_odds") or s.get("odds_of_selling") or 0) * 100
    median_dom = float(story.get("median_dom") or s.get("median_dom") or 0)
    sales_mo = float(story.get("sales_per_month") or s.get("absorption_rate") or 0)
    rec = float(pos.get("recommended_price") or 0)
    low = float(pos.get("price_low") or 0)
    high = float(pos.get("price_high") or 0)
    dom = float(pos.get("expected_dom") or 0)
    top_mkt = float(story.get("top_of_market_pct") or 50)
    rating = int(story.get("home_rating") or 5)
    rating_label = story.get("home_rating_label") or "Average / typical for the area"
    trend_val = story.get("trend_value")
    objections = story.get("objection_cards") or []
    dns = story.get("did_not_sell") or report.get("did_not_sell") or {}
    mdef = report.get("market_definition") or story.get("market_definition") or {}
    subj_bits = []
    if subject.get("living_area"):
        subj_bits.append(f"{float(subject['living_area']):,.0f} sq ft")
    if subject.get("beds"):
        subj_bits.append(f"{float(subject.get('beds') or 0):.0f} bed / {float(subject.get('baths') or 0):.0f} bath")
    if subject.get("year_built"):
        yb = subject.get("year_built")
        subj_bits.append(f"Built {int(yb) if isinstance(yb, float) else yb}")
    if subject.get("garage_spaces"):
        subj_bits.append(f"{float(subject['garage_spaces']):.0f}-car garage")

    # —— How we price (mirrors live Core Facts) ——
    flow.append(Paragraph("How We Price — Core Facts", styles["section"]))
    if mdef.get("label") or (mdef.get("chips")):
        chips = ", ".join(str(c) for c in (mdef.get("chips") or [])[:6])
        flow.append(Paragraph(
            f"<b>Market cut:</b> {_esc_pdf(mdef.get('label') or report.get('area') or 'Custom segment')}"
            + (f" · {chips}" if chips else ""),
            styles["small"],
        ))
    if subj_bits:
        flow.append(Paragraph(f"<b>Subject:</b> {' · '.join(subj_bits)}", styles["small"]))
    facts = [
        [Paragraph("<b>1. Custom-Fit Market</b>", styles["body_bold"]),
         Paragraph("Size, garage, area, and timeframe — apples-to-apples vs what buyers compare.", styles["body"])],
        [Paragraph("<b>2. Absorption Sets Pace</b>", styles["body_bold"]),
         Paragraph(f"{sales_mo:.1f} sales/mo vs {active_n} Active → <b>{inv:.1f}</b> months of inventory.", styles["body"])],
        [Paragraph("<b>3. Active = Competition</b>", styles["body_bold"]),
         Paragraph(f"Pending/Backup are spoken for. List, and buyers choose among <b>{with_yours}</b>.", styles["body"])],
        [Paragraph("<b>4. Closes Set Value</b>", styles["body_bold"]),
         Paragraph("Asking prices are opinions. Sold prices are facts — the list is anchored to recent closes.", styles["body"])],
        [Paragraph("<b>5. Condition Moves It</b>", styles["body_bold"]),
         Paragraph("We start at a typical <b>5/10</b>, rate together, and the list responds.", styles["body"])],
        [Paragraph("<b>6. Price Buys Time</b>", styles["body_bold"]),
         Paragraph(f"Well-priced homes here go under contract in about <b>{median_dom:.0f}</b> days.", styles["body"])],
    ]
    ft = Table(facts, colWidths=[2.0 * inch, 4.9 * inch])
    ft.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [LIGHT, white]),
    ]))
    flow.append(ft)

    flow.append(Paragraph("Your Competitive Market", styles["section"]))
    flow.append(Paragraph(
        "Competition = <b>Active only</b>. Pending + Backup are under contract — already spoken for, "
        "not inventory buyers can choose.",
        styles["small"],
    ))
    kpi_rows = [[
        Paragraph(f"<b>{active_n}</b><br/>Active", styles["kpi_val"]),
        Paragraph(f"<b>{with_yours}</b><br/>With yours", styles["kpi_val"]),
        Paragraph(f"<b>{uc_n}</b><br/>Under contract", styles["kpi_val"]),
        Paragraph(f"<b>{inv:.1f}</b><br/>Mo inventory", styles["kpi_val"]),
    ]]
    kt = Table(kpi_rows, colWidths=[1.75 * inch] * 4)
    kt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    flow.append(kt)
    flow.append(Spacer(1, 6))
    # Extended market KPIs (live story market row)
    kpi2 = [[
        Paragraph(f"<b>{sales_mo:.1f}</b><br/>Sales / mo", styles["kpi_val"]),
        Paragraph(f"<b>{odds_pct:.0f}%</b><br/>30-day odds", styles["kpi_val"]),
        Paragraph(f"<b>{s.get('sold_count', 0)}</b><br/>Recently closed", styles["kpi_val"]),
        Paragraph(f"<b>${(s.get('median_sold_price') or 0)/1000:.0f}k</b><br/>Median sold", styles["kpi_val"]),
        Paragraph(f"<b>{median_dom:.0f}</b><br/>Median DOM", styles["kpi_val"]),
        Paragraph(f"<b>${(s.get('median_price_per_sqft') or 0):.0f}</b><br/>Median $/sf", styles["kpi_val"]),
    ]]
    kt2 = Table(kpi2, colWidths=[1.15 * inch] * 6)
    kt2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), white),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
    ]))
    flow.append(kt2)
    flow.append(Spacer(1, 8))

    flow.append(Paragraph("What Sellers Ask", styles["section"]))
    q1 = ask.get("how_long") or f"Typical time to contract is about <b>{median_dom:.0f} days</b> for well-priced homes."
    q2 = ask.get("odds") or (
        f"A well-priced new listing has about a <b>{odds_pct:.0f}%</b> chance of going under contract in ~30 days."
    )
    q3 = ask.get("when_active") or f"Homes are absorbing at about <b>{sales_mo:.1f}</b> sales per month in this segment."
    q4 = ask.get("new_supply") or ""
    ask_data = [
        [Paragraph("<b>How Long Should It Take?</b>", styles["body_bold"]),
         Paragraph(q1, styles["body"])],
        [Paragraph("<b>What Are the Odds?</b>", styles["body_bold"]),
         Paragraph(q2, styles["body"])],
        [Paragraph("<b>When Is the Market Most Active?</b>", styles["body_bold"]),
         Paragraph(q3, styles["body"])],
    ]
    if q4:
        ask_data.append([
            Paragraph("<b>How Many New Homes Each Month?</b>", styles["body_bold"]),
            Paragraph(q4, styles["body"]),
        ])
    at = Table(ask_data, colWidths=[2.1 * inch, 4.8 * inch])
    at.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), white),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [LIGHT, white, LIGHT]),
    ]))
    flow.append(at)

    lf = report.get("listing_flow") or {}
    if lf.get("new_listings_per_month"):
        flow.append(Paragraph("The Supply Stream", styles["section"]))
        flow.append(Paragraph(
            "Active competition is a snapshot. The supply stream is the pipeline — new homes that keep "
            "arriving while yours sits. Price too high, and fresher listings underneath yours become "
            "the ones buyers tour first.",
            styles["small"],
        ))
        wait_fresh = float(lf.get("fresh_during_median_dom") or 0)
        wait_dom = float(lf.get("median_dom_for_wait") or median_dom or 0)
        supply_kpis = [[
            Paragraph(
                f"<b>{float(lf.get('new_listings_per_month') or 0):.1f}</b><br/>New / mo",
                styles["kpi_val"],
            ),
            Paragraph(
                f"<b>{float(lf.get('sales_per_month') or sales_mo):.1f}</b><br/>Sales / mo",
                styles["kpi_val"],
            ),
            Paragraph(
                f"<b>{float(lf.get('supply_pressure') or 0):.2f}×</b><br/>Supply pressure",
                styles["kpi_val"],
            ),
            Paragraph(
                f"<b>~{wait_fresh:.1f}</b><br/>New below in ~{wait_dom:.0f}d",
                styles["kpi_val"],
            ),
        ]]
        sk = Table(supply_kpis, colWidths=[1.75 * inch] * 4)
        sk.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
            ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
            ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        flow.append(sk)
        if lf.get("overprice_insight") or lf.get("insight"):
            flow.append(Spacer(1, 4))
            flow.append(Paragraph(
                lf.get("overprice_insight") or lf.get("insight") or "",
                styles["body"],
            ))
    band_labels = bands.get("labels") or []
    band_values = bands.get("values") or []
    if band_labels and band_values:
        flow.append(Paragraph("Active Competition by List-Price Band", styles["section"]))
        flow.append(Paragraph(
            "Where today’s Active listings sit by asking price — your recommended list is highlighted.",
            styles["small"],
        ))
        yours_idx = bands.get("subject_band_index")
        header = ["Price band", "Active homes"]
        rows = [header]
        for i, (lab, val) in enumerate(zip(band_labels, band_values)):
            mark = " ← your list" if yours_idx is not None and i == yours_idx else ""
            rows.append([f"{lab}{mark}", str(int(val))])
        bt = Table(rows, colWidths=[4.5 * inch, 2.0 * inch])
        style_cmds = [
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("ALIGN", (1, 0), (1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, LIGHT]),
        ]
        if yours_idx is not None and 0 <= yours_idx < len(band_labels):
            style_cmds.append(("BACKGROUND", (0, yours_idx + 1), (-1, yours_idx + 1), RECOMMEND_BG))
            style_cmds.append(("FONTNAME", (0, yours_idx + 1), (-1, yours_idx + 1), "Helvetica-Bold"))
        bt.setStyle(TableStyle(style_cmds))
        flow.append(bt)
        insight = bands.get("insight") or ""
        if insight:
            flow.append(Paragraph(insight, styles["body"]))

    if dns.get("note") or dns.get("true_did_not_sell"):
        flow.append(Paragraph("Did-Not-Sell Context", styles["section"]))
        flow.append(Paragraph(
            dns.get("note")
            or (
                f"About <b>{dns.get('true_did_not_sell', 0)}</b> expired/withdrawn listings in this pull "
                f"(after relist checks) — inventory that tried and didn’t clear."
            ),
            styles["body"],
        ))

    flow.append(PageBreak())

    # —— Page 2: condition, position, recommended, trade-offs ——
    flow.append(Paragraph("Your Home — Condition &amp; Position", styles["section"]))
    flow.append(Paragraph(
        f"Starting rating <b>{rating}/10</b> ({_esc_pdf(rating_label)}). "
        "Typical for this set is <b>5/10</b> (0% vs typical). Adjust together in the live story — list dollars unlock in Price it.",
        styles["body"],
    ))
    pos_bits = [
        story.get("top_percent_statement")
        or f"At the recommended list, you would be priced in the top {top_mkt:.0f}% of recent similar sales."
    ]
    if trend_val:
        pos_bits.append(f"Size-trend anchor for this home: about <b>${float(trend_val):,.0f}</b>.")
    if pos.get("competitive_statement"):
        pos_bits.append(pos.get("competitive_statement"))
    flow.append(Paragraph(" ".join(pos_bits), styles["body"]))
    if pos.get("narrative"):
        narr = str(pos.get("narrative") or "")
        # Keep printable — trim very long markdown-ish narratives
        if len(narr) > 900:
            narr = narr[:900].rsplit(" ", 1)[0] + "…"
        flow.append(Paragraph(narr.replace("\n", "<br/>"), styles["small"]))

    if objections:
        flow.append(Paragraph("What Often Comes Up", styles["section"]))
        obj_rows = []
        for card in objections[:4]:
            obj_rows.append([
                Paragraph(f"<b>{_esc_pdf(card.get('title'))}</b>", styles["body_bold"]),
                Paragraph(_esc_pdf(card.get("body")), styles["body"]),
            ])
        ot = Table(obj_rows, colWidths=[1.8 * inch, 5.1 * inch])
        ot.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, BORDER),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [LIGHT, white]),
        ]))
        flow.append(ot)

    flow.append(Paragraph("Recommended List Price", styles["section"]))
    flow.append(Paragraph(
        f"Home rating <b>{rating}/10</b> · "
        f"{story.get('top_percent_statement') or 'Comparable sales set the band.'}",
        styles["body"],
    ))
    price_data = [[
        Paragraph("RECOMMENDED", styles["price_lbl"]),
        Paragraph("COMPETITIVE RANGE", styles["price_lbl"]),
        Paragraph("EXPECTED DOM", styles["price_lbl"]),
    ], [
        Paragraph(f"${rec:,.0f}", styles["price_big"]),
        Paragraph(
            f"${low:,.0f} – ${high:,.0f}",
            ParagraphStyle("pr", parent=styles["price_big"], fontSize=11),
        ),
        Paragraph(
            f"~{dom:.0f} days",
            ParagraphStyle("pd", parent=styles["price_big"], fontSize=11),
        ),
    ]]
    pt = Table(price_data, colWidths=[2.4 * inch, 2.5 * inch, 2.0 * inch])
    pt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    flow.append(pt)
    flow.append(Spacer(1, 10))

    # —— While You Wait: queue cost of overpricing ——
    lf_below_pm = float(lf.get("new_below_recommended_per_month") or 0)
    lf_active_below = int(lf.get("active_below_recommended_now") or 0)
    lf_wait_fresh = float(lf.get("fresh_during_median_dom") or 0)
    lf_wait_dom = float(lf.get("median_dom_for_wait") or median_dom or 0)
    if lf.get("new_listings_per_month") and rec:
        wyw_total = lf_active_below + lf_wait_fresh
        stretch_sc = next(
            (sc for sc in (pos.get("price_scenarios") or [])
             if "Premium" in (sc.get("label") or "") or "High" in (sc.get("label") or "")),
            (pos.get("price_scenarios") or [None])[-1],
        )
        stretch_price = float((stretch_sc or {}).get("list_price") or rec * 1.06)
        stretch_dom = float((stretch_sc or {}).get("expected_dom") or dom * 1.6 or 0)
        stretch_fresh = lf_below_pm * (stretch_dom / 30.44) if lf_below_pm and stretch_dom else 0
        stretch_total = lf_active_below + stretch_fresh
        wyw_cells = [[
            Paragraph(
                f"<b>{lf_active_below}</b><br/>Already cheaper today",
                styles["wyw_val"],
            ),
            Paragraph(
                f"<b>~{lf_below_pm:.1f}/mo</b><br/>New ones list under you",
                styles["wyw_val"],
            ),
            Paragraph(
                f"<b>~{wyw_total:.0f}</b><br/>Pass you in ~{lf_wait_dom:.0f} days",
                styles["wyw_val_inv"],
            ),
        ]]
        wt = Table(wyw_cells, colWidths=[2.3 * inch] * 3)
        wt.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (1, 0), AMBER_BG),
            ("BACKGROUND", (2, 0), (2, 0), AMBER),
            ("BOX", (0, 0), (-1, -1), 0.8, AMBER_LINE),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, AMBER_LINE),
            ("TOPPADDING", (0, 0), (-1, -1), 9),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        cmp_rows = [
            ["", "List price", "Est. wait", "Homes that pass you*"],
            [
                "Recommended",
                f"${rec:,.0f}",
                f"~{dom:.0f} days",
                f"~{wyw_total:.0f}",
            ],
            [
                "Stretch (+{:.0f}%)".format((stretch_price - rec) / rec * 100 if rec else 6),
                f"${stretch_price:,.0f}",
                f"~{stretch_dom:.0f} days",
                f"~{stretch_total:.0f}",
            ],
        ]
        ct = Table(cmp_rows, colWidths=[1.7 * inch, 1.6 * inch, 1.4 * inch, 2.2 * inch])
        ct.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), AMBER_DARK),
            ("TEXTCOLOR", (0, 0), (-1, 0), white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("BACKGROUND", (0, 1), (-1, 1), RECOMMEND_BG),
            ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.4, AMBER_LINE),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        flow.append(KeepTogether([
            Paragraph("While You Wait — The Cost of Overpricing", styles["wyw_title"]),
            Paragraph(
                "Buyers tour the best value first. While an overpriced home sits, the homes already "
                "cheaper than yours keep selling — and <b>new</b> homes keep listing under your price. "
                "Both cut in line ahead of you.",
                styles["wyw_body"],
            ),
            Spacer(1, 2),
            wt,
            Spacer(1, 6),
            ct,
            Paragraph(
                "* Homes already cheaper today plus similar new listings expected to list under your price "
                "during the wait. Every week overpriced, your listing becomes the comp that sells the newer, "
                "cheaper one. At the recommended list, the queue works for you instead.",
                styles["small"],
            ),
        ]))
        flow.append(Spacer(1, 6))

    bl = report.get("executive_summary") or ""
    if bl:
        flow.append(Paragraph("Bottom Line", styles["section"]))
        flow.append(Paragraph(bl.replace("\n", "<br/>"), styles["body"]))

    scenarios = pos.get("price_scenarios") or []
    if scenarios:
        flow.append(Paragraph("Price Trade-Offs", styles["section"]))
        flow.append(Paragraph(
            "Buyers choose better value first. Price above the market and fresher, cheaper listings tend to get the tours — raising days on market and lowering odds.",
            styles["small"],
        ))
        rows = [["Strategy", "List", "Est. DOM", "30-day odds", "Fresh below*"]]
        for sc in scenarios[:6]:
            rows.append([
                sc.get("label", ""),
                f"${sc.get('list_price', 0):,.0f}",
                f"~{sc.get('expected_dom', 0):.0f}d",
                f"{(sc.get('odds_30_day') or 0) * 100:.0f}%",
                f"~{sc.get('fresh_competitors_below', 0):.0f}" if sc.get("fresh_competitors_below") else "—",
            ])
        t = Table(rows, colWidths=[2.1 * inch, 1.15 * inch, 1.0 * inch, 1.15 * inch, 1.15 * inch])
        style_cmds = [
            ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ]
        for i, sc in enumerate(scenarios[:6], start=1):
            if "Balanced" in str(sc.get("label", "")) or "Recommend" in str(sc.get("label", "")):
                style_cmds.append(("BACKGROUND", (0, i), (-1, i), RECOMMEND_BG))
                style_cmds.append(("FONTNAME", (0, i), (-1, i), "Helvetica-Bold"))
        t.setStyle(TableStyle(style_cmds))
        flow.append(t)
        flow.append(Paragraph(
            "* Fresh below ≈ similar new listings priced under that list while you wait (supply stream).",
            styles["small"],
        ))

    advantages = pos.get("advantages") or []
    risks = pos.get("risks") or []
    if advantages or risks:
        flow.append(Paragraph("Advantages &amp; Watch-Outs", styles["section"]))
        adv_html = "<br/>".join(f"• {a}" for a in advantages[:5]) or "—"
        risk_html = "<br/>".join(f"• {r}" for r in risks[:5]) or "—"
        ar = Table(
            [[
                Paragraph(f"<b>Advantages</b><br/>{adv_html}", styles["body"]),
                Paragraph(f"<b>Watch-Outs</b><br/>{risk_html}", styles["body"]),
            ]],
            colWidths=[3.45 * inch, 3.45 * inch],
        )
        ar.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, 0), RECOMMEND_BG),
            ("BACKGROUND", (1, 0), (1, 0), HexColor("#fff7ed")),
            ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ]))
        flow.append(ar)

    flow.append(PageBreak())

    # —— Page 3: comps + YoY + close ——
    comps = pos.get("closest_comps") or []
    if comps:
        flow.append(Paragraph("Most Similar Recent Sales", styles["section"]))
        header = ["Address", "Sold", "SqFt", "Bd/Ba", "Year", "DOM", "$/SF"]
        rows = [header]
        for c in comps[:8]:
            rows.append([
                (c.get("address") or "")[:28],
                f"${c.get('sold_price', 0):,.0f}",
                f"{c.get('living_area', 0):.0f}",
                f"{c.get('beds', 0):.0f}/{c.get('baths', 0):.0f}",
                str(c.get("year_built") or ""),
                f"{c.get('dom', 0):.0f}",
                f"${c.get('price_per_sqft', 0):.0f}",
            ])
        ct = Table(
            rows,
            colWidths=[1.95 * inch, 0.95 * inch, 0.65 * inch, 0.6 * inch, 0.55 * inch, 0.5 * inch, 0.6 * inch],
        )
        ct.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("ALIGN", (0, 0), (0, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, LIGHT]),
        ]))
        flow.append(ct)

    yoy_summary = yoy.get("summary") or []
    if yoy_summary:
        flow.append(Paragraph("Year Over Year", styles["section"]))
        yrows = [["Year", "Sales", "Median sold", "Median DOM"]]
        for y in yoy_summary:
            yrows.append([
                str(y.get("year")),
                str(y.get("sales", 0)),
                f"${(y.get('median_price') or 0):,.0f}",
                f"{(y.get('median_dom') or 0):.0f}d",
            ])
        yt = Table(yrows, colWidths=[1.4 * inch, 1.2 * inch, 2.0 * inch, 1.6 * inch])
        yt.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        flow.append(yt)

    sens = pos.get("price_sensitivity_narrative") or ""
    if sens:
        flow.append(Paragraph("Pricing Strategy", styles["section"]))
        flow.append(Paragraph(sens.replace("\n", "<br/>"), styles["body"]))

    flow.append(Spacer(1, 14))
    flow.append(HRFlowable(width="100%", thickness=1, color=NAVY, spaceAfter=8))
    flow.append(Paragraph(
        "<b>Recommended Path Forward</b><br/>"
        "Launch inside the competitive range, present the home at its best, and let the market respond. "
        "Homes that start at a realistic price create urgency and typically net more than homes that sit and later reduce.",
        styles["body"],
    ))
    flow.append(Spacer(1, 10))
    flow.append(Paragraph(
        "ListLogic · The pricing story, told by the data<br/>"
        "Active = competition · Months of inventory uses Active only · For discussion with your agent",
        styles["footer"],
    ))
    if report.get("llm_enhanced"):
        flow.append(Paragraph("Narratives AI-assisted · numbers from your MLS export", styles["footer"]))

    doc.build(flow)
    return Path(output_path)


if __name__ == "__main__":
    demo = SubjectProperty(
        mls_number="1058539",
        address="1843 24th Ave Ct, Greeley",
        list_price=389900,
        living_area=2163,
        beds=4,
        baths=2,
        year_built=1966,
        condition="average",
    )
    _root = Path(__file__).resolve().parent
    export_presentation_pdf(
        str(_root / "data" / "export-71.txt"),
        subject=demo,
        output_dir=str(_root / "output"),
        area_name="Greeley, CO (West / Central)",
        city_filter="Greeley",
    )
