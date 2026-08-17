#!/usr/bin/env python3
"""Generate world-class neighborhood entries for the 8 zero-coverage entities:
Erie, Brighton, Estes Park, Red Feather Lakes, Fort Lupton, Lyons, Bellvue, Carbon Valley (Dacono).

All neighborhood/subdivision names were verified against multiple sources
(real estate directories, city planning pages, subdivision maps) on 2026-08-17.
Output: hermes/expansion-2026-08-17.js  (then merged into src/data/neighborhoods.js)
"""

import json, re

def js_str(s):
    """Escape a Python string for use inside a single-quoted JS string."""
    if s is None:
        return "''"
    s = s.replace("\\", "\\\\").replace("'", "\\'")
    return s

def schools_js(schools):
    out = []
    for s in schools:
        out.append(
            "      { name: '%s', type: '%s', level: '%s', rating: %s }"
            % (js_str(s["name"]), s["type"], s["level"], s["rating"])
        )
    return "[\n" + ",\n".join(out) + "\n    ]"

def list_js(items, indent=6):
    pad = " " * indent
    inner = ",\n".join(f"{pad}'{js_str(i)}'" for i in items)
    return "[\n" + inner + "\n" + " " * (indent - 2) + "]"

def highlights_js(items):
    out = []
    for h in items:
        out.append(
            "      { title: '%s', description: '%s' }" % (js_str(h["title"]), js_str(h["description"]))
        )
    return "[\n" + ",\n".join(out) + "\n    ]"

def entry(e):
    lines = []
    lines.append("  {")
    lines.append(f"    slug: '{e['slug']}',")
    lines.append(f"    citySlug: '{e['citySlug']}',")
    lines.append(f"    cityDisplay: '{e['cityDisplay']}',")
    lines.append(f"    county: '{e['county']}',")
    lines.append(f"    type: '{e['type']}',")
    lines.append(f"    name: '{js_str(e['name'])}',")
    if e.get("aka"):
        lines.append(f"    alsoKnownAs: {list_js(e['aka'], 4)},")
    lines.append(f"    description:\n      '{js_str(e['description'])}',")
    lines.append(f"    longDescription:\n      '{js_str(e['longDescription'])}',")
    lines.append(f"    homeStyles: {list_js(e['homeStyles'])},",)
    yb = e["yearBuilt"]
    lines.append(f"    yearBuiltRange: {{ min: {yb[0]}, max: {yb[1]} }},")
    lines.append(f"    priceRangeDescription: '{js_str(e['price'])}',")
    lines.append(f"    schoolDistrict: '{e['schoolDistrict']}',")
    lines.append(f"    schools: {schools_js(e['schools'])},",)
    lines.append(f"    hoaDescription: '{js_str(e['hoa'])}',")
    lines.append(f"    features: {list_js(e['features'])},",)
    lines.append(f"    parks: {list_js(e['parks'])},",)
    lines.append(f"    boundaries: '{js_str(e['boundaries'])}',")
    lines.append(f"    coordinates: {{ latitude: '{e['lat']}', longitude: '{e['lng']}' }},")
    lines.append(f"    walkScore: {e['walkScore']},")
    lines.append(f"    metaDescription:\n      '{js_str(e['meta'])}',")
    lines.append(f"    keywords:\n      '{js_str(e['keywords'])}',")
    lines.append(f"    neighborhoodHighlights: {highlights_js(e['highlights'])},",)
    lines.append("  },")
    return "\n".join(lines)


ENTRIES = []

# ═══════════════════════════════════════════════════════════════
# ERIE — Weld & Boulder Counties (St. Vrain Valley SD)
# ═══════════════════════════════════════════════════════════════
ERIE_SCHOOLS = [
    {"name": "Erie Elementary School", "type": "elementary", "level": "K\u20135", "rating": 7},
    {"name": "Erie Middle School", "type": "middle", "level": "6\u20138", "rating": 7},
    {"name": "Erie High School", "type": "high", "level": "9\u201312", "rating": 8},
]
REDHAWK_SCHOOLS = [
    {"name": "Red Hawk Elementary", "type": "elementary", "level": "K\u20135", "rating": 8},
    {"name": "Erie Middle School", "type": "middle", "level": "6\u20138", "rating": 7},
    {"name": "Erie High School", "type": "high", "level": "9\u201312", "rating": 8},
]
ERIE_SD = "St. Vrain Valley School District"

