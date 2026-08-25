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
    HRFlowable, KeepTogether, ListFlowable, ListItem, PageBreak, Image,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.lib.utils import ImageReader
from core import create_full_report, SubjectProperty

import io
import re
import urllib.request


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
GOLD = HexColor("#c9a227")
DARK = HexColor("#0b1220")


def _esc_pdf(text: object) -> str:
    return (
        str(text or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")

    )


def _md(text: object) -> str:
    """Light markdown (LLM narratives) -> ReportLab paragraph markup.

    Handles **bold**, *italic*, ## headers, and - bullets; escapes HTML first.
    """
    t = _esc_pdf(str(text or ""))
    t = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"<i>\1</i>", t)
    t = re.sub(r"^#{1,4}\s*(.+?)\s*#*$", r"<b>\1</b>", t, flags=re.M)
    t = re.sub(r"^\s*[-*]\s+", "• ", t, flags=re.M)
    return t.replace("\n", "<br/>")



def _photo_bytes(url: str, timeout: int = 20, base_dir: Path | None = None) -> bytes | None:
    if not url:
        return None
    try:
        if str(url).startswith("http"):
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "ListLogic/1.0",
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                    "Referer": "https://www.zillow.com/",
                },
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = resp.read()
                ctype = (resp.headers.get("Content-Type") or "").lower()
            if len(data) < 800:
                return None
            if "image" not in ctype and not str(url).lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                if not (data[:3] == b"\xff\xd8\xff" or data[:8].startswith(b"\x89PNG") or data[:4] == b"RIFF"):
                    return None
            return data
        # Local relative path (e.g. photos/1058635.jpg or /runs/{id}/photos/1058635.jpg)
        local = Path(url)
        if not local.is_absolute():
            candidates = []
            if base_dir:
                candidates.append(Path(base_dir) / local)
                # Handle /runs/{run_id}/photos/... style URLs
                parts = [p for p in local.parts if p not in ("\\", "/")]
                if len(parts) >= 3 and parts[0] == "runs":
                    candidates.append(Path(base_dir) / Path(*parts[2:]))
                elif len(parts) >= 2 and parts[0] == "photos":
                    candidates.append(Path(base_dir) / Path(*parts))
            candidates.append(Path(__file__).resolve().parent / local)
            candidates.append(Path.cwd() / local)
            for cand in candidates:
                if cand.exists():
                    local = cand
                    break
            else:
                return None
        if not local.exists():
            return None
        data = local.read_bytes()
        if len(data) < 800:
            return None
        return data
    except Exception:
        return None


def _img_flowable(url: str, width: float, height: float, base_dir: Path | None = None) -> Image | None:
    data = _photo_bytes(url, base_dir=base_dir)
    if not data:
        return None
    try:
        img = Image(io.BytesIO(data), width=width, height=height)
        img.hAlign = "CENTER"
        return img
    except Exception:
        return None


def _bar_table(labels, values, highlight_idx=None, color=NAVY, highlight_color=GREEN, value_fmt=None, max_rows=8):
    """Render a simple horizontal bar chart as a ReportLab table."""
    rows = []
    max_v = max(values) if values else 1
    for i, (lab, val) in enumerate(zip(labels[:max_rows], values[:max_rows])):
        pct = 0 if not max_v else min(1.0, float(val) / float(max_v))
        bar_w = max(0.05, pct * 3.1) * inch
        txt = value_fmt(val) if value_fmt else str(val)
        bar = Table(
            [[""]],
            colWidths=[bar_w],
            rowHeights=[0.16 * inch],
            style=TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), highlight_color if highlight_idx is not None and i == highlight_idx else color),
                ("BOX", (0, 0), (-1, -1), 0, color),
            ]),
        )
        rows.append([Paragraph(f"<b>{_esc_pdf(lab)}</b>", ParagraphStyle("bl", fontName="Helvetica", fontSize=8, textColor=MUTED)), bar, Paragraph(f"<b>{txt}</b>", ParagraphStyle("bv", fontName="Helvetica-Bold", fontSize=8.5, textColor=NAVY, alignment=TA_RIGHT))])
    t = Table(rows, colWidths=[1.7 * inch, 3.3 * inch, 1.0 * inch])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


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


