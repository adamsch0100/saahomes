#!/usr/bin/env python3
"""Weekly lead attribution brief: connect GSC to GA4 generate_lead events."""
import os, sys, json, base64
from datetime import datetime, timedelta
from collections import defaultdict

# ------------------------------------------------------------------
# Dates
# ------------------------------------------------------------------
END_DATE = datetime.now().date()
START_DATE = END_DATE - timedelta(days=7)
WEEK_LABEL = START_DATE.strftime("%Y-%m-%d")

# ------------------------------------------------------------------
# GSC setup
# ------------------------------------------------------------------
from google.oauth2 import service_account
from googleapiclient.discovery import build

GSC_CREDENTIALS_PATH = os.getenv("GA4_CREDENTIALS", "/opt/data/credentials/gsc-service-account.json")
SITE_URL = "sc-domain:saahomes.com"

if not os.path.exists(GSC_CREDENTIALS_PATH):
    print(f"GSC credentials not found at {GSC_CREDENTIALS_PATH}")
    sys.exit(1)

credentials = service_account.Credentials.from_service_account_file(
    GSC_CREDENTIALS_PATH,
    scopes=["https://www.googleapis.com/auth/webmasters.readonly"],
)
gsc = build("webmasters", "v3", credentials=credentials, cache_discovery=False)

# ------------------------------------------------------------------
# Pull top pages (up to 50 rows to get richer data)
# ------------------------------------------------------------------
page_rows = []
req_body = {
    "startDate": START_DATE.isoformat(),
    "endDate": END_DATE.isoformat(),
    "dimensions": ["page"],
    "rowLimit": 50,
    "aggregationType": "auto",
}
try:
    resp = gsc.searchanalytics().query(siteUrl=SITE_URL, body=req_body).execute()
    page_rows = resp.get("rows", [])
except Exception as e:
    print(f"GSC page error: {e}")

# Build landing-page map {path: {impressions, clicks, position}}
page_data = {}
for row in page_rows:
    url = row["keys"][0]
    path = url.replace("https://saahomes.com", "").replace("http://saahomes.com", "")
    page_data[path] = {
        "impressions": int(row.get("impressions", 0)),
        "clicks": int(row.get("clicks", 0)),
        "position": round(float(row.get("position", 0)), 1),
    }

# Also pull top queries so we know what people searched for
query_rows = []
req_body_q = {
    "startDate": START_DATE.isoformat(),
    "endDate": END_DATE.isoformat(),
    "dimensions": ["query", "page"],
    "rowLimit": 50,
    "aggregationType": "auto",
}
try:
    resp_q = gsc.searchanalytics().query(siteUrl=SITE_URL, body=req_body_q).execute()
    query_rows = resp_q.get("rows", [])
except Exception as e:
    print(f"GSC query error: {e}")

# Map top queries per page
page_queries = defaultdict(list)
for row in query_rows:
    q, url = row["keys"]
    path = url.replace("https://saahomes.com", "").replace("http://saahomes.com", "")
    page_queries[path].append({
        "query": q,
        "impressions": int(row.get("impressions", 0)),
        "clicks": int(row.get("clicks", 0)),
        "position": round(float(row.get("position", 0)), 1),
    })

# ------------------------------------------------------------------
# GA4 setup
# ------------------------------------------------------------------
from google.analytics.data import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import RunReportRequest, DateRange, Dimension, Metric, FilterExpression, FilterExpressionList, Filter

GA4_PROPERTY_ID = os.getenv("GA4_PROPERTY_ID", "356028551")

ga4_leads_by_page = defaultdict(int)
try:
    ga4_client = BetaAnalyticsDataClient.from_service_account_file(GSC_CREDENTIALS_PATH)
    # Query BOTH lead events: generate_lead (recommended) and saa_lead_submit
    # (custom event that registers in GA4 Admin faster than generate_lead).
    # A filter_group with OR semantics covers both names in one request.
    ga4_request = RunReportRequest(
        property=f"properties/{GA4_PROPERTY_ID}",
        date_ranges=[DateRange(start_date=START_DATE.isoformat(), end_date=END_DATE.isoformat())],
        dimensions=[Dimension(name="pageLocation")],
        metrics=[Metric(name="eventCount")],
        dimension_filter=FilterExpression(
            or_group=FilterExpressionList(
                expressions=[
                    FilterExpression(
                        filter=Filter(
                            field_name="eventName",
                            string_filter=Filter.StringFilter(value="generate_lead"),
                        )
                    ),
                    FilterExpression(
                        filter=Filter(
                            field_name="eventName",
                            string_filter=Filter.StringFilter(value="saa_lead_submit"),
                        )
                    ),
                ]
            )
        ),
    )
    ga4_resp = ga4_client.run_report(ga4_request)
    for row in ga4_resp.rows:
        url = row.dimension_values[0].value
        path = url.replace("https://saahomes.com", "").replace("http://saahomes.com", "")
        count = int(row.metric_values[0].value)
        ga4_leads_by_page[path] += count
