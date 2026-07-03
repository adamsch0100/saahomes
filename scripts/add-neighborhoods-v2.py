#!/usr/bin/env python3
"""Insert neighborhood entries into neighborhoods.js with proper JS escaping."""
import re

FILE = "/opt/data/workspace/saahomes-repo/src/data/neighborhoods.js"

with open(FILE) as f:
    content = f.read()

def js_str(s):
    """Return a JS-safe string using single quotes, escaping any internal ' or \\."""
    escaped = s.replace("\\", "\\\\").replace("'", "\\'")
    return f"'{escaped}'"

def js_str_nullable(s):
    if s is None:
        return "null"
    return js_str(str(s))

def make_entry(slug, city, county, ntype, name, desc, styles, yr_min, yr_max, price, district, schools, hoa, features, parks, bounds, lat, lng, meta, kw, highlights):
    def q(s): return f"'{s}'"
    def qs(arr): return "[" + ", ".join(js_str(s) for s in arr) + "]"
    
    school_lines = "[\n" + "\n".join(
        f"      {{ name: {js_str(s['name'])}, type: {js_str(s['type'])}, level: {js_str(s['level'])}, rating: {js_str_nullable(s.get('rating'))} }},"
        for s in schools
    ) + "\n    ]"
    
    hl_lines = "[\n" + "\n".join(
        f"      {{ title: {js_str(h['title'])}, description: {js_str(h['description'])} }},"
        for h in highlights
    ) + "\n    ]"
    
    return f"""  {{
    slug: {js_str(slug)},
    citySlug: {js_str(city)},
    cityDisplay: {js_str(city.replace('-', ' ').title())},
    county: {js_str(county)},
    type: {js_str(ntype)},
    name: {js_str(name)},
    description: {js_str(desc)},
    homeStyles: {qs(styles)},
    yearBuiltRange: {{ min: {yr_min}, max: {yr_max} }},
    priceRangeDescription: {js_str(price)},
    schoolDistrict: {js_str(district)},
    schools: {school_lines},
    hoaDescription: {js_str(hoa)},
    features: {qs(features)},
    parks: {qs(parks)},
    boundaries: {js_str(bounds)},
    coordinates: {{ latitude: {js_str(str(lat))}, longitude: {js_str(str(lng))} }},
    metaDescription: {js_str(meta)},
    keywords: {js_str(kw)},
    neighborhoodHighlights: {hl_lines},
  }},"""

