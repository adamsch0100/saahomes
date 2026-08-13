#!/usr/bin/env python3
"""
Reddit RSS opportunity scanner for SAA Homes.
Fetches RSS feeds from multiple subreddits and scores posts for real estate relevance.
Designed for cron jobs where PRAW/API credentials are unavailable.
"""
import html
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from subprocess import run, PIPE

SUBREDDITS = ["FortCollins", "boulder", "Longmont", "RealEstate", "Colorado", "FirstTimeHomeBuyer"]

STRONG_KEYWORDS = [
    "realtor", "buying a home", "sell my home", "sell my house", "moving to",
    "real estate agent", "first time home buyer", "need an agent", "looking for a realtor",
    "chfa", "down payment", "market update", "home prices", "housing market",
    "list my home", "selling my house", "looking to buy", "house hunting",
    "relocating to", "new to fort collins", "moving to fort collins",
    "colorado real estate", "buy a house", "sell a house",
    "fort collins", "loveland", "windsor", "greeley", "northern colorado",
    "boulder", "longmont", "erie", "firestone", "frederick", "niwot", "evans",
    "boulder county",
    "noco real estate", "home loan", "mortgage rate",
]

LOCATIONS_NCO = ["fort collins", "loveland", "windsor", "greeley", "northern colorado",
                 "wellington", "timnath", "severance", "johnstown", "berthoud",
                 "boulder", "longmont", "erie", "firestone", "frederick", "niwot",
                 "evans", "eaton", "milliken", "mead", "la salle",
                 "brighton", "estes park", "red feather lakes", "fort lupton",
                 "lyons", "bellvue", "carbon valley",
                 "larimer county", "weld county", "boulder county", "noco"]

EXCLUDE = ["scam", "lawsuit", "nightmare", "slumlord", "complaint", "avoid"]


def fetch_rss(subreddit):
    """Fetch RSS via curl (avoids Python urllib rate-limiting issues)."""
    url = f"https://www.reddit.com/r/{subreddit}/new/.rss"
    result = run(
        ["curl", "-s", "--max-time", "10",
         "-A", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
         url],
        capture_output=True, text=True, timeout=15
    )
    if result.returncode != 0:
        return None
    data = result.stdout.strip()
    if not data or "Blocked" in data[:500] or "whoa there" in data[:500]:
        return None
    return data


def parse_rss(xml_data, subreddit):
    entries = []
    try:
        root = ET.fromstring(xml_data)
    except ET.ParseError:
        return entries
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    for entry in root.findall("atom:entry", ns):
        title_el = entry.find("atom:title", ns)
        link_el = entry.find("atom:link", ns)
        pub_el = entry.find("atom:published", ns)
        author_el = entry.find("atom:author", ns)
        content_el = entry.find("atom:content", ns)

        title = title_el.text.strip() if title_el is not None and title_el.text else ""
        link = link_el.get("href") if link_el is not None else ""
        published = pub_el.text.strip() if pub_el is not None and pub_el.text else ""

        author = ""
        if author_el is not None:
            name_el = author_el.find("atom:name", ns)
            if name_el is not None and name_el.text:
                author = name_el.text.strip()

        content_html = content_el.text.strip() if content_el is not None and content_el.text else ""
        content_text = re.sub(r'<[^>]+>', ' ', content_html)
        content_text = html.unescape(content_text)

        entries.append({
            "title": title,
            "url": link,
            "published": published,
            "author": author,
            "subreddit": subreddit,
            "content": content_text[:800]
        })
    return entries


