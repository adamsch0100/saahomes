#!/usr/bin/env python3
"""Add remaining neighborhood entries to hit targets for each city."""
import re

FILE = "/opt/data/workspace/saahomes-repo/src/data/neighborhoods.js"

with open(FILE) as f:
    content = f.read()

def js_str(s):
    s = str(s)
    escaped = s.replace("\\", "\\\\").replace("'", "\\'")
    return f"'{escaped}'"

def make_entry(slug, city, county, ntype, name, desc, styles, yr_min, yr_max, price, district, schools, hoa, features, parks, bounds, lat, lng, meta, kw, highlights):
    def qs(arr): return "[" + ", ".join(js_str(s) for s in arr) + "]"
    school_lines = "[\n" + "\n".join(f"      {{ name: {js_str(s['name'])}, type: {js_str(s['type'])}, level: {js_str(s['level'])}, rating: {js_str(str(s.get('rating',''))) if s.get('rating') else 'null'} }},"
        for s in schools) + "\n    ]"
    hl_lines = "[\n" + "\n".join(f"      {{ title: {js_str(h['title'])}, description: {js_str(h['description'])} }},"
        for h in highlights) + "\n    ]"
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

# ─── More Fort Collins ───
FC_EXTRA = [
    make_entry("sheely-addition", "fort-collins", "Larimer County", "neighborhood", "Sheely Addition",
        "Sheely Addition is a historic post-war neighborhood between CSU and the Gardens on Spring Creek. Built in the 1940s-1950s, this charming area features cottage-style homes on tree-lined streets.",
        ["Cottage", "Ranch", "Cape Cod", "Post-War Bungalow"],
        1940, 1970, "$350K to $550K",
        "Poudre School District",
        [{"name":"Putnam Elementary","type":"elementary","level":"K-5","rating":8},{"name":"Lincoln Middle School","type":"middle","level":"6-8","rating":7},{"name":"Fort Collins High School","type":"high","level":"9-12","rating":8}],
        "No HOA",
        ["Historic post-war character", "Cottage-style homes at accessible prices", "Walkable to CSU campus", "Gardens on Spring Creek nearby", "Close to City Park", "Established community feel"],
        ["City Park", "Gardens on Spring Creek", "Spring Creek Trail"],
        "Prospect Road to Spring Creek, Shields Street to Lemay Avenue",
        40.5600, -105.0700,
        "Sheely Addition Fort Collins - historic post-war cottages near CSU and City Park. Affordable entry to central Fort Collins. SAA Homes.",
        "Sheely Addition Fort Collins, Sheely Addition homes, historic Fort Collins neighborhoods, CSU area homes, post-war homes Fort Collins, central Fort Collins real estate",
        [
            {"title":"Historic charm","description":"Post-war cottage and Cape Cod homes with original character - one of Fort Collins most charming older neighborhoods."},
            {"title":"Walk to CSU","description":"Located between CSU and the Gardens on Spring Creek - walk to campus, parks, and shopping."},
            {"title":"Affordable entry","description":"One of the most accessible price points in central Fort Collins for single-family homes."},
        ]),
    make_entry("city-park-fc", "fort-collins", "Larimer County", "neighborhood", "City Park Area",
        "The City Park area is one of Fort Collins most beloved historic neighborhoods, centered around the 32-acre City Park with its pool, lake, and community spaces. The area features early to mid-1900s homes on tree-lined streets.",
        ["Bungalow", "Colonial Revival", "Craftsman", "Ranch"],
        1910, 1960, "$400K to $750K",
        "Poudre School District",
        [{"name":"Putnam Elementary","type":"elementary","level":"K-5","rating":8},{"name":"Lincoln Middle School","type":"middle","level":"6-8","rating":7},{"name":"Fort Collins High School","type":"high","level":"9-12","rating":8}],
        "No HOA",
        ["City Park with pool, lake, and recreation center", "Historic homes with architecture and character", "Walk to Old Town and shopping", "Mature tree canopy", "Community pool and recreation", "Annual City Park events"],
        ["City Park", "Spring Creek Trail", "Old Town Square"],
        "Mulberry Street to Prospect Road, Shields Street to Lemay Avenue",
        40.5650, -105.0700,
        "City Park Fort Collins real estate - historic bungalows and craftsman homes near Old Town. One of Fort Collins most beloved neighborhoods. SAA Homes.",
        "City Park Fort Collins, Fort Collins City Park area, historic Fort Collins homes, homes near Old Town Fort Collins, central Fort Collins real estate, Mulberry Street Fort Collins",
        [
            {"title":"City Park lifestyle","description":"32-acre park with pool, lake, walking paths, sports fields - the heart of the neighborhood."},
            {"title":"Historic architecture","description":"Bungalows, Craftsman, and Colonial Revival homes from the 1910s-1950s on tree-lined streets."},
            {"title":"Walk to Old Town","description":"Just a 10-minute walk to Old Town Square - breweries, restaurants, and shopping without driving."},
        ]),
    make_entry("horsetooth-west", "fort-collins", "Larimer County", "neighborhood", "Horsetooth / West Fort Collins",
        "The Horsetooth area stretches along the western edge of Fort Collins, offering scenic properties with direct access to Horsetooth Reservoir, Lory State Park, and the foothills. Features larger custom homes on acreage and equestrian properties.",
        ["Custom Ranch", "Mountain Contemporary", "Equestrian Estate", "Log Home", "Craftsman"],
        1970, 2025, "$500K to $2M+",
        "Poudre School District",
        [{"name":"Bailey Elementary","type":"elementary","level":"K-5","rating":9},{"name":"Webber Middle School","type":"middle","level":"6-8","rating":8},{"name":"Poudre High School","type":"high","level":"9-12","rating":8}],
        "Many areas have no HOA; select subdivisions have HOAs ($100-$300/month)",
        ["Direct access to Horsetooth Reservoir", "Hiking and biking trails from doorstep", "Larger lots - many 1-5 acres", "Equestrian properties available", "Panoramic mountain views", "Quiet, private setting"],
        ["Horsetooth Mountain Open Space", "Lory State Park", "Cathy Fromme Prairie Natural Area"],
        "Overland Trail to Centennial Drive, Horsetooth Road to County Road 38E",
        40.5600, -105.1400,
        "Horsetooth area Fort Collins real estate - acreage, custom homes, equestrian properties near Horsetooth Reservoir. SAA Homes.",
        "Horsetooth Fort Collins homes, Horsetooth Reservoir real estate, west Fort Collins acreage, equestrian properties Fort Collins, custom homes Fort Collins, foothills living Fort Collins",
        [
            {"title":"Outdoor paradise","description":"Horsetooth Reservoir, Lory State Park, and miles of trails are literally steps from your front door."},
            {"title":"Space and privacy","description":"Larger lots from 1 to 5 acres offer room for gardens, animals, and space between neighbors."},
            {"title":"Mountain views","description":"Panoramic views of Horsetooth Rock, Longs Peak, and the Front Range from many properties."},
        ]),
    make_entry("buckingham-fc", "fort-collins", "Larimer County", "neighborhood", "Buckingham",
        "Buckingham is a quiet central Fort Collins neighborhood offering a mix of mid-century homes and newer infill construction. Located near Drake Road and Shields Street, it provides convenient access to both Old Town and south Fort Collins.",
        ["Ranch", "Split-Level", "Contemporary", "Townhome"],
        1950, 2025, "$350K to $600K",
        "Poudre School District",
        [{"name":"Olander Elementary","type":"elementary","level":"K-5","rating":8},{"name":"Blevins Middle School","type":"middle","level":"6-8","rating":7},{"name":"Rocky Mountain High School","type":"high","level":"9-12","rating":9}],
        "No HOA in most of Buckingham; select newer developments have HOAs",
        ["Central Fort Collins location", "Rocky Mountain High School (9/10) attendance area", "Quick access to Drake and Shields corridors", "Mix of older and newer homes", "Close to Spring Creek Trail", "Family-friendly streets"],
        ["Spring Creek Park", "Edora Pool and Ice Center", "Spring Creek Trail"],
        "Drake Road to Horsetooth Road, Shields Street to Lemay Avenue",
        40.5480, -105.0900,
        "Buckingham Fort Collins real estate - central Fort Collins homes with Rocky Mountain High School access. SAA Homes.",
        "Buckingham Fort Collins, Buckingham neighborhood, central Fort Collins homes, Drake Road Fort Collins, Rocky Mountain High School area, Spring Creek Trail homes",
        [
            {"title":"Central location","description":"At Drake and Shields - the geographic center of Fort Collins, minutes from anywhere in the city."},
            {"title":"Rocky Mountain High (9/10)","description":"One of Fort Collins top-rated high schools serves the Buckingham area."},
            {"title":"Spring Creek Trail","description":"The Spring Creek Trail runs along the southern edge, connecting to the citywide trail network."},
        ]),
]

