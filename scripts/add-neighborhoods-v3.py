#!/usr/bin/env python3
"""Add remaining neighborhoods for Loveland, Windsor, Greeley with proper JS escaping."""
import re

FILE = "/opt/data/workspace/saahomes-repo/src/data/neighborhoods.js"

with open(FILE) as f:
    content = f.read()

def js_str(s):
    """Return a JS-safe single-quoted string."""
    s = str(s)
    escaped = s.replace("\\", "\\\\").replace("'", "\\'")
    return f"'{escaped}'"

def js_str_nullable(s):
    if s is None:
        return "null"
    return js_str(str(s))

def make_entry(slug, city, county, ntype, name, desc, styles, yr_min, yr_max, price, district, schools, hoa, features, parks, bounds, lat, lng, meta, kw, highlights):
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

# ─── LOVELAND additions ───
LOVELAND = [
    make_entry("mariana-butte", "loveland", "Larimer County", "subdivision", "Mariana Butte",
        "Mariana Butte is a premier golf course community in southwest Loveland, centered around the public 18-hole Mariana Butte Golf Course. The neighborhood features a mix of single-family homes, patio homes, and townhomes with fairway and lake views.",
        ["Contemporary", "Ranch", "Patio Home", "Mediterranean", "Townhome"],
        1995, 2025, "$400K to $900K+",
        "Thompson School District",
        [{"name":"Centennial Elementary","type":"elementary","level":"K-5","rating":8},{"name":"Conrad Ball Middle School","type":"middle","level":"6-8","rating":7},{"name":"Mountain View High School","type":"high","level":"9-12","rating":8}],
        "Mandatory HOA ($150-$350/month) includes golf course access, landscaping, snow removal",
        ["Golf course living - 18-hole public course", "Lake and mountain views", "Close to Centerra shopping", "Walking trails throughout", "Patio home options available", "Community pool and clubhouse"],
        ["Mariana Butte Golf Course", "Centerra Community Park", "Loveland Recreation Trail"],
        "Highway 34 to 43rd Street, Denver Avenue to Taft Avenue",
        40.4080, -105.0200,
        "Mariana Butte Loveland real estate - golf course homes near Centerra in southwest Loveland. Patio homes, single-family, and townhomes. SAA Homes.",
        "Mariana Butte Loveland, Mariana Butte golf course homes, southwest Loveland real estate, patio homes Loveland, golf course community Loveland, Centerra area homes",
        [
            {"title":"Golf course living","description":"Live on or overlooking the Mariana Butte 18-hole public golf course - one of Northern Colorado most scenic courses."},
            {"title":"Centerra proximity","description":"Minutes from the Promenade Shops at Centerra, Medical Center of the Rockies, and I-25."},
            {"title":"Low-maintenance options","description":"Patio homes and townhomes with HOA-managed landscaping offer lock-and-leave convenience."},
        ]),
    make_entry("high-plains-loveland", "loveland", "Larimer County", "subdivision", "High Plains",
        "High Plains is a popular master-planned community in southwest Loveland, offering newer homes with mountain views, community parks, and convenient access to Centerra and I-25.",
        ["Contemporary", "Farmhouse", "Ranch", "Patio Home"],
        2005, 2025, "$400K to $700K",
        "Thompson School District",
        [{"name":"Centennial Elementary","type":"elementary","level":"K-5","rating":8},{"name":"Conrad Ball Middle School","type":"middle","level":"6-8","rating":7},{"name":"Mountain View High School","type":"high","level":"9-12","rating":8}],
        "Mandatory HOA ($100-$200/month) covers common areas, pool, parks",
        ["Newer construction homes", "Community pool and parks", "Mountain views", "Close to I-25 and Centerra", "Family-friendly design", "Walking trails"],
        ["High Plains Park", "Centerra Community Park", "Loveland Recreation Trail"],
        "43rd Street to Highway 34, Denver Avenue to Taft Avenue",
        40.4000, -105.0100,
        "High Plains Loveland real estate - newer homes with mountain views in southwest Loveland near Centerra and I-25. SAA Homes.",
        "High Plains Loveland, High Plains subdivision, southwest Loveland homes, Centerra area real estate, new construction Loveland, mountain view homes Loveland",
        [
            {"title":"Newer construction","description":"Most homes built after 2005 with modern open floor plans, energy-efficient features, and contemporary finishes."},
            {"title":"Community pool","description":"The neighborhood pool and parks make High Plains a popular choice for families."},
            {"title":"Centerra access","description":"Minutes from the Promenade Shops, restaurants, and I-25 for easy commuting."},
        ]),
    make_entry("lake-loveland", "loveland", "Larimer County", "neighborhood", "Lake Loveland Area",
        "The Lake Loveland area is one of Loveland most desirable residential districts, with properties surrounding the 450-acre Lake Loveland. The area offers a mix of lakefront estates, mid-century homes, and newer subdivisions.",
        ["Ranch", "Contemporary", "Craftsman", "Lakefront Estate", "Townhome"],
        1950, 2025, "$350K to $1.2M+",
        "Thompson School District",
        [{"name":"Lake Loveland Elementary","type":"elementary","level":"K-5","rating":8},{"name":"Bill Reed Middle School","type":"middle","level":"6-8","rating":7},{"name":"Loveland High School","type":"high","level":"9-12","rating":7}],
        "Varies by subdivision - some areas have HOAs, many do not",
        ["Lake access for fishing, boating, paddleboarding", "Lake Loveland Trail - 3-mile paved loop", "Mountain views across the lake", "Mix of established and newer homes", "Close to North Loveland shopping", "Scenic views from many properties"],
        ["Lake Loveland", "North Lake Park", "Loveland Recreation Trail"],
        "US 34 to 29th Street, Madison Avenue to Wilson Avenue",
        40.4200, -105.0300,
        "Lake Loveland real estate - lakefront homes, mid-century ranches, and newer subdivisions around Loveland premier lake. SAA Homes.",
        "Lake Loveland homes, Lake Loveland real estate, north Loveland homes, lakefront Loveland, Lake Loveland trail, Loveland Colorado lake living",
        [
            {"title":"Lakefront lifestyle","description":"450-acre Lake Loveland offers fishing, boating, paddleboarding, and a 3-mile paved trail around the shoreline."},
            {"title":"Diverse housing","description":"Find everything from mid-century ranches to lakefront estates and newer subdivisions."},
            {"title":"Mountain views","description":"Many homes offer stunning views of the Rocky Mountains across the lake."},
        ]),
]