# ─── FORT COLLINS additions ───
FC_NEW = [
    make_entry("ridgewood-hills", "fort-collins", "Larimer County", "subdivision", "Ridgewood Hills",
        "Ridgewood Hills is a premier master-planned community in southeast Fort Collins, featuring executive homes on generous lots with mountain views. The neighborhood is served by top-rated Fossil Ridge schools and offers easy access to the Harmony Road corridor.",
        ["Contemporary", "Ranch", "Two-Story Traditional", "Custom Estate", "Patio Home"],
        2000, 2025, "$500K to $1.2M+",
        "Poudre School District",
        [{"name":"Ridgeview Elementary","type":"elementary","level":"K-5","rating":9},{"name":"Preston Middle School","type":"middle","level":"6-8","rating":8},{"name":"Fossil Ridge High School","type":"high","level":"9-12","rating":9}],
        "Mandatory HOA ($150-$300/month) includes landscaping, snow removal, community pool",
        ["Mountain views from elevated lots", "Top-rated Fossil Ridge schools (9/10)", "Close to Harmony Road shopping", "Walking trails and community parks", "Newer construction (2000-present)", "Minutes to I-25 and Fort Collins"],
        ["Ridgeview Park", "Fossil Creek Park", "Spring Canyon Park"],
        "Harmony Road to Larimer County Road 30, Lemay Avenue to Timberline Road",
        40.5200, -105.0400,
        "Ridgewood Hills Fort Collins real estate - executive homes near Fossil Ridge schools in southeast Fort Collins premier master-planned community. SAA Homes - your local experts.",
        "Ridgewood Hills Fort Collins, Ridgewood Hills subdivision, southeast Fort Collins homes, Fossil Ridge homes, Fort Collins master-planned community, executive homes Fort Collins",
        [
            {"title":"Top-rated schools","description":"Ridgeview Elementary (9/10) and Fossil Ridge High School (9/10) - one of the best school clusters in Northern Colorado."},
            {"title":"Executive homes","description":"Custom-built homes with premium finishes on generous lots, many with mountain and city views."},
            {"title":"Convenient location","description":"Minutes from Harmony Road shopping, dining, and I-25 - an easy commute to Denver or Loveland."},
        ]),
    make_entry("fossil-creek", "fort-collins", "Larimer County", "neighborhood", "Fossil Creek",
        "Fossil Creek is a family-friendly neighborhood in south Fort Collins centered around Fossil Creek Park, one of the city largest and most popular parks. The area features a mix of newer homes, townhomes, and patio homes with excellent access to the Harmony Road corridor.",
        ["Contemporary", "Ranch", "Townhome", "Patio Home"],
        1995, 2025, "$350K (townhomes) to $700K (single-family)",
        "Poudre School District",
        [{"name":"Ridgeview Elementary","type":"elementary","level":"K-5","rating":9},{"name":"Preston Middle School","type":"middle","level":"6-8","rating":8},{"name":"Fossil Ridge High School","type":"high","level":"9-12","rating":9}],
        "Most subdivisions have HOAs ($100-$200/month)",
        ["Fossil Creek Park - 90+ acres with lake, trails, playgrounds", "Fossil Creek Trail connectivity", "Close to Harmony Road shopping", "Family-friendly with multiple parks", "Mix of price points and home styles", "Fossil Ridge High School attendance area"],
        ["Fossil Creek Park", "Spring Canyon Park", "Ridgeview Park"],
        "Harmony Road to Fossil Creek Parkway, Lemay Avenue to Timberline Road",
        40.5150, -105.0500,
        "Fossil Creek Fort Collins real estate - family-friendly homes near Fossil Creek Park with top-rated schools and Harmony Road access. SAA Homes.",
        "Fossil Creek Fort Collins, Fossil Creek Park, Fossil Creek homes, south Fort Collins real estate, Fossil Ridge schools, Fort Collins family neighborhoods",
        [
            {"title":"Fossil Creek Park","description":"90+ acre park with a lake, fishing pier, walking trails, playgrounds, and sports fields - one of Fort Collins best parks."},
            {"title":"Top school cluster","description":"Ridgeview Elementary (9/10) and Fossil Ridge High School (9/10) serve the Fossil Creek area."},
            {"title":"Central south-side location","description":"Minutes from Harmony Road restaurants, shopping, and major employers."},
        ]),
    make_entry("indian-hills", "fort-collins", "Larimer County", "neighborhood", "Indian Hills",
        "Indian Hills is an established Fort Collins neighborhood known for its winding tree-lined streets, mature landscaping, and mid-century ranch homes. Located near the foothills of northwest Fort Collins, the area offers a quiet residential setting with convenient access to Horsetooth Reservoir and Old Town.",
        ["Ranch", "Mid-Century Modern", "Split-Level", "Custom Home"],
        1960, 1990, "$450K to $800K",
        "Poudre School District",
        [{"name":"Bailey Elementary","type":"elementary","level":"K-5","rating":9},{"name":"Webber Middle School","type":"middle","level":"6-8","rating":8},{"name":"Poudre High School","type":"high","level":"9-12","rating":8}],
        "No HOA in most of Indian Hills",
        ["Mature trees and winding streets", "Mid-century architecture with character", "Close to Horsetooth Reservoir", "Bailey Elementary (9/10) attendance area", "Quiet, established neighborhood feel", "Quick access to Taft Hill Road corridor"],
        ["Indian Hills Natural Area", "Horsetooth Mountain Open Space", "Grandview Cemetery Open Space"],
        "Taft Hill Road to Centennial Drive, Horsetooth Road to Drake Road",
        40.5550, -105.1000,
        "Indian Hills Fort Collins real estate - mid-century ranch homes on tree-lined streets near Horsetooth Reservoir. Established northwest Fort Collins neighborhood. SAA Homes.",
        "Indian Hills Fort Collins, Indian Hills neighborhood, northwest Fort Collins homes, mid-century homes Fort Collins, Bailey Elementary Fort Collins, Fort Collins foothills homes",
        [
            {"title":"Mature character","description":"Winding tree-lined streets with mid-century ranch homes and mature landscaping - a quiet, established feel."},
            {"title":"Bailey Elementary (9/10)","description":"Served by one of Fort Collins top-rated elementary schools."},
            {"title":"Foothills access","description":"Minutes from Horsetooth Reservoir, Lory State Park, and miles of hiking and biking trails."},
        ]),
]

# Insert after the last FC entry (University Area)
# Find the last FC entry by locating the last citySlug: 'fort-collins'
fc_entries = [m.start() for m in re.finditer(r"citySlug: 'fort-collins'", content)]
if fc_entries:
    last_fc = fc_entries[-1]
    # Find the closing of that entry - the next  },  after the last FC slug
    after_last = content.find("  },", last_fc)
    if after_last != -1:
        after_last = content.index("\n", after_last) + 1
        insert = "\n" + "\n\n".join(FC_NEW) + "\n"
        content = content[:after_last] + insert + content[after_last:]
        print(f"Inserted {len(FC_NEW)} FC neighborhoods after position {after_last}")
    else:
        print("ERROR: Could not find FC section end")
else:
    print("ERROR: No FC entries found")

with open(FILE, 'w') as f:
    f.write(content)

print("Done")