def score_post(post):
    score = 0
    combined = (post["title"] + " " + post["content"]).lower()

    # Must match at least one keyword
    if not any(kw.lower() in combined for kw in STRONG_KEYWORDS):
        return 0, "SKIP"

    # Exclude negative content
    if any(ep in combined for ep in EXCLUDE):
        return 0, "SKIP"

    if any(p in combined for p in ["real estate agent", "realtor", "need an agent",
                                     "looking for a realtor", "realtor recommendations",
                                     "good realtor", "realtor in", "agent recommendations"]):
        score += 35
    if any(p in combined for p in ["buying a home", "first home", "first time home buyer",
                                     "looking to buy", "house hunting", "buy my first",
                                     "buy our first", "offer accepted", "under contract"]):
        score += 30
    if any(p in combined for p in ["sell my home", "selling my house", "list my home",
                                     "sell my house", "sell our house", "selling home",
                                     "put my house"]):
        score += 25
    if any(city in combined for city in LOCATIONS_NCO):
        score += 20
    if any(p in combined for p in ["chfa", "down payment", "downpayment",
                                     "first time buyer program", "fha", "usda loan"]):
        score += 15
    if "colorado" in combined:
        score += 10
    if any(p in combined for p in ["moving to", "relocating to", "new to fort collins",
                                     "just moved", "thinking of moving", "moving from",
                                     "relocate to"]):
        score += 15

    s = min(100, max(0, score))
    if s >= 70:
        label = "HIGH"
    elif s >= 40:
        label = "MEDIUM"
    elif s >= 20:
        label = "LOW"
    else:
        label = "SKIP"
    return s, label


def main():
    print("=" * 60, file=__import__('sys').stderr)
    print("  REDDIT RSS SCAN — SAA Homes", file=__import__('sys').stderr)
    print(f"  {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}", file=__import__('sys').stderr)
    print(f"  Subreddits: {len(SUBREDDITS)}", file=__import__('sys').stderr)
    print("=" * 60, file=__import__('sys').stderr)

    all_posts = []
    for sub in SUBREDDITS:
        print(f"\nFetching r/{sub}...", file=__import__('sys').stderr)
        xml_data = fetch_rss(sub)
        if xml_data:
            entries = parse_rss(xml_data, sub)
            print(f"  Got {len(entries)} posts", file=__import__('sys').stderr)
            for entry in entries:
                s, label = score_post(entry)
                if s > 0:
                    entry["score"] = s
                    entry["label"] = label
                    all_posts.append(entry)
                    print(f"  {label}({s:2d}) {entry['title'][:70]}", file=__import__('sys').stderr)
        else:
            print(f"  BLOCKED or empty", file=__import__('sys').stderr)
        time.sleep(2)

    all_posts.sort(key=lambda p: p["score"], reverse=True)
    actionable = [p for p in all_posts if p["score"] >= 20]

    print(f"\nTotal: {len(all_posts)} relevant, {len(actionable)} actionable", file=__import__('sys').stderr)

    # Output digest for cron delivery
    if not actionable:
        print("[SILENT]")
        return

    lines = [
        f"## 🔍 Reddit Scan — {datetime.now(timezone.utc).strftime('%b %d')}",
        f"**{len(actionable)} actionable post(s)** across {len(SUBREDDITS)} subreddits",
        "",
    ]
    for p in actionable:
        try:
            pub = datetime.fromisoformat(p["published"].replace("Z", "+00:00"))
            ago_h = int((datetime.now(timezone.utc) - pub).total_seconds() / 3600)
        except:
            ago_h = "?"

        lines.append(f"### {'🔥' if p['score']>=70 else '💡' if p['score']>=40 else '🔍'} {p['label']} (Score: {p['score']})")
        lines.append(f"**r/{p['subreddit']}** — {p['title']}")
        lines.append(f"⏱ {ago_h}h ago | 🔗 {p['url']}")
        if p['score'] >= 70:
            lines.append("**🎯 Engage:** Offer market data. Reference saahomes.com/blog/ or program pages.")
        elif p['score'] >= 40:
            lines.append("**💬 Respond:** Provide helpful info first. Link naturally if context fits.")
        elif p['score'] >= 20:
            lines.append("**👀 Monitor:** Low urgency but worth watching.")
        snippet = p["content"][:200].replace("\n", " ").strip()
        if snippet:
            lines.append(f"> {snippet}")
        lines.append("")

    lines.append("---")
    lines.append("_SAA Homes Reddit Monitor | RSS fallback_")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