# ─── More Greeley ───
GREELEY_EXTRA = [
    make_entry("covington-knolls", "greeley", "Weld County", "subdivision", "Covington Knolls",
        "Covington Knolls is an established west Greeley subdivision with well-maintained homes and mature landscaping. Offers a mix of ranch and two-story homes near the 47th Avenue shopping corridor and University Schools.",
        ["Ranch", "Two-Story Traditional", "Split-Level"],
        1995, 2010, "$325K to $500K",
        "Greeley-Evans School District 6",
        [{"name":"West Ridge Elementary","type":"elementary","level":"K-5","rating":8},{"name":"Heath Middle School","type":"middle","level":"6-8","rating":7},{"name":"University Schools (K-12)","type":"charter","level":"K-12","rating":9}],
        "Mandatory HOA ($75-$150/month)",
        ["Mature landscaping and trees", "University Schools access", "47th Avenue shopping nearby", "Well-maintained homes", "Established community", "Family-friendly streets"],
        ["Sanborn Park", "Bittersweet Park", "Poudre River Trail"],
        "47th Avenue to 59th Avenue, 10th Street to O Street",
        40.4250, -104.7700,
        "Covington Knolls Greeley real estate - established west Greeley homes near University Schools with mature landscaping. SAA Homes.",
        "Covington Knolls Greeley, Covington Knolls subdivision, west Greeley homes, University Schools area, established Greeley subdivisions, 47th Avenue Greeley",
        [
            {"title":"Established setting","description":"Mature trees, established landscaping, and a settled neighborhood feel."},
            {"title":"University Schools","description":"Close to University Schools (9/10 K-12 charter) - one of Greeley top educational options."},
            {"title":"Shopping corridor","description":"Minutes from the 47th Avenue shopping corridor with grocery, dining, and retail."},
        ]),
    make_entry("pine-ridge-estates", "greeley", "Weld County", "subdivision", "Pine Ridge Estates",
        "Pine Ridge Estates is one of Greeley premier luxury subdivisions, featuring executive homes on large lots with mountain views in a gated community setting.",
        ["Custom Estate", "Mediterranean", "Contemporary", "Ranch"],
        2000, 2025, "$600K to $1.2M+",
        "Greeley-Evans School District 6",
        [{"name":"West Ridge Elementary","type":"elementary","level":"K-5","rating":8},{"name":"Heath Middle School","type":"middle","level":"6-8","rating":7},{"name":"University Schools (K-12)","type":"charter","level":"K-12","rating":9}],
        "Mandatory HOA ($200-$400/month) - gated community with private amenities",
        ["Gated community", "Executive custom homes", "Large lots with mountain views", "Private amenities", "Prestigious address", "West Greeley location"],
        ["Pine Ridge Estates Community Park", "Sanborn Park", "Poudre River Trail"],
        "65th Avenue to 71st Avenue, US 34 to O Street",
        40.4200, -104.7900,
        "Pine Ridge Estates Greeley real estate - luxury gated community with executive homes and mountain views. SAA Homes.",
        "Pine Ridge Estates Greeley, luxury homes Greeley, gated community Greeley, executive homes Greeley, custom homes Greeley Colorado",
        [
            {"title":"Gated luxury","description":"Greeley premier gated community with executive homes, large lots, and mountain views."},
            {"title":"Custom estates","description":"Custom-built executive homes with premium finishes, gourmet kitchens, and resort-style landscaping."},
            {"title":"West Greeley address","description":"The most prestigious address in west Greeley, close to University Schools and Highway 34."},
        ]),
]

# Insert each batch
for city_slug, entries in [("fort-collins", FC_EXTRA), ("greeley", GREELEY_EXTRA)]:
    last_idx = content.rfind(f"citySlug: '{city_slug}'")
    if last_idx != -1:
        after_last = content.find("  },", last_idx)
        if after_last != -1:
            after_last = content.index("\n", after_last) + 1
            insert = "\n" + "\n\n".join(entries) + "\n"
            content = content[:after_last] + insert + content[after_last:]
            print(f"Inserted {len(entries)} in {city_slug}")

with open(FILE, 'w') as f:
    f.write(content)

print("Done!")
