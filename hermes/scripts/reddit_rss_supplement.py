#!/usr/bin/env python3
"""Supplemental RSS scan: r/loveland, r/Greeley + keyword search feeds."""
import subprocess, xml.etree.ElementTree as ET, html, re, sys
from datetime import datetime, timezone

def fetch(url):
    r = subprocess.run(["curl","-s","--max-time","12","-A","Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36", url],
                       capture_output=True, text=True, timeout=20)
    d = r.stdout.strip()
    if not d or "Blocked" in d[:500] or "whoa there" in d[:500]:
        return None
    return d

def parse(xml_data):
    entries = []
    try:
        root = ET.fromstring(xml_data)
    except ET.ParseError:
        return entries
    ns = {"atom":"http://www.w3.org/2005/Atom"}
    for entry in root.findall("atom:entry", ns):
        t = entry.find("atom:title", ns)
        l = entry.find("atom:link", ns)
        p = entry.find("atom:published", ns)
        c = entry.find("atom:content", ns)
        title = t.text.strip() if t is not None and t.text else ""
        link = l.get("href") if l is not None else ""
        pub = p.text.strip() if p is not None and p.text else ""
        content_html = c.text.strip() if c is not None and c.text else ""
        content_text = html.unescape(re.sub(r'<[^>]+>',' ', content_html))
        entries.append({"title":title,"url":link,"published":pub,"content":content_text[:900]})
    return entries

def hours_ago(pub):
    try:
        dt = datetime.fromisoformat(pub.replace("Z","+00:00"))
        return int((datetime.now(timezone.utc)-dt).total_seconds()/3600)
    except Exception:
        return None

RE_KEYWORDS = re.compile(r"realtor|real estate|buying|selling|buy a|sell a|house|home|mortgage|chfa|down payment|agent|listing|closing|offer|price|market|move|moving|relocat|rent|landlord|apartment|condo|townhome|property|neighborhood", re.I)
EXCLUDE = re.compile(r"scam|lawsuit|nightmare|slumlord|complaint|avoid|sued|fraud", re.I)
NCO = re.compile(r"fort collins|loveland|greeley|windsor|timnath|wellington|severance|johnstown|berthoud|boulder|longmont|erie|firestone|frederick|niwot|evans|eaton|milliken|la salle|mead|brighton|estes park|red feather|fort lupton|lyons|bellvue|carbon valley|larimer|weld county|boulder county|noco|northern colorado", re.I)

targets = {
    "loveland": "https://www.reddit.com/r/loveland/new/.rss",
    "Greeley": "https://www.reddit.com/r/Greeley/new/.rss",
    "boulder": "https://www.reddit.com/r/boulder/new/.rss",
    "Longmont": "https://www.reddit.com/r/Longmont/new/.rss",
    "search:FC real estate": "https://www.reddit.com/search.rss?q=%22fort+collins%22+%28realtor+OR+%22real+estate%22+OR+%22buying+a+home%22%29&sort=new&t=week",
    "search:Boulder/Longmont real estate": "https://www.reddit.com/search.rss?q=%28boulder+OR+longmont%29+%28realtor+OR+%22real+estate%22+OR+%22buying+a+home%22+OR+%22moving+to%22%29&sort=new&t=week",
    "search:CHFA/DPA": "https://www.reddit.com/search.rss?q=CHFA+OR+%22down+payment+assistance%22+Colorado&sort=new&t=week",
    "search:moving to FC": "https://www.reddit.com/search.rss?q=%22moving+to+fort+collins%22+OR+%22moving+to+loveland%22+OR+%22moving+to+greeley%22&sort=new&t=week",
    "search:NoCo housing": "https://www.reddit.com/search.rss?q=%28loveland+OR+greeley+OR+%22fort+collins%22%29+%28%22buy+a+house%22+OR+%22sell+my+house%22+OR+%22first+time+home+buyer%22%29&sort=new&t=week",
}

results = []
for name, url in targets.items():
    xml = fetch(url)
    if not xml:
        print(f"[BLOCKED/empty] {name}", file=sys.stderr)
        continue
    entries = parse(xml)
    print(f"[OK] {name}: {len(entries)} entries", file=sys.stderr)
    for e in entries:
        combined = (e["title"]+" "+e["content"]).lower()
        if not RE_KEYWORDS.search(combined):
            continue
        if EXCLUDE.search(combined):
            continue
        nco = bool(NCO.search(combined))
        age = hours_ago(e["published"])
        if age is None or age > 72:
            continue
        e["name"]=name; e["nco"]=nco; e["age_h"]=age
        results.append(e)

seen = set()
uniq = []
for r in results:
    if r["url"] in seen:
        continue
    seen.add(r["url"])
    uniq.append(r)

uniq.sort(key=lambda x: (x["nco"], -len(x["content"])))
print("\n===== RELEVANT RECENT POSTS (<72h) =====")
if not uniq:
    print("NONE")
for r in uniq:
    print(f"\n[{r['name']}] {'NCO' if r['nco'] else '   '} age={r['age_h']}h | {r['title'][:90]}")
    print(f"  {r['url']}")
    print(f"  > {r['content'][:250].strip()}")
