"""
ListLogic – Report Generator
Creates a clean, professional HTML + JSON report.
"""

from __future__ import annotations
import json
from pathlib import Path
from datetime import datetime
from core import create_full_report, SubjectProperty


def render_html(report: dict) -> str:
    s = report["stats"]
    market_narr = report["market_narrative"].replace("\n", "<br>").replace("**", "<strong>").replace("*", "<em>")

    pos = report.get("positioning")
    subject = report.get("subject")

    points = report["scatter_points"][:150]
    scatter_js = json.dumps([
        {"x": p["LivingArea"], "y": p["SoldPrice"], "label": p.get("Address", "")[:40]}
        for p in points
    ])

    trend = report["scatter_trend"]
    if points:
        min_x = min(p["LivingArea"] for p in points)
        max_x = max(p["LivingArea"] for p in points)
        trend_points = json.dumps([
            {"x": min_x, "y": trend["slope"] * min_x + trend["intercept"]},
            {"x": max_x, "y": trend["slope"] * max_x + trend["intercept"]},
        ])
    else:
        trend_points = "[]"

    subject_point_js = "null"
    if subject and subject.get("living_area"):
        price_for_pin = subject.get("list_price") or (pos["recommended_price"] if pos else 0)
        subject_point_js = json.dumps({
            "x": subject["living_area"],
            "y": price_for_pin,
            "label": subject.get("address", "Subject")
        })

    # ----- Positioning + Sensitivity HTML -----
    positioning_html = ""
    if pos:
        comps_rows = ""
        for c in pos["closest_comps"][:6]:
            comps_rows += f"""
            <tr>
              <td>{c['address'][:30]}</td>
              <td>${c['sold_price']:,.0f}</td>
              <td>{c['living_area']:.0f}</td>
              <td>{c['beds']:.0f}/{c['baths']:.0f}</td>
              <td>{c['year_built']}</td>
              <td>{c['dom']:.0f}</td>
              <td>${c['price_per_sqft']:.0f}</td>
            </tr>"""

        adv = "".join(f"<li>{a}</li>" for a in pos["advantages"])
        risks = "".join(f"<li>{r}</li>" for r in pos["risks"])
        pos_narr = pos["narrative"].replace("\n", "<br>").replace("**", "<strong>")

        # Price sensitivity table
        sens_rows = ""
        for sc in pos.get("price_scenarios", []):
            odds_pct = sc["odds_30_day"] * 100
            highlight = " class='recommended'" if "Balanced" in sc["label"] else ""
            sens_rows += f"""
            <tr{highlight}>
              <td><strong>{sc['label']}</strong></td>
              <td>${sc['list_price']:,.0f}</td>
              <td>~{sc['expected_dom']:.0f} days</td>
              <td>{odds_pct:.0f}%</td>
              <td>{sc['competitive_position']}</td>
            </tr>"""

        sens_narr = pos.get("price_sensitivity_narrative", "").replace("\n", "<br>").replace("**", "<strong>")

        positioning_html = f"""
        <div class="card highlight">
          <h2>Your Home Positioning <span class="badge">AI + Data</span></h2>
          <div class="narrative">{pos_narr}</div>

          <div class="price-box">
            <div class="price-item">
              <div class="price-label">Recommended</div>
              <div class="price-value">${pos['recommended_price']:,.0f}</div>
            </div>
            <div class="price-item">
              <div class="price-label">Competitive Range</div>
              <div class="price-value small">${pos['price_low']:,.0f} – ${pos['price_high']:,.0f}</div>
            </div>
            <div class="price-item">
              <div class="price-label">Expected Days to Contract</div>
              <div class="price-value small">~{pos['expected_dom']:.0f} days</div>
            </div>
          </div>

          <div class="two-col">
            <div>
              <h3>Advantages</h3>
              <ul>{adv}</ul>
            </div>
            <div>
              <h3>Watch-outs</h3>
              <ul>{risks}</ul>
            </div>
          </div>
        </div>

        <div class="card">
          <h2>Price Sensitivity Simulator <span class="badge">Standout Feature</span></h2>
          <div class="narrative" style="margin-bottom:14px">{sens_narr}</div>
          <table>
            <thead>
              <tr>
                <th>Strategy</th>
                <th>List Price</th>
                <th>Expected DOM</th>
                <th>30-Day Odds</th>
                <th>Market Position</th>
              </tr>
            </thead>
            <tbody>
              {sens_rows}
            </tbody>
          </table>
          <p class="muted" style="margin-top:10px">Highlighted row = recommended balanced strategy. Odds and DOM are estimates based on current absorption and inventory.</p>
        </div>

        <div class="card">
          <h2>Most Similar Recent Sales</h2>
          <p class="muted">Ranked by similarity to your home (size, beds, year, baths).</p>
          <table>
            <thead>
              <tr>
                <th>Address</th>
                <th>Sold</th>
                <th>SqFt</th>
                <th>Bd/Ba</th>
                <th>Year</th>
                <th>DOM</th>
                <th>$/SF</th>
              </tr>
            </thead>
            <tbody>
              {comps_rows}
            </tbody>
          </table>
        </div>
        """

    subject_header = ""
    if subject:
        subject_header = f"""
        <div class="subject-bar">
          Subject: <strong>{subject.get('address') or 'Your Property'}</strong>
          &nbsp;·&nbsp; {subject.get('living_area', 0):,.0f} sqft
          &nbsp;·&nbsp; {subject.get('beds', 0):.0f} bd / {subject.get('baths', 0):.0f} ba
          &nbsp;·&nbsp; Built {subject.get('year_built', '—')}
          {f"&nbsp;·&nbsp; Listed ${subject.get('list_price'):,.0f}" if subject.get('list_price') else ""}
        </div>
        """

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ListLogic – {report['area']}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
  :root {{
    --primary: #0f4c81;
    --accent: #1a6bb5;
    --bg: #f4f7fb;
    --card: #ffffff;
    --text: #1a1a1a;
    --muted: #5a6a7a;
    --success: #0d7a4f;
    --border: #e2e8f0;
    --highlight: #f0f7ff;
    --recommend: #e8f5e9;
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.55;
    padding: 20px;
  }}
  .container {{ max-width: 980px; margin: 0 auto; }}
  header {{
    background: linear-gradient(135deg, var(--primary), var(--accent));
    color: white;
    padding: 26px 30px;
    border-radius: 12px;
    margin-bottom: 18px;
    box-shadow: 0 4px 20px rgba(15,76,129,0.22);
  }}
  header h1 {{ font-size: 1.7rem; font-weight: 700; margin-bottom: 2px; }}
  header .sub {{ opacity: 0.9; font-size: 0.92rem; }}
  .subject-bar {{
    background: #e8f1fa;
    border: 1px solid #c5d8ec;
    border-radius: 8px;
    padding: 10px 16px;
    margin-bottom: 22px;
    font-size: 0.92rem;
  }}
  .grid {{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    margin-bottom: 24px;
  }}
  .stat-card {{
    background: var(--card);
    border-radius: 10px;
    padding: 16px 12px;
    border: 1px solid var(--border);
    text-align: center;
  }}
  .stat-card .value {{
    font-size: 1.45rem;
    font-weight: 700;
    color: var(--primary);
  }}
  .stat-card .label {{
    font-size: 0.72rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-top: 3px;
  }}
  .card {{
    background: var(--card);
    border-radius: 12px;
    padding: 22px 26px;
    border: 1px solid var(--border);
    margin-bottom: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  }}
  .card.highlight {{ background: var(--highlight); border-color: #c5d8ec; }}
  .card h2 {{
    font-size: 1.12rem;
    color: var(--primary);
    margin-bottom: 12px;
    padding-bottom: 7px;
    border-bottom: 2px solid #e0ebf5;
  }}
  .card h3 {{ font-size: 0.95rem; color: var(--primary); margin-bottom: 6px; }}
  .narrative {{ font-size: 0.96rem; }}
  .narrative strong {{ color: var(--primary); }}
  .muted {{ color: var(--muted); font-size: 0.88rem; margin-bottom: 10px; }}
  .badge {{
    display: inline-block;
    background: #e6f4ee;
    color: var(--success);
    font-size: 0.72rem;
    font-weight: 600;
    padding: 2px 9px;
    border-radius: 20px;
    margin-left: 6px;
    vertical-align: middle;
  }}
  .price-box {{
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin: 18px 0;
    padding: 14px;
    background: white;
    border-radius: 10px;
    border: 1px solid var(--border);
  }}
  .price-item {{ flex: 1; min-width: 140px; text-align: center; }}
  .price-label {{ font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; }}
  .price-value {{ font-size: 1.5rem; font-weight: 700; color: var(--primary); }}
  .price-value.small {{ font-size: 1.15rem; }}
  .two-col {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 12px; }}
  .two-col ul {{ padding-left: 18px; font-size: 0.9rem; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 0.88rem; }}
  th, td {{ padding: 9px 10px; text-align: left; border-bottom: 1px solid var(--border); }}
  th {{ font-size: 0.75rem; text-transform: uppercase; color: var(--muted); letter-spacing: 0.03em; }}
  tr.recommended {{ background: var(--recommend); font-weight: 500; }}
  canvas {{ max-height: 360px; }}
  footer {{
    text-align: center;
    color: var(--muted);
    font-size: 0.8rem;
    margin-top: 28px;
    padding-top: 14px;
    border-top: 1px solid var(--border);
  }}
  @media (max-width: 640px) {{
    .two-col {{ grid-template-columns: 1fr; }}
  }}
</style>
</head>
<body>
<div class="container">

<header>
  <h1>ListLogic</h1>
  <div class="sub">{report['area']} &nbsp;·&nbsp; {datetime.now().strftime('%B %d, %Y')}</div>
</header>

{subject_header}

<div class="grid">
  <div class="stat-card">
    <div class="value">{s['sold_count']}</div>
    <div class="label">Closed Sales</div>
  </div>
  <div class="stat-card">
    <div class="value">{s['absorption_rate']}</div>
    <div class="label">Sales / Month</div>
  </div>
  <div class="stat-card">
    <div class="value">{s['months_of_inventory']}</div>
    <div class="label">Months Inventory</div>
  </div>
  <div class="stat-card">
    <div class="value">{s['odds_of_selling']*100:.0f}%</div>
    <div class="label">Odds of Selling</div>
  </div>
  <div class="stat-card">
    <div class="value">${s['median_sold_price']/1000:.0f}k</div>
    <div class="label">Median Sold</div>
  </div>
  <div class="stat-card">
    <div class="value">{s['median_dom']:.0f}</div>
    <div class="label">Median DOM</div>
  </div>
</div>

<div class="card">
  <h2>Market Narrative <span class="badge">AI Generated</span></h2>
  <div class="narrative">{market_narr}</div>
</div>

{positioning_html}

<div class="card">
  <h2>Pricing Scattergram – Sold Homes</h2>
  <p class="muted">Each blue point is a closed sale. The orange line is the market trend. Red pin = your home.</p>
  <canvas id="scatterChart"></canvas>
</div>

<footer>
  ListLogic · Clarity that wins listings · Data from MLS export · Engine v0.3 · {report['generated_at'][:10]}
</footer>

</div>

<script>
const ctx = document.getElementById('scatterChart').getContext('2d');
const subjectPoint = {subject_point_js};

const datasets = [
  {{
    label: 'Sold Homes',
    data: {scatter_js},
    backgroundColor: 'rgba(15, 76, 129, 0.5)',
    borderColor: 'rgba(15, 76, 129, 0.85)',
    pointRadius: 4.5,
    pointHoverRadius: 7,
  }},
  {{
    label: 'Market Trend',
    data: {trend_points},
    type: 'line',
    borderColor: '#e05c3a',
    borderWidth: 2.5,
    pointRadius: 0,
    fill: false,
    tension: 0,
  }}
];

if (subjectPoint) {{
  datasets.push({{
    label: 'Your Home',
    data: [subjectPoint],
    backgroundColor: '#c0392b',
    borderColor: '#c0392b',
    pointRadius: 9,
    pointHoverRadius: 11,
    pointStyle: 'rectRot',
  }});
}}

new Chart(ctx, {{
  type: 'scatter',
  data: {{ datasets }},
  options: {{
    responsive: true,
    plugins: {{
      legend: {{ position: 'top' }},
      tooltip: {{
        callbacks: {{
          label: function(ctx) {{
            const p = ctx.raw;
            if (ctx.dataset.label === 'Sold Homes' || ctx.dataset.label === 'Your Home') {{
              return (p.label || '') + '  ·  $' + Math.round(p.y).toLocaleString() + '  ·  ' + Math.round(p.x) + ' sqft';
            }}
            return 'Trend line';
          }}
        }}
      }}
    }},
    scales: {{
      x: {{
        title: {{ display: true, text: 'Living Area (sqft)' }},
        grid: {{ color: '#f0f4f8' }}
      }},
      y: {{
        title: {{ display: true, text: 'Price ($)' }},
        ticks: {{ callback: v => '$' + (v/1000) + 'k' }},
        grid: {{ color: '#f0f4f8' }}
      }}
    }}
  }}
}});
</script>
</body>
</html>
"""
    return html


def save_report(
    export_path: str,
    output_dir: str = "output",
    area_name: str = "Greeley, CO",
    city_filter: str = "Greeley",
    subject: SubjectProperty | None = None,
    subject_mls: str | None = None,
):
    report = create_full_report(
        export_path,
        area_name=area_name,
        city_filter=city_filter,
        subject=subject,
        subject_mls=subject_mls,
    )
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    json_path = out / "report.json"
    with open(json_path, "w") as f:
        json.dump(report, f, indent=2, default=str)

    html = render_html(report)
    html_path = out / "report.html"
    html_path.write_text(html, encoding="utf-8")

    print(f"[ok] JSON  -> {json_path}")
    print(f"[ok] HTML  -> {html_path}")
    if report.get("positioning"):
        p = report["positioning"]
        print(f"[ok] Recommended: ${p['recommended_price']:,.0f}")
        print(f"[ok] Range: ${p['price_low']:,.0f} - ${p['price_high']:,.0f}")
        if p.get("price_scenarios"):
            print("[ok] Price sensitivity scenarios generated")
    return report, html_path


if __name__ == "__main__":
    demo = SubjectProperty(
        mls_number="1058539",
        address="1843 24th Ave Ct, Greeley",
        list_price=389900,
        living_area=2163,
        beds=4,
        baths=2,
        year_built=1966,
        style="1 Story/Ranch",
        subdivision="Rolling Hills",
        garage_spaces=2,
        condition="average",
        dom=75,
    )

    _root = Path(__file__).resolve().parent
    save_report(
        str(_root / "data" / "export-71.txt"),
        output_dir=str(_root / "output"),
        area_name="Greeley, CO (West / Central)",
        city_filter="Greeley",
        subject=demo,
    )
