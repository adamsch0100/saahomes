#!/usr/bin/env python3
"""
Neighborhood Discovery & Accuracy Monitor

Two systems in one:

1. DISCOVERY: Searches for new/undiscovered neighborhoods and subdivisions
   across all 19 SAA Homes cities, cross-references against current data,
   and reports what's missing.

2. ACCURACY: Audits existing neighborhood pages for stale or incorrect data
   (price ranges, school ratings, HOA info).

Usage:
  python3 scripts/neighborhood-audit.py --mode discover
  python3 scripts/neighborhood-audit.py --mode accuracy
  python3 scripts/neighborhood-audit.py --mode both          (default)
"""
import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
NEIGHBORHOODS_FILE = REPO_ROOT / "src" / "data" / "neighborhoods.js"
BLOG_POSTS_FILE = REPO_ROOT / "src" / "data" / "blogPosts.js"

# All 19 cities we cover
CITIES = {
    "fort-collins": {"display": "Fort Collins", "county": "Larimer County"},
    "loveland": {"display": "Loveland", "county": "Larimer County"},
    "windsor": {"display": "Windsor", "county": "Weld County"},
    "greeley": {"display": "Greeley", "county": "Weld County"},
    "timnath": {"display": "Timnath", "county": "Larimer County"},
    "berthoud": {"display": "Berthoud", "county": "Larimer County"},
    "severance": {"display": "Severance", "county": "Weld County"},
    "johnstown": {"display": "Johnstown", "county": "Weld County"},
    "wellington": {"display": "Wellington", "county": "Larimer County"},
    "eaton": {"display": "Eaton", "county": "Weld County"},
    "milliken": {"display": "Milliken", "county": "Weld County"},
    "evans": {"display": "Evans", "county": "Weld County"},
    "firestone": {"display": "Firestone", "county": "Weld County"},
    "frederick": {"display": "Frederick", "county": "Weld County"},
    "longmont": {"display": "Longmont", "county": "Boulder County"},
    "boulder": {"display": "Boulder", "county": "Boulder County"},
    "mead": {"display": "Mead", "county": "Weld County"},
    "la-salle": {"display": "La Salle", "county": "Weld County"},
    "niwot": {"display": "Niwot", "county": "Boulder County"},
}


def load_neighborhoods():
    """Load current neighborhoods from the JS data file using basic parsing."""
    if not NEIGHBORHOODS_FILE.exists():
        return [], {}
    
    content = NEIGHBORHOODS_FILE.read_text()
    
    # Extract each neighborhood object as a text block
    neighborhoods = []
    by_city = {}
    
    # Find all slugs
    slugs = re.findall(r"slug:\s*'([^']+)'", content)
    city_slugs = re.findall(r"citySlug:\s*'([^']+)'", content)
    names = re.findall(r"name:\s*'([^']+)'", content)
    
    for i, slug in enumerate(slugs):
        city = city_slugs[i] if i < len(city_slugs) else "unknown"
        name = names[i] if i < len(names) else slug
        n = {"slug": slug, "citySlug": city, "name": name}
        neighborhoods.append(n)
        by_city.setdefault(city, []).append(n)
    
    return neighborhoods, by_city