# Find Loveland section and insert near the end
lov_end = content.rfind("citySlug: 'loveland'")
if lov_end != -1:
    after_last = content.find("  },", lov_end)
    if after_last != -1:
        after_last = content.index("\n", after_last) + 1
        insert = "\n" + "\n\n".join(LOVELAND) + "\n"
        content = content[:after_last] + insert + content[after_last:]
        print(f"Inserted {len(LOVELAND)} Loveland neighborhoods")

# ─── WINDSOR additions ───
WINDSOR = [
    make_entry("highland-meadows-windsor", "windsor", "Weld County", "subdivision", "Highland Meadows",
        "Highland Meadows is an established Windsor subdivision featuring well-maintained homes on generous lots. The neighborhood offers a family-friendly atmosphere with community parks and convenient access to Windsor schools and Main Street.",
        ["Ranch", "Two-Story Traditional", "Split-Level", "Patio Home"],
        1990, 2015, "$400K to $600K",
        "Windsor School District RE-4",
        [{"name":"Tozer Elementary","type":"elementary","level":"K-5","rating":7},{"name":"Windsor Middle School","type":"middle","level":"6-8","rating":7},{"name":"Windsor High School","type":"high","level":"9-12","rating":8}],
        "Mandatory HOA ($75-$150/month) covers common areas",
        ["Established subdivision with mature landscaping", "Close to Windsor schools", "Family-friendly streets", "Community parks", "Near Main Street dining and shopping", "Affordable price point"],
        ["Highland Meadows Park", "Windsor Community Park", "Boardwalk Park"],
        "Weld County Road 66 to Main Street, 7th Street to 15th Street",
        40.4800, -104.9100,
        "Highland Meadows Windsor real estate - established family neighborhood near Windsor schools and Main Street. Affordable homes with HOA. SAA Homes.",
        "Highland Meadows Windsor, Highland Meadows subdivision, Windsor family homes, established Windsor neighborhoods, Windsor CO real estate, Main Street Windsor",
        [
            {"title":"Family-friendly","description":"Quiet streets, community parks, and walkable access to Windsor Middle and High Schools."},
            {"title":"Central Windsor","description":"Minutes from Main Street, Boardwalk Park, and Windsor Lake."},
            {"title":"Established setting","description":"Mature trees, established landscaping, and a settled community feel."},
        ]),
    make_entry("the-timbers", "windsor", "Weld County", "subdivision", "The Timbers",
        "The Timbers is a newer Windsor subdivision offering contemporary homes with modern floor plans. Located in west Windsor near the intersection of Weld County Road 15 and Crossroads Boulevard, the neighborhood provides easy access to both Windsor and Fort Collins.",
        ["Contemporary", "Farmhouse Modern", "Ranch", "Townhome"],
        2015, 2025, "$400K to $650K",
        "Windsor School District RE-4",
        [{"name":"Skyview Elementary","type":"elementary","level":"K-5","rating":8},{"name":"Windsor Middle School","type":"middle","level":"6-8","rating":7},{"name":"Windsor High School","type":"high","level":"9-12","rating":8}],
        "Mandatory HOA ($100-$200/month) covers common areas",
        ["Newer construction homes", "Modern floor plans", "Close to Fort Collins (10 minutes)", "Skyview Elementary (8/10) nearby", "Walking distance to shopping", "Community parks"],
        ["The Timbers Community Park", "Windsor Community Park", "Eastman Park"],
        "Weld County Road 15 to 17, Crossroads Boulevard to Main Street",
        40.4700, -104.9300,
        "The Timbers Windsor real estate - newer construction homes in west Windsor near Fort Collins. Modern floor plans with HOA. SAA Homes.",
        "The Timbers Windsor, The Timbers subdivision, west Windsor homes, new construction Windsor, Windsor Colorado new homes, Skyview Elementary Windsor",
        [
            {"title":"Newer homes","description":"Modern construction with open floor plans, energy efficiency, and contemporary finishes."},
            {"title":"Fort Collins proximity","description":"Located on Windsor west side - 10 minutes to south Fort Collins and Harmony Road."},
            {"title":"Growing area","description":"West Windsor is one of Northern Colorado fastest-growing areas with new amenities arriving regularly."},
        ]),
]