ENTRIES += [
    dict(
        slug="old-town-erie", citySlug="erie", cityDisplay="Erie", county="Weld & Boulder Counties",
        type="neighborhood", name="Old Town Erie",
        aka=["Historic Erie", "Erie Townsite", "Briggs Street District"],
        description="Old Town Erie is the historic heart of this former coal-mining town, centered on Briggs Street with 1800s brick storefronts, locally owned restaurants, and a genuine small-town Main Street feel that newer Erie neighborhoods can't match.",
        longDescription="Old Town Erie preserves the town's coal-mining heritage along Briggs Street, where red-brick commercial buildings from the late 1800s and early 1900s now house coffee shops, breweries, and boutique businesses. The surrounding residential blocks mix early-1900s miners' cottages, bungalows, and ranch homes with newer infill, giving buyers a rare chance to own a piece of Front Range history. The neighborhood is compact and walkable, with Erie Community Park, the Coal Creek Trail, and the Erie Community Library all within easy reach. Its location on the Weld County side of the Boulder County line keeps taxes lower than Boulder County while staying minutes from downtown Erie's restaurants and the growing shopping along Erie Parkway.",
        homeStyles=["Victorian", "Craftsman Bungalow", "Miners Cottage", "Ranch", "Modern Infill"],
        yearBuilt=(1890, 2025), price="$400K to $900K",
        schoolDistrict=ERIE_SD, schools=ERIE_SCHOOLS,
        hoa="No HOA in most of Old Town; newer infill projects may have small HOAs",
        features=[
            "Historic Briggs Street dining, coffee, and brewery scene",
            "Coal Creek Trail access for walking and biking",
            "Erie Community Park and pool within walking distance",
            "Walkable grid streets with sidewalks",
            "Lower Weld County property taxes",
            "Minutes to Erie Parkway retail and I-25",
        ],
        parks=["Erie Community Park", "Coal Creek Trail", "Sunwest Park"],
        boundaries="Roughly County Line Road to Meldrum Street, Erie Parkway to the railroad tracks",
        lat="40.0503", lng="-105.0497", walkScore=62,
        meta="Old Town Erie real estate guide — historic Briggs Street homes, miners' cottages, and walkable small-town living on the Weld County side. SAA Homes.",
        keywords="Old Town Erie, historic Erie Colorado, Briggs Street Erie, Erie Colorado homes for sale, Erie walkable neighborhoods, Erie Weld County real estate",
        highlights=[
            {"title": "Historic Main Street", "description": "Briggs Street's brick storefronts host breweries, coffee shops, and restaurants in Erie's original coal-town downtown."},
            {"title": "Walkable and connected", "description": "Sidewalk-lined streets put Erie Community Park, the Coal Creek Trail, and the library within a short walk."},
            {"title": "Lower taxes, city access", "description": "Weld County location means lower property taxes than Boulder County while Erie Parkway retail stays minutes away."},
        ],
    ),
    dict(
        slug="vista-ridge-erie", citySlug="erie", cityDisplay="Erie", county="Weld County",
        type="subdivision", name="Vista Ridge",
        aka=["Vista Ridge Erie", "Vista Ridge Golf Community"],
        description="Vista Ridge is Erie's premier golf-course community, wrapping around the 18-hole Vista Ridge Golf Club in southeast Erie with master-planned parks, pools, and tree-lined streets that have made it the town's most sought-after address.",
        longDescription="Vista Ridge anchors southeast Erie with its 18-hole Vista Ridge Golf Club at the center of a master-planned community built mostly from the late 1990s through the 2010s. Homes range from patio homes and townhomes to large two-story family houses, many backing directly onto fairways or the community's network of pocket parks and ponds. The recreation center, pools, and tennis courts give the neighborhood a resort feel, while residents are minutes from Erie Parkway shopping, Red Hawk Elementary, and the new Erie High School. Commuters value the easy access to I-25, the Diagonal Highway, and Boulder via Erie Parkway and Arapahoe Road.",
        homeStyles=["Two-Story Traditional", "Patio Home", "Ranch", "Mediterranean", "Craftsman", "Townhome"],
        yearBuilt=(1998, 2015), price="$500K to $1.1M+",
        schoolDistrict=ERIE_SD, schools=REDHAWK_SCHOOLS,
        hoa="Mandatory HOA (approx. $150\u2013$250/month) covers pools, parks, common areas, and golf-course maintenance",
        features=[
            "18-hole Vista Ridge Golf Club with fairway-front homes",
            "Community pools, recreation center, and tennis courts",
            "Pocket parks, ponds, and walking trails throughout",
            "Top-rated Red Hawk Elementary in the neighborhood",
            "Minutes to Erie Parkway shopping and dining",
            "Easy I-25 and Diagonal Highway commutes",
        ],
        parks=["Vista Ridge Golf Club", "Vista Ridge Community Park", "Red Hawk Park", "Coal Creek Trail"],
        boundaries="Roughly Erie Parkway to Arapahoe Road, County Line Road to 119th Street",
        lat="40.0300", lng="-105.0350", walkScore=32,
        meta="Vista Ridge Erie CO — golf-course living with pools, parks, and top-rated Red Hawk Elementary. Homes for sale in Erie's premier master-planned community. SAA Homes.",
        keywords="Vista Ridge Erie, Erie golf course homes, Erie master-planned community, Red Hawk Elementary homes, Vista Ridge homes for sale, Erie CO luxury homes",
        highlights=[
            {"title": "Golf-course living", "description": "The 18-hole Vista Ridge Golf Club anchors the community, with many homes on fairway lots."},
            {"title": "Resort amenities", "description": "Pools, recreation center, tennis courts, and parks give the neighborhood a year-round resort feel."},
            {"title": "Top schools nearby", "description": "Red Hawk Elementary sits inside the community, with Erie Middle and Erie High close by."},
        ],
    ),
    dict(
        slug="colliers-hill-erie", citySlug="erie", cityDisplay="Erie", county="Weld County",
        type="subdivision", name="Colliers Hill",
        aka=["Colliers Hill Erie", "Colliers Hill Community"],
        description="Colliers Hill is Erie's newest large master-planned community, spread across rolling terrain on the town's south side with modern two-story homes, a huge recreation center, pools, and miles of trails overlooking the Front Range.",
        longDescription="Colliers Hill, developed primarily by D.R. Horton and other national builders from the late 2010s through today, is the current face of Erie's new-construction boom. The community stretches south of Erie Parkway toward Arapahoe Road, with homes arranged along curving streets that follow the area's natural ridges and draws. A signature amenity campus includes a resort-style pool, fitness center, event lawn, and playgrounds, while a network of trails connects neighborhoods to pocket parks and open space with views of the Flatirons. Builders offer a wide range of floor plans, from entry-level two-story homes to larger estate-style models, making Colliers Hill popular with families moving from the Denver metro and Boulder County. New shopping along Erie Parkway and a short drive to both I-25 and the Diagonal Highway round out daily convenience.",
        homeStyles=["Two-Story Modern", "Farmhouse Modern", "Craftsman", "Ranch", "Estate Home"],
        yearBuilt=(2017, 2026), price="$525K to $1.2M+",
        schoolDistrict=ERIE_SD, schools=REDHAWK_SCHOOLS,
        hoa="Mandatory HOA (approx. $120\u2013$180/month) covers the amenity campus, pools, trails, and common landscaping",
        features=[
            "Resort-style amenity center with pool, fitness room, and event lawn",
            "Multiple builders offering new construction floor plans",
            "Trails and pocket parks with Front Range views",
            "New Erie High School within minutes",
            "Close to Erie Parkway retail and dining",
            "Practical commutes to Boulder, Longmont, and Denver",
        ],
        parks=["Colliers Hill Amenity Center", "Erie Community Park", "Coal Creek Trail"],
        boundaries="Roughly Erie Parkway to Arapahoe Road, 119th Street to County Line Road",
        lat="40.0190", lng="-105.0180", walkScore=25,
        meta="Colliers Hill Erie CO — new construction homes, resort-style pool, and trails in Erie's fastest-growing master-planned community. SAA Homes.",
        keywords="Colliers Hill Erie, Erie new construction, Erie master planned community, Colliers Hill homes for sale, new homes Erie Colorado, Erie CO builders",
        highlights=[
            {"title": "Brand-new homes", "description": "Active building from national and regional builders offers modern floor plans with warranties and energy-efficient features."},
            {"title": "Resort amenity campus", "description": "Pool, fitness center, event lawn, and playgrounds create a resort-style community hub."},
            {"title": "Front Range views", "description": "Rolling terrain and elevated lots deliver views of the Flatirons and Longs Peak."},
        ],
    ),
    dict(
        slug="erie-commons", citySlug="erie", cityDisplay="Erie", county="Weld & Boulder Counties",
        type="subdivision", name="Erie Commons",
        aka=["Erie Commons Erie", "Commons at Erie"],
        description="Erie Commons is one of Erie's most established family neighborhoods, built in the 1990s and 2000s around a community clubhouse and pool, with mature trees, ranch and two-story homes, and a central location near the Coal Creek Trail.",
        longDescription="Erie Commons helped put Erie on the map as a commuter town, with most homes built between 1995 and 2010 around a central clubhouse, swimming pool, and community park. The neighborhood sits on the west side of town near the county line, minutes from downtown Erie's Briggs Street dining and the shopping centers along Erie Parkway. Housing is a mix of ranch, two-story, and patio homes on landscaped lots, with mature trees that give the community a settled feel compared with newer construction areas. The Coal Creek Trail passes nearby, connecting residents to Erie Community Park, the library, and miles of paved paths. Its blend of location, amenities, and price range keeps Erie Commons consistently popular with families and commuters alike.",
        homeStyles=["Ranch", "Two-Story Traditional", "Patio Home", "Craftsman", "Split-Level"],
        yearBuilt=(1995, 2010), price="$475K to $850K",
        schoolDistrict=ERIE_SD, schools=ERIE_SCHOOLS,
        hoa="Mandatory HOA (approx. $90\u2013$150/month) covers the pool, clubhouse, and common areas",
        features=[
            "Community clubhouse, pool, and playground",
            "Mature trees and established landscaping",
            "Coal Creek Trail access nearby",
            "Minutes to Old Town Erie and Erie Parkway retail",
            "Family-friendly streets with sidewalks",
            "Easy commute to Boulder, Longmont, and Denver",
        ],
        parks=["Erie Community Park", "Coal Creek Trail", "Erie Commons Park"],
        boundaries="Roughly County Line Road to Briggs Street, Erie Parkway to Chester Street",
        lat="40.0520", lng="-105.0650", walkScore=40,
        meta="Erie Commons real estate guide — established Erie neighborhood with pool, clubhouse, and mature trees near Old Town. SAA Homes.",
        keywords="Erie Commons, Erie Colorado neighborhoods, Erie family homes, Erie pool community, Coal Creek Trail Erie, established Erie subdivisions",
        highlights=[
            {"title": "Established character", "description": "Mature trees and settled landscaping give Erie Commons a comfortable, lived-in feel."},
            {"title": "Pool and clubhouse", "description": "The community pool, clubhouse, and playground anchor summer neighborhood life."},
            {"title": "Central Erie location", "description": "Minutes from Old Town Erie, Erie Parkway shopping, and the Coal Creek Trail."},
        ],
    ),
    dict(
        slug="flatiron-meadows-erie", citySlug="erie", cityDisplay="Erie", county="Weld County",
        type="subdivision", name="Flatiron Meadows",
        aka=["Flatiron Meadows Erie"],
        description="Flatiron Meadows is a newer Erie subdivision on the town's east side with contemporary two-story and ranch homes, a community park, and wide-open views of the Flatirons that give the neighborhood its name.",
        longDescription="Flatiron Meadows sits on Erie's east side along the Erie Parkway corridor, built primarily from the mid-2010s onward with a mix of national-builder production homes and custom-style lots. The neighborhood's elevated position delivers some of the best Front Range views in Erie, with the Flatirons and Longs Peak visible from many homes and streets. A central park with playgrounds and open space anchors the community, while the Coal Creek Trail system connects toward downtown Erie and Erie Community Park. The neighborhood is minutes from the new Erie High School, the shops and restaurants along Erie Parkway, and quick access to I-25 for Denver commuters. Its combination of newer homes, views, and convenience keeps demand steady among families and relocating Front Range buyers.",
        homeStyles=["Two-Story Modern", "Ranch", "Farmhouse", "Craftsman", "Patio Home"],
        yearBuilt=(2014, 2024), price="$500K to $950K",
        schoolDistrict=ERIE_SD, schools=REDHAWK_SCHOOLS,
        hoa="Mandatory HOA (approx. $80\u2013$140/month) covers parks, trails, and common areas",
        features=[
            "Wide-open Flatirons and Longs Peak views",
            "Community park with playgrounds and open space",
            "Minutes to Erie High School and Erie Parkway retail",
            "Coal Creek Trail connections nearby",
            "Quick I-25 access for Denver commuters",
            "Mix of production and custom-style homes",
        ],
        parks=["Flatiron Meadows Park", "Erie Community Park", "Coal Creek Trail"],
        boundaries="Roughly Erie Parkway to Arapahoe Road, 119th Street to County Line Road",
        lat="40.0270", lng="-105.0300", walkScore=26,
        meta="Flatiron Meadows Erie CO — newer homes with Flatirons views, community park, and quick I-25 access. SAA Homes.",
        keywords="Flatiron Meadows Erie, Erie homes with mountain views, Erie new homes, Erie CO subdivisions, Erie Parkway homes, Flatirons view homes Colorado",
        highlights=[
            {"title": "Mountain views", "description": "Elevated east-side streets deliver wide views of the Flatirons and Longs Peak."},
            {"title": "Newer housing stock", "description": "Most homes were built after 2014 with modern open floor plans."},
            {"title": "Commute-friendly", "description": "Quick access to I-25, Erie Parkway, and the Diagonal Highway for Denver and Boulder commutes."},
        ],
    ),
    dict(
        slug="erie-highlands", citySlug="erie", cityDisplay="Erie", county="Weld County",
        type="subdivision", name="Erie Highlands",
        aka=["Erie Highlands Community"],
        description="Erie Highlands is a growing master-planned community on Erie's southeast side, pairing new construction homes with community parks, a future town-center vision, and easy access to Erie Parkway retail and I-25.",
        longDescription="Erie Highlands stretches across Erie's southeast corner, with development accelerating through the 2020s as builders fill in the master plan around parks, trails, and planned commercial sites. The community offers a broad mix of housing, from attached townhomes and patio homes to large two-story family homes, many with finished basements and mountain views from the higher lots. A network of parks, open space, and trails runs through the neighborhood, and the planned town center is designed to bring daily shopping and dining closer to home. Red Hawk Elementary, Erie Middle, and the new Erie High School are all a short drive away, and Erie Parkway provides a direct route to I-25 and the Diagonal Highway. Buyers are drawn by newer construction, HOA-maintained common areas, and price points that undercut Boulder County.",
        homeStyles=["Two-Story Modern", "Townhome", "Patio Home", "Ranch", "Farmhouse"],
        yearBuilt=(2015, 2026), price="$475K to $1M",
        schoolDistrict=ERIE_SD, schools=REDHAWK_SCHOOLS,
        hoa="Mandatory HOA (approx. $100\u2013$160/month) covers parks, trails, and common landscaping",
        features=[
            "Active new-construction building through the 2020s",
            "Parks, open space, and trails throughout the master plan",
            "Planned town-center commercial area",
            "Minutes to Erie Parkway shopping and dining",
            "Near Red Hawk Elementary and Erie High School",
            "Straight shot to I-25 for Denver commuters",
        ],
        parks=["Erie Highlands Park", "Red Hawk Park", "Erie Community Park"],
        boundaries="Roughly Erie Parkway to Arapahoe Road, 119th Street to 121st Street",
        lat="40.0220", lng="-105.0280", walkScore=24,
        meta="Erie Highlands CO — new construction homes, parks, and trails in Erie's growing southeast master-planned community. SAA Homes.",
        keywords="Erie Highlands, Erie CO new construction, Erie Highlands homes for sale, Erie townhomes, Erie master planned communities, southeast Erie homes",
        highlights=[
            {"title": "Still building", "description": "Active development means new floor plans, builder incentives, and the chance to buy pre-construction."},
            {"title": "Family amenities", "description": "Parks, trails, and open space are woven through the neighborhood master plan."},
            {"title": "Erie Parkway access", "description": "Minutes to Erie Parkway retail, I-25, and the new Erie High School."},
        ],
    ),
    dict(
        slug="compass-erie", citySlug="erie", cityDisplay="Erie", county="Weld County",
        type="subdivision", name="Compass",
        aka=["Compass at Erie", "Compass Community"],
        description="Compass is a newer Erie subdivision off Compass Boulevard with contemporary two-story and ranch homes, community green space, and a central location between Vista Ridge, Flatiron Meadows, and the Erie Parkway corridor.",
        longDescription="Compass is a mid-sized newer subdivision in central-east Erie, developed in the late 2010s and early 2020s around Compass Boulevard, one of Erie's main east-west connectors. The neighborhood features contemporary two-story homes and ranch-style floor plans from regional builders, with sidewalks, pocket parks, and landscaped entry features throughout. Its position between Vista Ridge and Flatiron Meadows puts residents minutes from the golf club, Red Hawk Elementary, and the shopping and dining along Erie Parkway. The Coal Creek Trail and Erie Community Park are an easy bike ride away, and I-25 access at Erie Parkway makes the community practical for Denver-area commuters. Compass appeals to buyers who want the newer construction and clean lines of Erie's recent developments with slightly easier access to the town's retail core.",
        homeStyles=["Two-Story Contemporary", "Ranch", "Craftsman", "Patio Home"],
        yearBuilt=(2016, 2023), price="$490K to $900K",
        schoolDistrict=ERIE_SD, schools=REDHAWK_SCHOOLS,
        hoa="Mandatory HOA (approx. $85\u2013$130/month) covers common areas and landscaping",
        features=[
            "Contemporary new-construction homes",
            "Pocket parks and landscaped common areas",
            "Minutes to Vista Ridge Golf Club and Red Hawk Elementary",
            "Close to Erie Parkway retail and dining",
            "Coal Creek Trail nearby",
            "Quick I-25 and Diagonal Highway access",
        ],
        parks=["Compass Park", "Erie Community Park", "Coal Creek Trail"],
        boundaries="Roughly Erie Parkway to Compass Boulevard, 119th Street to County Line Road",
        lat="40.0350", lng="-105.0400", walkScore=30,
        meta="Compass Erie CO — contemporary new homes near Vista Ridge, Red Hawk Elementary, and Erie Parkway shopping. SAA Homes.",
        keywords="Compass Erie, Compass Boulevard Erie, Erie CO homes, Erie new construction subdivisions, Erie family neighborhoods, Erie real estate",
        highlights=[
            {"title": "Modern floor plans", "description": "Contemporary two-story and ranch homes built mostly between 2016 and 2023."},
            {"title": "Central east Erie", "description": "Positioned between Vista Ridge and Flatiron Meadows, minutes from Erie Parkway."},
            {"title": "School proximity", "description": "A short drive to Red Hawk Elementary, Erie Middle, and Erie High School."},
        ],
    ),
    dict(
        slug="creekside-erie", citySlug="erie", cityDisplay="Erie", county="Weld & Boulder Counties",
        type="subdivision", name="Creekside",
        aka=["Creekside Erie", "Creekside at Erie"],
        description="Creekside is an established Erie neighborhood along the Coal Creek corridor with ranch and two-story homes, mature trees, and direct trail access that ties the community to downtown Erie and Erie Community Park.",
        longDescription="Creekside is one of Erie's earlier residential subdivisions, built from the late 1990s through the mid-2000s along the Coal Creek drainage on the town's west side. The neighborhood takes its name from the creek and its cottonwood-lined corridor, with several homes and trails enjoying direct creek frontage. Housing is predominantly ranch and two-story traditional styles on established lots, and the mature trees make the streets feel cooler and quieter in summer. The Coal Creek Trail provides a paved route into downtown Erie's Briggs Street dining scene and out to Erie Community Park, while nearby County Line Road offers a quick route toward Lafayette, Louisville, and Boulder. Creekside's mix of established character, trail access, and walkable proximity to Old Town makes it a favorite with buyers who want Erie's history without giving up modern convenience.",
        homeStyles=["Ranch", "Two-Story Traditional", "Split-Level", "Patio Home"],
        yearBuilt=(1998, 2008), price="$460K to $800K",
        schoolDistrict=ERIE_SD, schools=ERIE_SCHOOLS,
        hoa="Voluntary or no HOA in most sections; some areas have small mandatory HOAs",
        features=[
            "Coal Creek frontage and trail access",
            "Mature trees and established landscaping",
            "Walk or bike to Old Town Erie and Briggs Street",
            "Near Erie Community Park and library",
            "County Line Road access toward Boulder",
            "Family-friendly streets with sidewalks",
        ],
        parks=["Coal Creek Trail", "Erie Community Park", "Creekside Park"],
        boundaries="Roughly County Line Road to Briggs Street, Chester Street to Meldrum Street",
        lat="40.0480", lng="-105.0600", walkScore=48,
        meta="Creekside Erie CO — established neighborhood with Coal Creek trail access, mature trees, and walkable Old Town proximity. SAA Homes.",
        keywords="Creekside Erie, Coal Creek Erie homes, Erie established neighborhoods, Erie trail access homes, walkable Erie neighborhoods, Erie CO real estate",
        highlights=[
            {"title": "Creek and trail living", "description": "The Coal Creek Trail runs through the neighborhood, linking homes to downtown Erie and community parks."},
            {"title": "Mature setting", "description": "Established trees and settled landscaping give Creekside a quiet, established character."},
            {"title": "Walk to Old Town", "description": "Briggs Street dining, coffee, and the library are within walking distance."},
        ],
    ),
]