except Exception as e:
    print(f"GA4 error (will skip): {e}")

# ------------------------------------------------------------------
# Scorecard: merge GSC + GA4
# ------------------------------------------------------------------
# Include pages with at least 1 impression or at least 1 lead
all_paths = set(page_data.keys()) | set(ga4_leads_by_page.keys())

# Keep only site pages (exclude images, files, etc)
all_paths = {p for p in all_paths if p.startswith("/")}

# Sort by impressions desc
sorted_paths = sorted(all_paths, key=lambda p: page_data.get(p, {}).get("impressions", 0), reverse=True)

# Limit to top 20 by impressions for the table
top_paths = sorted_paths[:20]

# ------------------------------------------------------------------
# CRO suggestions based on page path + intent
# ------------------------------------------------------------------
def cro_action(path, leads, impressions, top_qs):
    if leads > 0:
        return "—"
    if "/for-sellers" in path:
        return "Add free market report CTA above fold + sticky bar"
    if "/for-buyers" in path:
        return "Add 'Get listings' form above fold; highlight CHFA programs"
    if "/chfa" in path or "/schools-to-home" in path or "/champions" in path:
        return "Add program-specific lead form CTA after hero; tighten form fields"
    if "/northern-colorado-areas/" in path:
        city = path.split("/")[-2] if path.endswith("/") else path.split("/")[-1]
        return f"Add city-specific market report CTA + neighborhood guide signup"
    if "/blog/" in path:
        return "Add inline CTA + end-of-post lead magnet (market report / buyer guide)"
    if "/contact" in path:
        return "Reduce form fields; add click-to-call sticky on mobile"
    if impressions > 20:
        return "Add prominent CTA section + exit-intent popup"
    return "Review content-to-offer match; add contextual CTA"

# ------------------------------------------------------------------
# Build report rows
# ------------------------------------------------------------------
report_rows = []
for path in top_paths:
    gsc_info = page_data.get(path, {})
    imp = gsc_info.get("impressions", 0)
    pos = gsc_info.get("position", "—")
    leads = ga4_leads_by_page.get(path, 0)
    gap = "⚠️" if (imp >= 10 and leads == 0) else ("🔶" if (imp >= 5 and leads == 0) else "")
    qs = sorted(page_queries.get(path, []), key=lambda x: x["impressions"], reverse=True)[:3]
    q_text = ", ".join([f"\"{q['query']}\" ({q['impressions']})" for q in qs]) if qs else "—"
    action = cro_action(path, leads, imp, qs)
    report_rows.append({
        "page": path,
        "impressions": imp,
        "position": pos,
        "leads": leads,
        "gap": gap,
        "cro": action,
        "queries": q_text,
    })

# ------------------------------------------------------------------
# Markdown output
# ------------------------------------------------------------------
md_lines = []
md_lines.append(f"## Lead attribution log")
md_lines.append(f"")
md_lines.append(f"Week of {WEEK_LABEL}:")
md_lines.append("")
md_lines.append("| Landing Page | GSC Impressions | Position | GA4 Leads | Gap? | CRO Action |")
md_lines.append("|---|---|---|---|---|---|")
for r in report_rows:
    md_lines.append(f"| {r['page']} | {r['impressions']} | {r['position']} | {r['leads']} | {r['gap']} | {r['cro']} |")

md_lines.append("")
md_lines.append("### Top queries by page")
md_lines.append("")
for r in report_rows:
    if r["queries"] != "—":
        md_lines.append(f"- **{r['page']}**: {r['queries']}")

md_text = "\n".join(md_lines)
print(md_text)

# ------------------------------------------------------------------
# Append to MEMORY.md
# ------------------------------------------------------------------
memory_path = "./MEMORY.md"
with open(memory_path, "a", encoding="utf-8") as f:
    f.write("\n")
    f.write(md_text)
    f.write("\n")
    f.write(f"*Report generated: {datetime.utcnow().isoformat()}*\n")

print("\n✅ Appended to MEMORY.md")