win_end = content.rfind("citySlug: 'windsor'")
if win_end != -1:
    after_last = content.find("  },", win_end)
    if after_last != -1:
        after_last = content.index("\n", after_last) + 1
        insert = "\n" + "\n\n".join(WINDSOR) + "\n"
        content = content[:after_last] + insert + content[after_last:]
        print(f"Inserted {len(WINDSOR)} Windsor neighborhoods")

# ─── GREELEY additions ───
GREELEY = [
    make_entry("kelly-farm", "greeley", "Weld County", "subdivision", "Kelly Farm",
        "Kelly Farm is one of Greeley most desirable newer subdivisions, featuring contemporary homes, community parks, and a family-friendly atmosphere. Located in west Greeley near 47th Avenue and 16th Street.",
        ["Contemporary", "Farmhouse Modern", "Ranch", "Patio Home"],
        2010, 2025, "$350K to $600K",
        "Greeley-Evans School District 6",
        [{"name":"West Ridge Elementary","type":"elementary","level":"K-5","rating":8},{"name":"Heath Middle School","type":"middle","level":"6-8","rating":7},{"name":"University Schools (K-12)","type":"charter","level":"K-12","rating":9}],
        "Mandatory HOA ($100-$200/month) covers common areas, parks, snow removal",
        ["Family-friendly subdivision", "Close to University Schools (K-12 charter)", "Newer construction", "Community parks and walking paths", "47th Avenue shopping nearby", "Highway 34 access"],
        ["Kelly Farm Community Park", "Sanborn Park", "Bittersweet Park"],
        "47th Avenue to 55th Avenue, 10th Street to 16th Street",
        40.4300, -104.7750,
        "Kelly Farm Greeley real estate - newer family homes near University Schools with community parks and shopping access. SAA Homes.",
        "Kelly Farm Greeley, Kelly Farm subdivision, west Greeley new construction, University Schools homes, Greeley family subdivisions, 47th Avenue Greeley homes",
        [
            {"title":"University Schools","description":"One of Greeley top-rated K-12 charter schools (9/10) is within walking distance - a major draw for families."},
            {"title":"Newer construction","description":"Modern floor plans, energy-efficient features, and contemporary finishes throughout."},
            {"title":"Community amenities","description":"Neighborhood parks, walking paths, and a family-friendly atmosphere."},
        ]),
    make_entry("bittersweet-greeley", "greeley", "Weld County", "neighborhood", "Bittersweet",
        "Bittersweet is a popular north Greeley neighborhood centered around Bittersweet Park, one of the city premier parks with a lake, trails, and sports facilities. The area features a mix of established homes and newer construction.",
        ["Ranch", "Contemporary", "Two-Story", "Townhome"],
        1970, 2025, "$300K to $500K",
        "Greeley-Evans School District 6",
        [{"name":"McAuliffe Elementary","type":"elementary","level":"K-5","rating":7},{"name":"Heath Middle School","type":"middle","level":"6-8","rating":7},{"name":"Greeley West High School","type":"high","level":"9-12","rating":7}],
        "Varies by subdivision; some areas have HOAs, many do not",
        ["Bittersweet Park - lake, trails, sports fields", "35th Avenue shopping corridor", "Close to UNC campus", "Mix of older and newer homes", "Family-friendly with pool access", "Walking and biking trails"],
        ["Bittersweet Park", "UNC Campus", "Poudre River Trail"],
        "35th Avenue to 47th Avenue, 10th Street to 20th Street",
        40.4400, -104.7400,
        "Bittersweet Greeley real estate - homes near Bittersweet Park with lake and trails. Family-friendly north Greeley near UNC. SAA Homes.",
        "Bittersweet Greeley, Bittersweet Park area, north Greeley homes, 35th Avenue Greeley, Greeley family neighborhoods, Greeley parks real estate",
        [
            {"title":"Bittersweet Park","description":"Greeley premier park with a lake, walking trails, sports fields, and a pool - the neighborhood backyard."},
            {"title":"35th Avenue corridor","description":"Shopping, dining, and services along 35th Avenue are just minutes from any home in Bittersweet."},
            {"title":"UNC proximity","description":"Close to the University of Northern Colorado - popular with faculty and staff."},
        ]),
]

gre_end = content.rfind("citySlug: 'greeley'")
if gre_end != -1:
    after_last = content.find("  },", gre_end)
    if after_last != -1:
        after_last = content.index("\n", after_last) + 1
        insert = "\n" + "\n\n".join(GREELEY) + "\n"
        content = content[:after_last] + insert + content[after_last:]
        print(f"Inserted {len(GREELEY)} Greeley neighborhoods")

with open(FILE, 'w') as f:
    f.write(content)

print("Done!")