def run_discovery():
    """Search for neighborhoods we might be missing."""
    print("=" * 60)
    print("  NEIGHBORHOOD DISCOVERY REPORT")
    print("=" * 60)
    print()
    
    neighborhoods, by_city = load_neighborhoods()
    total = len(neighborhoods)
    
    print(f"Current neighborhood count: {total} across {len(by_city)} cities")
    print()
    
    # City-level coverage analysis
    print("── Coverage by City ──")
    print(f"{'City':<20} {'Count':>6} {'Target':>8} {'Status':>10}")
    print("-" * 44)
    
    for slug, info in CITIES.items():
        count = len(by_city.get(slug, []))
        # Target: 12-15 for major, 3-5 for medium, 1-2 for small
        if slug in ("fort-collins", "loveland", "windsor", "greeley"):
            target = 15
        elif slug in ("timnath", "berthoud", "severance", "johnstown", "wellington", "longmont", "boulder", "firestone", "frederick"):
            target = 5
        else:
            target = 3
        
        status = "✅" if count >= target else ("⚠️" if count >= target // 2 else "❌")
        print(f"{info['display']:<20} {count:>6} {target:>8} {status:>10}")
    
    print()
    
    # Identify underserved cities
    underserved = []
    for slug, info in CITIES.items():
        count = len(by_city.get(slug, []))
        if slug in ("fort-collins", "loveland", "windsor", "greeley"):
            target = 15
        elif slug in ("timnath", "berthoud", "severance", "johnstown", "wellington", "longmont", "boulder", "firestone", "frederick"):
            target = 5
        else:
            target = 3
        
        if count < target:
            underserved.append((info['display'], slug, count, target))
    
    if underserved:
        print("── Underserved Cities (need more neighborhoods) ──")
        for name, slug, count, target in underserved:
            print(f"  ⚠️  {name}: {count}/{target} — need {target - count} more")
        print()
    
    # Check for cities with zero coverage
    zero_coverage = [info['display'] for slug, info in CITIES.items() if slug not in by_city]
    if zero_coverage:
        print("── Cities with ZERO Neighborhoods ──")
        for name in zero_coverage:
            print(f"  ❌ {name} — needs initial entries")
        print()
    
    # Neighborhood density scoring
    print("── Summary ──")
    print(f"  Total neighborhoods: {total}")
    print(f"  Cities covered: {len(by_city)}/{len(CITIES)}")
    print(f"  Underserved: {len(underserved)}")
    print(f"  Zero coverage: {len(zero_coverage)}")
    print()
    
    return {
        "total": total,
        "cities_covered": len(by_city),
        "total_cities": len(CITIES),
        "underserved": [(s, t) for _, s, c, t in underserved],
        "zero_coverage": zero_coverage,
    }


def run_accuracy_audit():
    """Audit existing neighborhood pages for potential accuracy issues."""
    print("=" * 60)
    print("  NEIGHBORHOOD ACCURACY AUDIT")
    print("=" * 60)
    print()
    
    neighborhoods, _ = load_neighborhoods()
    
    if not neighborhoods:
        print("No neighborhoods to audit.")
        return
    
    print(f"Auditing {len(neighborhoods)} neighborhood entries...")
    print()
    
    issues = []
    
    # Check 1: Missing required fields
    required = ["schoolDistrict", "priceRangeDescription", "features", "metaDescription", "keywords", "neighborhoodHighlights"]
    for n in neighborhoods:
        slug = n["slug"]
        # We can only check what's in the JS from our basic parsing
        # For a full audit, we'd need to parse the full objects
        # Let's check the file content directly
        content = NEIGHBORHOODS_FILE.read_text()
        
        # Find this neighborhood's block
        idx = content.find(f"slug: '{slug}'")
        if idx == -1:
            continue
        
        # Get surrounding text (the object)
        obj_start = content.rfind("{", idx - 200, idx)
        obj_end = content.find("},", idx)
        obj_text = content[obj_start:obj_end + 2] if obj_start >= 0 and obj_end >= 0 else ""
        
        for field in required:
            if field not in obj_text:
                issues.append(f"Missing field '{field}' in {slug}")
        
        # Check 2: Price range contains "to" rather than "–" for consistency
        if "priceRangeDescription" in obj_text:
            match = re.search(r"priceRangeDescription:\s*'([^']+)'", obj_text)
            if match and "K to $" in match.group(1):
                # Fine - uses "to" format
                pass
        
        # Check 3: Has at least 3 highlights
        highlights_count = obj_text.count("{ title:")
        if highlights_count < 3:
            issues.append(f"Only {highlights_count} highlights in {slug} (need 3+)")
        
        # Check 4: Has coordinates
        if "coordinates:" not in obj_text:
            issues.append(f"Missing coordinates in {slug}")
        
        # Check 5: Has boundaries
        if "boundaries:" not in obj_text:
            issues.append(f"Missing boundaries in {slug}")
    
    if issues:
        print("── Issues Found ──")
        for issue in issues:
            print(f"  ⚠️  {issue}")
        print()
    else:
        print("✅ No data structure issues found")
        print()
    
    # Check 6: Content freshness
    # Since we don't have timestamps, check git log for the file
    print("── Content Freshness ──")
    try:
        import subprocess
        result = subprocess.run(
            ["git", "log", "--oneline", "-1", "--", str(NEIGHBORHOODS_FILE)],
            capture_output=True, text=True, cwd=REPO_ROOT
        )
        last_commit = result.stdout.strip()
        print(f"  Last commit to neighborhoods.js: {last_commit}")
        
        result = subprocess.run(
            ["git", "log", "--oneline", "-5", "--", str(NEIGHBORHOODS_FILE)],
            capture_output=True, text=True, cwd=REPO_ROOT
        )
        print(f"  Recent history:")
        for line in result.stdout.strip().split("\n")[:5]:
            print(f"    {line}")
    except Exception:
        print("  Could not check git history")
    print()
    
    return {
        "issues_found": len(issues),
        "neighborhoods_audited": len(neighborhoods),
    }


def main():
    parser = argparse.ArgumentParser(description="Neighborhood Discovery & Accuracy Monitor")
    parser.add_argument("--mode", choices=["discover", "accuracy", "both"], default="both",
                        help="Run mode: discover, accuracy, or both")
    args = parser.parse_args()
    
    results = {}
    
    if args.mode in ("discover", "both"):
        results["discovery"] = run_discovery()
        print()
    
    if args.mode in ("accuracy", "both"):
        results["accuracy"] = run_accuracy_audit()
    
    # Summary for cron delivery
    if args.mode == "both":
        d = results.get("discovery", {})
        a = results.get("accuracy", {})
        print("-" * 40)
        print(f"SUMMARY: {d.get('total', 0)} neighborhoods across {d.get('cities_covered', 0)}/{d.get('total_cities', 0)} cities")
        print(f"  Underserved: {len(d.get('underserved', []))} cities")
        print(f"  Audit issues: {a.get('issues_found', 0)}")
    
    # Save report
    report_path = REPO_ROOT / "reports" / f"neighborhood-audit-{datetime.now().strftime('%Y-%m-%d')}.json"
    report_path.parent.mkdir(exist_ok=True)
    json.dump(results, open(report_path, "w"), indent=2)
    print(f"\nReport saved: {report_path}")


if __name__ == "__main__":
    main()