def _net_sheet_flow(price: float, styles):
    """Static Net Sheet mirroring the live spine-net section (defaults)."""
    from datetime import date, timedelta

    price = float(price or 0)
    if not price:
        return []

    def money(v):
        return f"${float(v):,.0f}"

    # Defaults matching the live Net Sheet inputs
    seller_fee = price * 0.03
    buyer_fee = price * 0.03
    concession = 0.0
    repairs = 2000.0
    tax_rate = 0.76
    payoff = 0.0
    title = max(0, round(price * 0.0015 / 50) * 50)
    oec = 150.0
    bundled = 190.0
    water = 200.0

    # Tax proration to a default closing date (~30 days out)
    close = date.today() + timedelta(days=30)
    jan1 = date(close.year, 1, 1)
    days = max(1, min(365, (close - jan1).days + 1))
    annual_tax = price * tax_rate / 100
    tax = round(annual_tax * days / 365)

    selling = seller_fee + buyer_fee + concession + repairs
    closing = tax + title + oec + bundled + water
    deductions = selling + closing + payoff
    net = price - deductions
    pct = max(0.0, min(100.0, round(net / price * 1000) / 10))

    def row(label, note, val, bold=False, total=False):
        lbl = f"<b>{label}</b>" if bold else label
        if note:
            lbl += f'<br/><font size="7.5" color="#5a6b80">{note}</font>'
        v = money(val) if val else "—"
        if total:
            v = f"<b>{money(val)}</b>"
        return [Paragraph(lbl, styles["body"]), Paragraph(v, styles["body"])]

    def subhead(t):
        return [Paragraph(f"<b>{t}</b>", styles["small"]), ""]

    rows = [
        subhead("Selling costs"),
        row("Seller broker fee", "3.0% of price", seller_fee),
        row("Buyer broker fee", "3.0% of price", buyer_fee),
        row("Seller concession", "credits offered to buyer", concession),
        row("Misc. — inspection repairs", "standard allowance", repairs),
        row("Total selling costs", "", selling, bold=True, total=True),
        subhead("Closing expenses · seller-paid"),
        row("Prop. taxes", f"{tax_rate}% annual · prorated to day {days} of {close.year}", tax),
        row("Owner's title policy", "auto · ≈0.15% of price", title),
        row("Owner's extended coverage", "", oec),
        row("Bundled closing fees", "", bundled),
        row("Final water", "final utility reading", water),
        row("Total closing expenses", "", closing, bold=True, total=True),
        subhead("Mortgage payoff"),
        row("Seller loan balance", "current mortgage payoff — not a selling cost", payoff),
        row("Total deductions", "selling + closing + payoff", deductions, bold=True, total=True),
    ]

    tbl = Table(rows, colWidths=[4.7 * inch, 2.2 * inch])
    tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("LINEBELOW", (0, -1), (-1, -1), 0.75, NAVY),
        ("LINEABOVE", (0, -1), (-1, -1), 0.75, NAVY),
        ("ROWBACKGROUNDS", (0, 0), (-1, -2), [white, LIGHT]),
    ]))

    summary = (
        f"<b>Estimated net to seller: {money(net)}</b> at {money(price)} "
        f"({pct:.1f}% of list)."
    )

    return [
        Paragraph("Net Sheet — What You Walk Away With", styles["section"]),
        Paragraph(
            "Estimated proceeds at the recommended price. Estimates only — not a closing statement. "
            "Your closer issues the official figures; loan balance, concessions, and fees change this the most.",
            styles["body"],
        ),
        Spacer(1, 4),
        tbl,
        Spacer(1, 10),
        Paragraph(summary, styles["body"]),
    ]


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
    base_dir = Path(output_path).resolve().parent

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=letter,
        leftMargin=0.6 * inch,
        rightMargin=0.6 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.55 * inch,
    )
    flow = []
    logo_path = Path(__file__).resolve().parent / "saas" / "listlogic-logo.png"
    if logo_path.exists():
        try:
            logo_img = Image(str(logo_path), width=1.9 * inch, height=1.9 * inch * 287 / 1218)
            logo_img.hAlign = "LEFT"
            flow.append(logo_img)
            flow.append(Spacer(1, 6))
        except Exception:
            pass
    addr = (subject.get("address") or "Your home") if subject else "Your home"
    flow.append(Paragraph("Seller Packet", styles["brand"]))
    flow.append(Paragraph(addr, styles["title"]))
    sub = f"{report.get('area', '')}  ·  {meta.get('generated') or datetime.now().strftime('%B %d, %Y')}"
    if agent_name:
        sub += f"  ·  {agent_name}"
    if brokerage:
        sub += f"  ·  {brokerage}"
    flow.append(Paragraph(sub, styles["subtitle"]))
    flow.append(HRFlowable(width="100%", thickness=1.5, color=NAVY, spaceAfter=8))

    # Cover photo band (subject first, then best comp)
    subject_photo = subject.get("photo_url") or subject.get("photo") or ""
    if not subject_photo and subject.get("photos"):
        subject_photo = (subject.get("photos") or [""])[0]
    cover_url = subject_photo
    if not cover_url:
        for c in (pos.get("closest_comps") or [])[:4]:
            cover_url = c.get("photo_url") or (c.get("photos") or [""])[0]
            if cover_url:
                break
    if cover_url:
        img = _img_flowable(cover_url, width=6.9 * inch, height=2.5 * inch, base_dir=base_dir)
        if img:
            flow.append(img)
            flow.append(Spacer(1, 6))

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
        [Paragraph("<b>1. Custom-Fit to This Home</b>", styles["body_bold"]),
         Paragraph("Not a city average. Size, garage, area, and timeframe — the homes a buyer would actually put next to yours.", styles["body"])],
        [Paragraph("<b>2. Absorption Sets the Pace</b>", styles["body_bold"]),
         Paragraph("How fast this segment sells versus how many are for sale. That ratio is months of inventory — who has leverage.", styles["body"])],
        [Paragraph("<b>3. Only Actives Compete</b>", styles["body_bold"]),
         Paragraph("Pending and backup are already spoken for. Buyers choose among what’s for sale now.", styles["body"])],
        [Paragraph("<b>4. Price, Condition, Location</b>", styles["body_bold"]),
         Paragraph("That’s what buyers compare. You can’t move the house. You can still change the ask, and how it shows.", styles["body"])],
        [Paragraph("<b>5. Who Looks Like the Better Buy</b>", styles["body_bold"]),
         Paragraph("If they list under you, they’re the cheaper option next to yours. If they list over you, you are.", styles["body"])],
        [Paragraph("<b>6. Price Buys Time</b>", styles["body_bold"]),
         Paragraph("Priced with the market, homes here move. Overpriced listings linger — and help sell everyone else’s house.", styles["body"])],
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
        flow.append(PageBreak())
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
        flow.append(_bar_table(
            band_labels,
            band_values,
            highlight_idx=yours_idx,
            color=NAVY,
            highlight_color=GREEN,
            value_fmt=lambda v: f"{int(v)} homes",
            max_rows=8,
        ))
        insight = bands.get("insight") or ""
        if insight:
            flow.append(Spacer(1, 4))
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
        flow.append(Paragraph(_md(narr), styles["small"]))

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
        flow.append(PageBreak())
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
        flow.append(Paragraph(_md(bl), styles["body"]))

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
        flow.append(Paragraph(
            "Does it look like yours — or nicer / dated — and does the sold price match that story?",
            styles["small"],
        ))
        # Photo cards (up to 4 with images)
        photo_cards = []
        for c in comps[:8]:
            url = c.get("photo_url") or (c.get("photos") or [""])[0]
            if not url:
                continue
            img = _img_flowable(url, width=1.55 * inch, height=1.0 * inch, base_dir=base_dir)
            if not img:
                continue
            card = Table(
                [
                    [img],
                    [Paragraph(f"<b>${c.get('sold_price', 0):,.0f}</b>", ParagraphStyle("cp", fontName="Helvetica-Bold", fontSize=9, textColor=NAVY, alignment=TA_CENTER))],
                    [Paragraph(_esc_pdf((c.get("address") or "")[:26]), ParagraphStyle("ca", fontName="Helvetica", fontSize=7, textColor=MUTED, alignment=TA_CENTER))],
                ],
                colWidths=[1.65 * inch],
                style=TableStyle([
                    ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                    ("TOPPADDING", (0, 0), (-1, -1), 2),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ("LEFTPADDING", (0, 0), (-1, -1), 2),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                ]),
            )
            photo_cards.append(card)
            if len(photo_cards) >= 4:
                break
        if photo_cards:
            pt = Table([photo_cards], colWidths=[1.75 * inch] * len(photo_cards))
            pt.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]))
            flow.append(pt)
            flow.append(Spacer(1, 6))
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
    yoy_sales = yoy.get("sales") or {}
    yoy_price = yoy.get("median_price") or {}
    if yoy_summary:
        yoy_flow = [
            Paragraph("Year Over Year", styles["section"]),
            Paragraph(
                "Sales count and median sold price by year in this segment.",
                styles["small"],
            ),
        ]
        yoy_blocks = []
        if yoy_sales.get("labels") and yoy_sales.get("values"):
            yoy_blocks.append([
                Paragraph("<b>Closed sales</b>", styles["body_bold"]),
                _bar_table(
                    yoy_sales.get("labels") or [],
                    yoy_sales.get("values") or [],
                    color=BLUE,
                    value_fmt=lambda v: f"{int(v)}",
                    max_rows=4,
                ),
            ])
        if yoy_price.get("labels") and yoy_price.get("values"):
            yoy_blocks.append([
                Paragraph("<b>Median sold price</b>", styles["body_bold"]),
                _bar_table(
                    yoy_price.get("labels") or [],
                    yoy_price.get("values") or [],
                    color=NAVY,
                    value_fmt=lambda v: f"${float(v)/1000:.0f}k",
                    max_rows=4,
                ),
            ])
        if yoy_blocks:
            yt = Table(yoy_blocks, colWidths=[1.5 * inch, 5.0 * inch])
            yt.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ]))
            yoy_flow.append(yt)
        yrows = [["Year", "Sales", "Median sold", "Median DOM"]]
        for y in yoy_summary:
            yrows.append([
                str(y.get("year")),
                str(y.get("sales", 0)),
                f"${(y.get('median_price') or 0):,.0f}",
                f"{(y.get('median_dom') or 0):.0f}d",
            ])
        yt2 = Table(yrows, colWidths=[1.4 * inch, 1.2 * inch, 2.0 * inch, 1.6 * inch])
        yt2.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        yoy_flow.append(Spacer(1, 6))
        yoy_flow.append(yt2)
        flow.append(KeepTogether(yoy_flow))

    dom_chart = report.get("chart_dom") or {}
    if dom_chart.get("labels") and dom_chart.get("values"):
        flow.append(KeepTogether([
            Paragraph("Days on Market — Recent Sales", styles["section"]),
            Paragraph(
                f"Median {float(dom_chart.get('median') or median_dom):.0f} days · mean {float(dom_chart.get('mean') or 0):.0f} days",
                styles["small"],
            ),
            _bar_table(
                dom_chart.get("labels") or [],
                dom_chart.get("values") or [],
                color=BLUE,
                value_fmt=lambda v: f"{int(v)}",
                max_rows=7,
            ),
        ]))

    sens = pos.get("price_sensitivity_narrative") or ""
    if sens:
        flow.append(KeepTogether([
            Paragraph("Pricing Strategy", styles["section"]),
            Paragraph(_md(sens), styles["body"]),
        ]))

    # —— Net Sheet page ——
    net_price = rec or float(subject.get("list_price") or 0)
    if net_price:
        flow.append(PageBreak())
        flow.extend(_net_sheet_flow(net_price, styles))

    close_flow = [
        Spacer(1, 14),
        HRFlowable(width="100%", thickness=1, color=NAVY, spaceAfter=8),
        Paragraph(
            "<b>Recommended Path Forward</b><br/>"
            "Launch inside the competitive range, present the home at its best, and let the market respond. "
            "Homes that start at a realistic price create urgency and typically net more than homes that sit and later reduce.",
            styles["body"],
        ),
        Spacer(1, 10),
        Paragraph(
            "ListLogic · The pricing story, told by the data<br/>"
            "Active = competition · Months of inventory uses Active only · For discussion with your agent",
            styles["footer"],
        ),
    ]
    if report.get("llm_enhanced"):
        close_flow.append(Paragraph("Narratives AI-assisted · numbers from your market data", styles["footer"]))
    flow.append(KeepTogether(close_flow))

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