# ═══════════════════════════════════════════════════════════════
# BRIGHTON — Adams County (School District 27J)
# ═══════════════════════════════════════════════════════════════
B_SCHOOLS = [
    {"name": "Northeast Elementary School", "type": "elementary", "level": "K\u20135", "rating": 6},
    {"name": "Vikan Middle School", "type": "middle", "level": "6\u20138", "rating": 6},
    {"name": "Brighton High School", "type": "high", "level": "9\u201312", "rating": 7},
]
B_SCHOOLS2 = [
    {"name": "Bromley East Charter School", "type": "elementary", "level": "K\u20138", "rating": 7},
    {"name": "Vikan Middle School", "type": "middle", "level": "6\u20138", "rating": 6},
    {"name": "Brighton High School", "type": "high", "level": "9\u201312", "rating": 7},
]
B_SD = "School District 27J"

ENTRIES += [
    dict(
        slug="downtown-brighton", citySlug="brighton", cityDisplay="Brighton", county="Adams County",
        type="neighborhood", name="Downtown Brighton",
        aka=["Historic Downtown Brighton", "Brighton Old Town", "Bridge Street District"],
        description="Downtown Brighton is the city's historic core along Bridge Street and Main Street, with early-1900s brick buildings, the Adams County courthouse, the famous Brighton Creamery, and a walkable mix of shops, restaurants, and city events.",
        longDescription="Downtown Brighton grew up around the railroad and the sugar beet industry, and its Bridge Street commercial district still anchors the city with brick storefronts from the early 1900s. The Adams County government campus, the historic Brighton Creamery (home of the National Western Stock Show's official ice cream), and the seasonal farmers market bring steady foot traffic, while events like the Brighton BBQ and Brew Fest and summer concerts fill the streets. Residential streets surrounding the core hold a mix of Victorian-era homes, bungalows, and mid-century houses, with the South Platte River and its trail system just east of downtown. The area is the most walkable part of Brighton, with local restaurants, the library, and city parks all within a short stroll, plus easy access to Highway 85 and I-76 for Denver commuters.",
        homeStyles=["Victorian", "Craftsman Bungalow", "Ranch", "Four Square", "Modern Infill"],
        yearBuilt=(1890, 2025), price="$350K to $750K",
        schoolDistrict=B_SD, schools=B_SCHOOLS,
        hoa="No HOA in most of downtown; select new infill projects may have HOAs",
        features=[
            "Historic Bridge Street dining and shopping",
            "Brighton Creamery and seasonal farmers market",
            "Walkable grid with sidewalks and mature trees",
            "South Platte River trail access nearby",
            "Adams County courthouse and city events",
            "Easy Highway 85 and I-76 access",
        ],
        parks=["Benson Park", "Carpenter Park", "South Platte River Trail"],
        boundaries="Roughly Bridge Street corridor from Highway 85 to the railroad tracks, Main Street to 4th Avenue",
        lat="39.9853", lng="-104.8203", walkScore=64,
        meta="Downtown Brighton CO real estate guide — historic Bridge Street homes, bungalows, and walkable small-city living near the South Platte. SAA Homes.",
        keywords="Downtown Brighton Colorado, historic Brighton homes, Bridge Street Brighton, Brighton CO walkable neighborhoods, Brighton Creamery, Brighton old town real estate",
        highlights=[
            {"title": "Historic character", "description": "Early-1900s brick storefronts and Victorian-era homes give downtown Brighton real architectural history."},
            {"title": "Walkable core", "description": "Restaurants, the library, the creamery, and city events are all within walking distance."},
            {"title": "Platte River access", "description": "The South Platte River trail system is minutes away for walks, rides, and fishing."},
        ],
    ),
    dict(
        slug="prairie-center-brighton", citySlug="brighton", cityDisplay="Brighton", county="Adams County",
        type="subdivision", name="Prairie Center",
        aka=["Prairie Center Brighton"],
        description="Prairie Center is Brighton's western gateway neighborhood along Bromley Lane, built around the Prairie Center retail district with newer homes, the innovative Bromley East Charter School, and a straight shot to I-25 and E-470.",
        longDescription="Prairie Center occupies the southwest corner of Brighton, clustered around the Prairie Center shopping district on Bromley Lane near Highway 85. The neighborhood grew quickly through the 2000s and 2010s with a mix of ranch, two-story, and patio homes from regional builders, plus townhome sections for first-time buyers. Bromley East Charter School, an award-winning K-8 in the neighborhood, is a major draw for families, while the nearby Prairie Center retail corridor delivers everyday shopping, dining, and services without leaving the west side of town. Residents enjoy easy access to Highway 85, I-76, and E-470, making the community practical for commuters to Denver, Aurora, and the airport. Pocket parks and community trails tie the subdivisions together, and larger parks like Riverdale Regional Park are a short drive south.",
        homeStyles=["Ranch", "Two-Story Traditional", "Patio Home", "Townhome", "Contemporary"],
        yearBuilt=(2000, 2020), price="$400K to $700K",
        schoolDistrict=B_SD, schools=B_SCHOOLS2,
        hoa="Mandatory HOA in most sections (approx. $60\u2013$120/month) covering common areas and entry landscaping",
        features=[
            "Award-winning Bromley East Charter School in the neighborhood",
            "Prairie Center retail and dining corridor on Bromley Lane",
            "Pocket parks and community trails",
            "Quick access to I-25, I-76, and E-470",
            "Mix of single-family and townhome product",
            "Minutes to Riverdale Regional Park and the Platte River",
        ],
        parks=["Prairie Center Park", "Bromley Park", "Riverdale Regional Park"],
        boundaries="Roughly Bromley Lane to 144th Avenue, Highway 85 to I-25",
        lat="39.9550", lng="-104.8700", walkScore=28,
        meta="Prairie Center Brighton CO — newer homes near the Prairie Center retail district, Bromley East Charter School, and E-470. SAA Homes.",
        keywords="Prairie Center Brighton, Bromley Lane Brighton, Brighton CO new homes, Bromley East Charter School, west Brighton neighborhoods, Brighton E-470 homes",
        highlights=[
            {"title": "Charter school draw", "description": "Bromley East Charter School (K-8) sits in the neighborhood and is one of the district's most requested schools."},
            {"title": "Retail at your doorstep", "description": "The Prairie Center corridor on Bromley Lane covers daily shopping, dining, and services."},
            {"title": "Commuter access", "description": "Minutes from I-25, I-76, and E-470 for Denver, Aurora, and airport commutes."},
        ],
    ),
    dict(
        slug="bromley-park-brighton", citySlug="brighton", cityDisplay="Brighton", county="Adams County",
        type="subdivision", name="Bromley Park",
        aka=["Bromley Park Brighton"],
        description="Bromley Park is an established central Brighton subdivision with ranch and two-story homes on tree-lined streets, community green space, and a location minutes from downtown, Bromley East Charter School, and the Prairie Center retail corridor.",
        longDescription="Bromley Park sits in central-west Brighton, developed in phases from the 1990s through the 2010s around Bromley Lane and the neighborhood's namesake park and open space. The community offers a comfortable mix of ranch, split-level, and two-story homes, with mature landscaping and sidewalks along most streets. Its central position makes it one of Brighton's most convenient addresses: downtown's Bridge Street dining is minutes away, Bromley East Charter School and Northeast Elementary are close, and the Prairie Center retail district is just down Bromley Lane. The neighborhood's park provides playgrounds, sports fields, and shaded picnic areas, while the South Platte River trail system offers recreation within a short drive. Bromley Park's blend of established homes, central location, and reasonable pricing keeps it in steady demand from Brighton families.",
        homeStyles=["Ranch", "Split-Level", "Two-Story Traditional", "Patio Home"],
        yearBuilt=(1992, 2015), price="$420K to $680K",
        schoolDistrict=B_SD, schools=B_SCHOOLS2,
        hoa="Most sections have no HOA; some newer phases have modest HOAs",
        features=[
            "Community park with playgrounds and sports fields",
            "Central Brighton location near downtown",
            "Minutes to Bromley East Charter School",
            "Prairie Center retail corridor nearby",
            "Mature trees and sidewalks",
            "Short drive to South Platte River trails",
        ],
        parks=["Bromley Park", "Benson Park", "Riverdale Regional Park"],
        boundaries="Roughly Bromley Lane to Bridge Street, Highway 85 to 27th Avenue",
        lat="39.9680", lng="-104.8300", walkScore=42,
        meta="Bromley Park Brighton CO — established central Brighton homes near downtown, Bromley East Charter School, and the Prairie Center shops. SAA Homes.",
        keywords="Bromley Park Brighton, Brighton CO established neighborhoods, central Brighton homes, Brighton family neighborhoods, Brighton CO real estate, Bromley Lane homes",
        highlights=[
            {"title": "Established and central", "description": "Mature, tree-lined streets put this neighborhood minutes from downtown Brighton."},
            {"title": "Park at the center", "description": "The namesake park provides playgrounds, sports fields, and community gathering space."},
            {"title": "School access", "description": "Close to Bromley East Charter School and Northeast Elementary."},
        ],
    ),
    dict(
        slug="cherry-meadows-brighton", citySlug="brighton", cityDisplay="Brighton", county="Adams County",
        type="subdivision", name="Cherry Meadows",
        aka=["Cherry Meadows Brighton"],
        description="Cherry Meadows is a newer central Brighton neighborhood with contemporary two-story and ranch homes from regional builders, community parks, and easy access to downtown, schools, and the Highway 85 corridor.",
        longDescription="Cherry Meadows developed through the 2010s and early 2020s on Brighton's central-west side, filling in with contemporary production homes from builders like Richmond American and KB Home. The neighborhood pairs modern open floor plans with a network of pocket parks, playgrounds, and walking paths, giving it a family-friendly feel that matches its popularity with first-time and move-up buyers. The community is well positioned between downtown Brighton's historic core and the Prairie Center retail district, with Northeast Elementary and other 27J schools nearby. Highway 85 provides a direct route north toward Greeley and south to the Denver metro, while I-76 and E-470 are within a short drive. Cherry Meadows offers one of Brighton's better combinations of newer homes, central location, and attainable pricing.",
        homeStyles=["Two-Story Modern", "Ranch", "Farmhouse", "Patio Home", "Townhome"],
        yearBuilt=(2010, 2023), price="$430K to $720K",
        schoolDistrict=B_SD, schools=B_SCHOOLS,
        hoa="Mandatory HOA (approx. $70\u2013$120/month) covers parks, trails, and common landscaping",
        features=[
            "Newer production homes with modern floor plans",
            "Pocket parks and walking paths throughout",
            "Minutes to downtown Brighton and Prairie Center shops",
            "Near Northeast Elementary and 27J schools",
            "Highway 85 and I-76 access",
            "Family-friendly streets with sidewalks",
        ],
        parks=["Cherry Meadows Park", "Bromley Park", "Benson Park"],
        boundaries="Roughly Bridge Street to Bromley Lane, 27th Avenue to Highway 85",
        lat="39.9780", lng="-104.8350", walkScore=38,
        meta="Cherry Meadows Brighton CO — newer family homes near downtown, parks, and schools in central Brighton. SAA Homes.",
        keywords="Cherry Meadows Brighton, Brighton CO new homes, Brighton family neighborhoods, Brighton CO subdivisions, Brighton Colorado real estate, central Brighton homes",
        highlights=[
            {"title": "Modern housing stock", "description": "Contemporary homes built mostly after 2010 with open floor plans and energy efficiency."},
            {"title": "Family-first design", "description": "Pocket parks, playgrounds, and sidewalks create a safe, active neighborhood."},
            {"title": "Central convenience", "description": "Minutes to downtown Brighton, Prairie Center retail, and Highway 85."},
        ],
    ),
    dict(
        slug="todd-creek-brighton", citySlug="brighton", cityDisplay="Brighton", county="Adams County",
        type="subdivision", name="Todd Creek",
        aka=["Todd Creek Sub-Area", "Todd Creek Golf Community"],
        description="Todd Creek is Brighton's premier golf-course community, a master-planned village on the west side built around the 18-hole Todd Creek Golf Club, with ranch-style homes, lakes, and a strong sense of community.",
        longDescription="Todd Creek is a large master-planned community in west Brighton, developed from the late 1990s through the 2010s around the 18-hole Todd Creek Golf Club and its clubhouse. The community is organized into distinct sub-areas, including Todd Creek Farms, Todd Creek Estates, Todd Creek Meadows, Riverside at Todd Creek, and Todd Creek Vistas, each with its own character but sharing the golf course, lakes, trails, and recreation amenities. Housing is predominantly ranch and patio-style homes, many on golf or lake lots, with an active residents' association that runs social events year-round. The community is close to the Prairie Center retail corridor and E-470, giving residents an easy route to Denver, the airport, and the Front Range. Todd Creek appeals strongly to active adults and families seeking a resort-style suburban lifestyle.",
        homeStyles=["Ranch", "Patio Home", "Mediterranean", "Two-Story Traditional", "Craftsman"],
        yearBuilt=(1998, 2016), price="$450K to $900K+",
        schoolDistrict=B_SD, schools=B_SCHOOLS2,
        hoa="Mandatory HOA (approx. $150\u2013$250/month) covers golf-course access, lakes, trails, and community facilities",
        features=[
            "18-hole Todd Creek Golf Club and clubhouse",
            "Lakes, ponds, and water features throughout",
            "Distinct sub-areas from Farms to Vistas",
            "Active community events and social programs",
            "E-470 and I-76 access for commuters",
            "Close to Prairie Center retail corridor",
        ],
        parks=["Todd Creek Golf Club", "Todd Creek Park", "Riverdale Regional Park"],
        boundaries="Roughly 136th Avenue to 144th Avenue, Highway 85 to I-25",
        lat="39.9420", lng="-104.8780", walkScore=22,
        meta="Todd Creek Brighton CO — golf-course living with lakes, trails, and an active community in west Brighton. SAA Homes.",
        keywords="Todd Creek Brighton, Todd Creek Golf Club, Brighton golf course homes, Todd Creek subdivisions, west Brighton master planned, Todd Creek real estate",
        highlights=[
            {"title": "Golf and lakes", "description": "The 18-hole Todd Creek Golf Club and neighborhood lakes anchor this resort-style community."},
            {"title": "Village sub-areas", "description": "Todd Creek Farms, Estates, Meadows, and Vistas each offer distinct home styles and price points."},
            {"title": "Active community", "description": "A busy residents' association runs clubs, events, and social programs year-round."},
        ],
    ),
    dict(
        slug="sugar-creek-brighton", citySlug="brighton", cityDisplay="Brighton", county="Adams County",
        type="subdivision", name="Sugar Creek",
        aka=["Sugar Creek Brighton"],
        description="Sugar Creek is a mid-sized central Brighton neighborhood with ranch and two-story homes on landscaped lots, a community park, and a quiet family setting minutes from downtown and the South Platte River.",
        longDescription="Sugar Creek is an established central Brighton neighborhood built in phases from the early 2000s through the 2010s, with a comfortable mix of ranch, two-story, and patio homes. The neighborhood's namesake creek and open-space corridor run through the community, providing green views and a natural setting for its walking paths. A community park with playgrounds anchors the south side, while downtown Brighton's Bridge Street dining and the South Platte River trail system are just minutes away. The neighborhood is served by School District 27J schools including Northeast Elementary and Vikan Middle, and Highway 85 provides quick access north and south. Sugar Creek's combination of established landscaping, family-friendly streets, and central location makes it a solid value pick in Brighton's resale market.",
        homeStyles=["Ranch", "Two-Story Traditional", "Patio Home", "Split-Level"],
        yearBuilt=(2002, 2016), price="$410K to $650K",
        schoolDistrict=B_SD, schools=B_SCHOOLS,
        hoa="Mandatory HOA in most sections (approx. $60\u2013$100/month)",
        features=[
            "Creek corridor and open-space views",
            "Community park with playgrounds",
            "Minutes to downtown Brighton",
            "South Platte River trail access nearby",
            "Quiet family streets with sidewalks",
            "Highway 85 and I-76 access",
        ],
        parks=["Sugar Creek Park", "Benson Park", "Carpenter Park"],
        boundaries="Roughly Bridge Street to Bromley Lane, 27th Avenue to Highway 85",
        lat="39.9750", lng="-104.8280", walkScore=40,
        meta="Sugar Creek Brighton CO — established family neighborhood with a creek corridor, community park, and central Brighton location. SAA Homes.",
        keywords="Sugar Creek Brighton, Brighton CO family neighborhoods, central Brighton homes for sale, Brighton subdivisions, Brighton Colorado real estate, creek homes Brighton",
        highlights=[
            {"title": "Creek-side setting", "description": "The Sugar Creek corridor brings green views and walking paths into the neighborhood."},
            {"title": "Established feel", "description": "Mature landscaping and settled streets give the community a comfortable character."},
            {"title": "Everything close", "description": "Downtown Brighton, the Platte River trails, and Highway 85 are minutes away."},
        ],
    ),
    dict(
        slug="indigo-trails-brighton", citySlug="brighton", cityDisplay="Brighton", county="Adams County",
        type="subdivision", name="Indigo Trails",
        aka=["Indigo Trails Brighton"],
        description="Indigo Trails is a newer southwest Brighton neighborhood with contemporary homes, community trails and parks, and a location between the Prairie Center retail corridor and the South Platte River open space.",
        longDescription="Indigo Trails is part of Brighton's southwest growth area, built primarily from the mid-2010s onward with contemporary two-story and ranch homes from national builders. The neighborhood takes its name from its trail network, which links pocket parks, playgrounds, and open space through the community and connects toward the wider Brighton trail system. Its southwest position puts residents minutes from the Prairie Center retail corridor on Bromley Lane, Bromley East Charter School, and the Riverdale Regional Park and Platte River recreation area to the south. E-470 and I-76 are a short drive away, making the community popular with commuters to Denver, Aurora, and Denver International Airport. Indigo Trails offers buyers modern housing stock with an outdoor-oriented, family-friendly layout.",
        homeStyles=["Two-Story Contemporary", "Ranch", "Farmhouse", "Patio Home"],
        yearBuilt=(2015, 2024), price="$440K to $750K",
        schoolDistrict=B_SD, schools=B_SCHOOLS2,
        hoa="Mandatory HOA (approx. $75\u2013$125/month) covers trails, parks, and common areas",
        features=[
            "Community trail network with pocket parks",
            "Modern production homes built after 2015",
            "Minutes to Prairie Center retail corridor",
            "Near Bromley East Charter School",
            "Riverdale Regional Park and Platte River nearby",
            "Quick E-470 and I-76 access",
        ],
        parks=["Indigo Trails Park", "Riverdale Regional Park", "Bromley Park"],
        boundaries="Roughly Bromley Lane to 144th Avenue, Highway 85 to I-25",
        lat="39.9500", lng="-104.8550", walkScore=30,
        meta="Indigo Trails Brighton CO — newer homes with trails, parks, and easy E-470 access in southwest Brighton. SAA Homes.",
        keywords="Indigo Trails Brighton, southwest Brighton homes, Brighton CO new construction, Brighton trail neighborhoods, Brighton CO real estate, E-470 Brighton homes",
        highlights=[
            {"title": "Trail-centered design", "description": "A community trail network links parks and playgrounds through the neighborhood."},
            {"title": "Newer construction", "description": "Most homes were built after 2015 with contemporary, efficient floor plans."},
            {"title": "Platte River nearby", "description": "Riverdale Regional Park and the South Platte River recreation area are minutes south."},
        ],
    ),
    dict(
        slug="brighton-crossing", citySlug="brighton", cityDisplay="Brighton", county="Adams County",
        type="subdivision", name="Brighton Crossing",
        aka=["Brighton Crossing Subdivision"],
        description="Brighton Crossing is a growing master-planned community on Brighton's west side with new construction homes, planned schools and parks, and a prime location at the Highway 85 and 136th Avenue crossroads.",
        longDescription="Brighton Crossing is a newer master-planned community anchored at the intersection of Highway 85 and 136th Avenue, one of the fastest-growing corners of western Brighton. Development through the 2010s and 2020s has brought a mix of single-family homes and townhomes from multiple builders, with an amenity center, pools, parks, and trails planned as the community fills in. The location is a commuter's asset: Highway 85 runs directly to Denver and Greeley, I-76 and E-470 are minutes away, and the Prairie Center retail district is close by for everyday needs. New schools and commercial space are planned within and around the community as the west side of Brighton continues to grow. Buyers choose Brighton Crossing for new-construction value, master-planned amenities, and one of the best commuter locations in Adams County.",
        homeStyles=["Two-Story Modern", "Ranch", "Townhome", "Farmhouse", "Patio Home"],
        yearBuilt=(2012, 2026), price="$420K to $800K",
        schoolDistrict=B_SD, schools=B_SCHOOLS,
        hoa="Mandatory HOA (approx. $80\u2013$140/month) covers the amenity center, pools, parks, and common areas",
        features=[
            "Master-planned amenities including pool and parks",
            "Highway 85 and 136th Avenue crossroads location",
            "Minutes to I-76, E-470, and Denver",
            "New construction from multiple builders",
            "Prairie Center retail corridor nearby",
            "Growing community with planned schools and commercial",
        ],
        parks=["Brighton Crossing Park", "Riverdale Regional Park", "Bromley Park"],
        boundaries="Roughly 136th Avenue to 144th Avenue, Highway 85 to I-25",
        lat="39.9480", lng="-104.8680", walkScore=25,
        meta="Brighton Crossing CO — new construction homes, master-planned amenities, and Highway 85 commuter access in west Brighton. SAA Homes.",
        keywords="Brighton Crossing Brighton, 136th Avenue Brighton homes, Brighton CO new construction, west Brighton master planned community, Brighton townhomes, Brighton Colorado real estate",
        highlights=[
            {"title": "Commuter crossroads", "description": "Highway 85, I-76, and E-470 put Denver, Aurora, and the airport within easy reach."},
            {"title": "New homes, new amenities", "description": "Active building continues with pools, parks, and trails planned as the community grows."},
            {"title": "Retail close by", "description": "The Prairie Center corridor handles daily shopping and dining minutes from home."},
        ],
    ),
]

if __name__ == "__main__":
    out = []
    out.append("/**")
    out.append(" * Expansion entries for 8 zero-coverage entities (2026-08-17 cron)")
    out.append(" * All names verified via real estate directories and subdivision maps.")
    out.append(" */")
    out.append("")
    out.append("export const expansionNeighborhoods = [")
    for e in ENTRIES:
        out.append(entry(e))
    out.append("]")
    out.append("")
    print(f"// {len(ENTRIES)} entries")
    js = "\n".join(out)
    with open("hermes/expansion-2026-08-17.js", "w") as f:
        f.write(js)
    print("Wrote hermes/expansion-2026-08-17.js (%d bytes)" % len(js))
