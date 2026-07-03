#!/usr/bin/env python3
"""Add neighborhoods to underserved cities. JS-safe strings."""
import re

FILE = "/opt/data/workspace/saahomes-repo/src/data/neighborhoods.js"

with open(FILE) as f:
    content = f.read()

def js(s):
    s = str(s)
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"

def e(slug, city, county, t, name, desc, styles, ymin, ymax, price, dist, schools, hoa, features, parks, bounds, lat, lng, meta, kw, highlights):
    sq = lambda a: "[" + ", ".join(js(x) for x in a) + "]"
    sl = "[\n" + "\n".join(f"      {{ name: {js(s['name'])}, type: {js(s['type'])}, level: {js(s['level'])}, rating: {js(str(s.get('rating',''))) if s.get('rating') else 'null'} }},"
        for s in schools) + "\n    ]"
    hl = "[\n" + "\n".join(f"      {{ title: {js(h['title'])}, description: {js(h['description'])} }},"
        for h in highlights) + "\n    ]"
    return f"""  {{
    slug: {js(slug)},
    citySlug: {js(city)},
    cityDisplay: {js(city.replace('-', ' ').title())},
    county: {js(county)},
    type: {js(t)},
    name: {js(name)},
    description: {js(desc)},
    homeStyles: {sq(styles)},
    yearBuiltRange: {{ min: {ymin}, max: {ymax} }},
    priceRangeDescription: {js(price)},
    schoolDistrict: {js(dist)},
    schools: {sl},
    hoaDescription: {js(hoa)},
    features: {sq(features)},
    parks: {sq(parks)},
    boundaries: {js(bounds)},
    coordinates: {{ latitude: {js(str(lat))}, longitude: {js(str(lng))} }},
    metaDescription: {js(meta)},
    keywords: {js(kw)},
    neighborhoodHighlights: {hl},
  }},"""

N = []
N.append(e("north-loveland","loveland","Larimer County","neighborhood","North Loveland",
    "North Loveland features established neighborhoods north of US 34 with mature trees, mid-century homes, and newer infill. Close to Lake Loveland and Lincoln Avenue shopping.",
    ["Ranch","Split-Level","Bungalow","Contemporary","Townhome"],1950,2025,"$325K to $600K","Thompson School District",
    [{"name":"Garfield Elementary","type":"elementary","level":"K-5","rating":7},{"name":"Bill Reed Middle School","type":"middle","level":"6-8","rating":7},{"name":"Loveland High School","type":"high","level":"9-12","rating":7}],
    "Most areas have no HOA; select new developments may have HOAs",
    ["Close to Lake Loveland","Established with mature trees","Lincoln Avenue shopping","Mix of home styles","Easy I-25 access","Loveland Recreation Trail"],
    ["North Lake Park","Lake Loveland","Fairgrounds Park"],
    "US 34 to 29th Street, Taft Ave to Madison Ave",40.4150,-105.0500,
    "North Loveland real estate - established homes near Lake Loveland. SAA Homes.",
    "North Loveland homes, north Loveland real estate, Lincoln Avenue Loveland, Lake Loveland area",
    [{"title":"Established character","description":"Mature trees and mid-century architecture give north Loveland a settled, welcoming feel."},{"title":"Lake access","description":"Minutes from Lake Loveland and North Lake Park."},{"title":"Shopping corridor","description":"Lincoln Avenue features grocery, dining, and retail - all within minutes."}]))

N.append(e("south-loveland","loveland","Larimer County","neighborhood","South Loveland",
    "South Loveland is a growing area from Highway 34 south to the county line. Newer subdivisions and established neighborhoods with excellent I-25/US 34 access for commuters.",
    ["Contemporary","Ranch","Two-Story","Patio Home","Townhome"],1980,2025,"$350K to $650K","Thompson School District",
    [{"name":"Lincoln Elementary","type":"elementary","level":"K-5","rating":7},{"name":"Bill Reed Middle School","type":"middle","level":"6-8","rating":7},{"name":"Loveland High School","type":"high","level":"9-12","rating":7}],
    "Most subdivisions have HOAs ($50-$200/month)",
    ["Close to I-25/US 34 interchange","Mix of established and new construction","Pond and mountain views","Close to The Ranch","Growing retail corridor","Loveland Recreation Trail"],
    ["South Loveland Community Park","Fairgrounds Park","Loveland Recreation Trail"],
    "US 34 to Larimer CR 12E, I-25 to Madison Ave",40.3800,-105.0300,
    "South Loveland real estate - convenient I-25 access near The Ranch. SAA Homes.",
    "South Loveland homes, south Loveland real estate, I-25 Loveland, The Ranch Loveland",
    [{"title":"Commuter hub","description":"Seconds from the I-25/US 34 interchange - best commute location in Northern Colorado."},{"title":"The Ranch","description":"Close to The Ranch events complex for concerts, rodeos, and trade shows."},{"title":"Growth corridor","description":"South Loveland has new retail and dining arriving regularly."}]))

N.append(e("west-loveland","loveland","Larimer County","neighborhood","West Loveland / Foothills",
    "West Loveland offers larger lots, mountain views, and Devils Backbone open space. Quieter residential atmosphere with quick access to hiking and outdoor recreation.",
    ["Ranch","Custom Home","Mountain Contemporary","Equestrian Property"],1960,2025,"$400K to $1M+","Thompson School District",
    [{"name":"Lincoln Elementary","type":"elementary","level":"K-5","rating":7},{"name":"Bill Reed Middle School","type":"middle","level":"6-8","rating":7},{"name":"Loveland High School","type":"high","level":"9-12","rating":7}],
    "Many areas have no HOA; some subdivisions have HOAs",
    ["Foothills with mountain views","Devils Backbone Open Space","Larger lot options","Quiet, less dense","Outdoor recreation at doorstep","Close to downtown Loveland"],
    ["Devils Backbone Open Space","Horsetooth Mountain Open Space","Loveland Recreation Trail"],
    "Wilson Ave to Larimer CR 27, US 34 to 43rd St",40.3950,-105.1000,
    "West Loveland foothills real estate - larger lots, mountain views, Devils Backbone. SAA Homes.",
    "West Loveland homes, Loveland foothills real estate, Devils Backbone area",
    [{"title":"Foothills lifestyle","description":"Devils Backbone Open Space with hiking trails and iconic rock formations is minutes away."},{"title":"Larger properties","description":"Find acreage, custom homes, and equestrian properties with mountain views."},{"title":"Quiet setting","description":"Peace and privacy while still 10 minutes from downtown Loveland."}]))
# ── Extra Windsor ──
N.append(e("windsor-highlands","windsor","Weld County","subdivision","Windsor Highlands",
    "Windsor Highlands is an established area with well-maintained homes and mountain views in northwest Windsor. Convenient access to Fort Collins and I-25.",
    ["Ranch","Two-Story Traditional","Split-Level","Patio Home"],1995,2015,"$375K to $550K","Windsor School District RE-4",
    [{"name":"Tozer Elementary","type":"elementary","level":"K-5","rating":7},{"name":"Windsor Middle School","type":"middle","level":"6-8","rating":7},{"name":"Windsor High School","type":"high","level":"9-12","rating":8}],
    "Mandatory HOA ($75-$150/month)",
    ["Established neighborhood","Mountain views","Close to Fort Collins","Family-friendly","Community park","Value pricing"],
    ["Windsor Highlands Park","Windsor Community Park","Boardwalk Park"],
    "Weld CR 13 to 15, Main St to Crossroads Blvd",40.4850,-104.9250,
    "Windsor Highlands real estate - established homes with mountain views near Fort Collins. SAA Homes.",
    "Windsor Highlands, established Windsor neighborhoods, mountain view homes Windsor",
    [{"title":"Established setting","description":"Well-maintained homes with mature landscaping and settled community feel."},{"title":"Fort Collins access","description":"Located on Windsor northwest side - 10 minutes to Fort Collins."},{"title":"Great value","description":"One of Windsor most affordable single-family home neighborhoods."}]))

N.append(e("mountain-view-windsor","windsor","Weld County","subdivision","Mountain View Estates",
    "Desirable Windsor neighborhood with larger lots and panoramic mountain views. Custom homes, mature landscaping, and peaceful semi-rural feel minutes from downtown.",
    ["Custom Ranch","Contemporary","Rancher","Patio Home"],2000,2025,"$500K to $850K","Windsor School District RE-4",
    [{"name":"Skyview Elementary","type":"elementary","level":"K-5","rating":8},{"name":"Windsor Middle School","type":"middle","level":"6-8","rating":7},{"name":"Windsor High School","type":"high","level":"9-12","rating":8}],
    "Mandatory HOA ($100-$200/month)",
    ["Panoramic mountain views","Large lots - many 0.5+ acres","Custom-built homes","Quiet rural feel","Close to Windsor Lake","Minutes to downtown"],
    ["Windsor Lake","Boardwalk Park","Eastman Park"],
    "Weld CR 13 to 15, Crossroads to Main St",40.4750,-104.9400,
    "Mountain View Estates Windsor - custom homes with mountain views on large lots. SAA Homes.",
    "Mountain View Estates Windsor, west Windsor custom homes, large lot homes Windsor",
    [{"title":"Mountain views","description":"Panoramic Front Range views from elevated lots."},{"title":"Custom homes","description":"Larger custom-built homes on generous lots with premium finishes."},{"title":"West Windsor","description":"Close to Fort Collins, Windsor Lake, and Main Street in a quiet semi-rural setting."}]))
# ── Extra Greeley ──
N.append(e("poudre-river-ranch","greeley","Weld County","subdivision","Poudre River Ranch",
    "Master-planned west Greeley community with newer construction homes and Poudre River Trail access. Modern floor plans, community parks, and growing retail corridor.",
    ["Contemporary","Farmhouse Modern","Ranch","Patio Home","Townhome"],2015,2025,"$325K to $550K","Greeley-Evans School District 6",
    [{"name":"West Ridge Elementary","type":"elementary","level":"K-5","rating":8},{"name":"Heath Middle School","type":"middle","level":"6-8","rating":7},{"name":"University Schools (K-12)","type":"charter","level":"K-12","rating":9}],
    "Mandatory HOA ($100-$200/month)",
    ["New construction homes","Poudre River Trail access","Modern open floor plans","Community parks","West Greeley growth corridor","Close to shopping"],
    ["Poudre River Trail","Sanborn Park","Bittersweet Park"],
    "59th Ave to 65th Ave, US 34 to O St",40.4250,-104.7850,
    "Poudre River Ranch Greeley - new construction with trail access. SAA Homes.",
    "Poudre River Ranch Greeley, west Greeley new homes, Poudre River Trail homes",
    [{"title":"New construction","description":"Modern open concept floor plans with energy-efficient features."},{"title":"Trail access","description":"Direct access to the Poudre River Trail - miles of paved pathways."},{"title":"West Greeley growth","description":"Located in Greeley fastest-growing corridor."}]))
# ── First entries for new cities ──
N.append(e("downtown-longmont","longmont","Boulder County","neighborhood","Downtown Longmont",
    "Downtown Longmont is the historic heart of the city, featuring boutique shops, farm-to-table dining, and a vibrant Main Street. Tree-lined streets with early-1900s homes and newer lofts.",
    ["Victorian","Queen Anne","Bungalow","Craftsman","Contemporary Loft"],1900,2025,"$400K to $900K","St. Vrain Valley School District",
    [{"name":"Central Elementary","type":"elementary","level":"K-5","rating":8},{"name":"Westview Middle School","type":"middle","level":"6-8","rating":7},{"name":"Longmont High School","type":"high","level":"9-12","rating":8}],
    "Most areas have no HOA; newer developments may have HOAs",
    ["Historic Main Street with shops and dining","Farmers Market year-round","Walkable downtown district","Close to McIntosh Lake","Longmont Museum nearby","Boulder commuter rail access"],
    ["Roosevelt Park","McIntosh Lake","Longmont Recreation Trail"],
    "3rd Ave to 9th Ave, Coffman St to Sunset St",40.1650,-105.1000,
    "Downtown Longmont real estate - historic homes and lofts near Main Street. SAA Homes.",
    "Downtown Longmont, historic Longmont homes, Main Street Longmont real estate, Longmont Colorado downtown",
    [{"title":"Historic Main Street","description":"Boutique shopping, farm-to-table dining, craft breweries, and year-round events on Main Street."},{"title":"Walkable lifestyle","description":"Walk to coffee shops, restaurants, parks, and the farmers market from anywhere downtown."},{"title":"Commuter access","description":"Minutes to the Boulder commuter rail station for an easy trip to Denver or Boulder."}]))

N.append(e("evans-commons","evans","Weld County","neighborhood","Evans Commons",
    "Evans is a growing community between Greeley and Johnstown. Affordable housing options with newer subdivisions alongside established homes. Convenient US 34 access.",
    ["Contemporary","Ranch","Two-Story","Patio Home","Townhome"],1990,2025,"$300K to $500K","Greeley-Evans School District 6",
    [{"name":"Rangeview Elementary","type":"elementary","level":"K-5","rating":6},{"name":"Franklin Middle School","type":"middle","level":"6-8","rating":6},{"name":"Greeley Central High School","type":"high","level":"9-12","rating":6}],
    "Most subdivisions have HOAs ($50-$150/month)",
    ["Affordable housing options","Newer subdivisions available","US 34 access for commuting","Close to Greeley amenities","Growing community","Poudre River access"],
    ["Evans Community Park","Poudre River Trail","Riverside Park"],
    "US 34 to 37th St, 23rd Ave to 31st Ave",40.3760,-104.7100,
    "Evans Colorado real estate - affordable homes near Greeley with US 34 access. SAA Homes.",
    "Evans CO real estate, Evans Colorado homes, affordable Northern Colorado homes",
    [{"title":"Affordable entry","description":"One of the most affordable markets in Northern Colorado - great for first-time buyers."},{"title":"Greeley proximity","description":"Minutes from Greeley shopping, dining, and employment centers."},{"title":"Convenient location","description":"US 34 provides easy access to Greeley, Loveland, and I-25."}]))
# ── Firestone, Frederick, Boulder ──
N.append(e("firestone-commons","firestone","Weld County","neighborhood","Firestone Commons",
    "Firestone is one of Northern Colorado fastest-growing communities along I-25. Newer subdivisions, family parks, and convenient commuting to Longmont, Boulder, and Denver.",
    ["Contemporary","Ranch","Two-Story","Patio Home","Townhome"],2000,2025,"$400K to $650K","St. Vrain Valley School District",
    [{"name":"Meadow Elementary","type":"elementary","level":"K-5","rating":7},{"name":"Coal Ridge Middle School","type":"middle","level":"6-8","rating":7},{"name":"Frederick High School","type":"high","level":"9-12","rating":7}],
    "Most subdivisions have HOAs ($50-$200/month)",
    ["Newer subdivisions","I-25 access for commuting","Family-friendly parks","Growing retail and dining","Mineral Road corridor","Community events"],
    ["Firestone Community Park","St. Vrain State Park","Coal Ridge Park"],
    "I-25 to Weld CR 17, Mineral Road to Highway 119",40.1450,-104.9400,
    "Firestone Colorado real estate - growing I-25 community with new homes. SAA Homes.",
    "Firestone CO homes, Firestone Colorado real estate, Firestone subdivisions",
    [{"title":"Growing community","description":"Rapid growth with new subdivisions, retail, and dining arriving regularly."},{"title":"I-25 access","description":"Located directly off I-25 - 20 minutes to Boulder, 40 minutes to Denver."},{"title":"Family-friendly","description":"Community parks, recreation center, and year-round events for families."}]))
N.append(e("frederick-crossing","frederick","Weld County","neighborhood","Frederick Crossing",
    "Frederick is a growing I-25 corridor community with newer subdivisions, mountain views, and small-town charm. Close to Longmont and Boulder with excellent commuting access.",
    ["Contemporary","Ranch","Two-Story","Patio Home","Townhome"],2000,2025,"$400K to $650K","St. Vrain Valley School District",
    [{"name":"Meadow Elementary","type":"elementary","level":"K-5","rating":7},{"name":"Coal Ridge Middle School","type":"middle","level":"6-8","rating":7},{"name":"Frederick High School","type":"high","level":"9-12","rating":7}],
    "Most subdivisions have HOAs ($50-$200/month)",
    ["Newer homes and subdivisions","I-25 access","Mountain views","Close to Longmont and Boulder","Growing retail corridor","Community parks"],
    ["Frederick Community Park","St. Vrain State Park","Coal Ridge Park"],
    "I-25 to Weld CR 17, Highway 52 to Highway 119",40.1000,-104.9400,
    "Frederick Colorado real estate - growing I-25 community near Longmont. SAA Homes.",
    "Frederick CO homes, Frederick Colorado real estate, I-25 corridor homes",
    [{"title":"Commuter hub","description":"Located on I-25 between Longmont and Firestone - 20 min to Boulder, 40 min to Denver."},{"title":"Mountain views","description":"Many neighborhoods offer stunning Front Range and mountain views."},{"title":"Newer homes","description":"Most homes built after 2000 with modern floor plans."}]))
N.append(e("downtown-boulder","boulder","Boulder County","neighborhood","Downtown Boulder",
    "Downtown Boulder is the vibrant cultural and commercial heart of the city, set against the iconic Flatirons backdrop. Pearl Street Mall, world-class dining, and historic architecture define this premier walkable neighborhood.",
    ["Victorian","Queen Anne","Craftsman","Contemporary","Condo"],1880,2025,"$700K to $3M+","Boulder Valley School District",
    [{"name":"Whittier Elementary","type":"elementary","level":"K-5","rating":9},{"name":"Casey Middle School","type":"middle","level":"6-8","rating":9},{"name":"Boulder High School","type":"high","level":"9-12","rating":10}],
    "Varies - older homes typically no HOA; newer condos have HOAs",
    ["Pearl Street Mall - pedestrian-only shopping and dining","Flatirons views from most streets","Walk Score 95+ - errands are walkable","CU Boulder campus nearby","Chautauqua Park and hiking trails","World-class dining and craft beer"],
    ["Pearl Street Mall","Chautauqua Park","CU Boulder Campus"],
    "Canyon Blvd to Iris Ave, 9th St to Foothills Parkway",40.0150,-105.2700,
    "Downtown Boulder real estate - Pearl Street Mall, Flatirons views, historic homes. SAA Homes.",
    "Downtown Boulder, Pearl Street Mall homes, Boulder Colorado real estate, historic Boulder homes",
    [{"title":"Walk Score 99","description":"Boulder most walkable neighborhood - Pearl Street Mall, restaurants, shops, and parks are all steps away."},{"title":"Flatirons backdrop","description":"The iconic Flatirons rock formations tower over downtown, visible from almost every street."},{"title":"Pearl Street Mall","description":"Four pedestrian-only blocks of shops, dining, street performers, and fountains - the heart of Boulder."}]))
N.append(e("boulder-chautauqua","boulder","Boulder County","neighborhood","Chautauqua Park",
    "Chautauqua Park is Boulder most iconic neighborhood, nestled at the base of the Flatirons with direct access to world-class hiking trails. Historic cottages and craftsman homes surround the Chautauqua Dining Hall and Auditorium.",
    ["Craftsman","Bungalow","Tudor","Victorian","Mountain Contemporary"],1900,2025,"$1.2M to $4M+","Boulder Valley School District",
    [{"name":"Flatirons Elementary","type":"elementary","level":"K-5","rating":10},{"name":"Manhattan Middle School","type":"middle","level":"6-8","rating":9},{"name":"Boulder High School","type":"high","level":"9-12","rating":10}],
    "No HOA - historic district regulations apply",
    ["Chautauqua Park and trailhead from your doorstep","Flagship Flatirons trails - 1st and 2nd Flatiron","Chautauqua Dining Hall and Auditorium","National Historic Landmark status","Flatirons Elementary (10/10)","Mountain living with downtown access"],
    ["Chautauqua Park","Flatirons Trailhead","Royal Arch Trail"],
    "Baseline Rd to Alpine Ave, 9th St to Chautauqua Meadow",39.9980,-105.2800,
    "Chautauqua Park Boulder real estate - historic homes at the Flatirons base with direct trail access. SAA Homes.",
    "Chautauqua Park Boulder, Flatirons homes, Boulder historic homes, mountain view Boulder real estate",
    [{"title":"Flatirons doorstep","description":"Direct access to Boulder most famous hiking trails - the 1st and 2nd Flatiron trails start in the neighborhood."},{"title":"Historic landmark","description":"Chautauqua Park is a National Historic Landmark with preserved early-1900s cottages and the iconic Dining Hall."},{"title":"Top schools","description":"Flatirons Elementary (10/10) and Boulder High School (10/10) - the best school cluster in Boulder."}]))
N.append(e("niwot-village","niwot","Boulder County","neighborhood","Niwot Village",
    "Niwot is a charming historic town north of Boulder with a quaint downtown, art galleries, and a strong community feel. Tree-lined streets with early-1900s homes, newer subdivisions, and views of Longs Peak.",
    ["Historic","Contemporary","Ranch","Craftsman"],1900,2025,"$500K to $1.2M+","St. Vrain Valley School District",
    [{"name":"Niwot Elementary","type":"elementary","level":"K-5","rating":9},{"name":"Sunset Middle School","type":"middle","level":"6-8","rating":8},{"name":"Longmont High School","type":"high","level":"9-12","rating":8}],
    "Most areas have no HOA; select newer subdivisions may have HOAs",
    ["Historic downtown with local shops","Niwot Market and community events","Niwot Elementary (9/10)","Close to Boulder and Longmont","Longs Peak and mountain views","Twin Peaks Golf Course nearby"],
        ["Niwot Village Park","McCroskey Park","Twin Peaks Golf Course"],
        "Highway 119 to Oxford Rd, 79th St to 95th St",40.1000,-105.1700,
        "Niwot Colorado real estate - historic charm near Boulder with top-rated Niwot Elementary. SAA Homes.",
        "Niwot Colorado homes, Niwot real estate, historic Niwot downtown, Niwot Elementary",
        [{"title":"Historic charm","description":"Niwot quaint downtown with local shops, art galleries, and the annual Niwot Market celebration."},{"title":"Top-rated school","description":"Niwot Elementary (9/10) is one of the best schools in Boulder County."},{"title":"Boulder proximity","description":"Located between Boulder and Longmont - 10 minutes to either."}]))
N.append(e("mead-downtown","mead","Weld County","neighborhood","Mead Downtown",
    "Mead is a growing community between Longmont and Firestone with a welcoming small-town feel. Newer subdivisions, excellent schools, and stunning mountain views define this Weld County gem.",
    ["Contemporary","Ranch","Two-Story","Farmhouse"],2000,2025,"$450K to $700K","St. Vrain Valley School District",
    [{"name":"Mead Elementary","type":"elementary","level":"K-5","rating":8},{"name":"Coal Ridge Middle School","type":"middle","level":"6-8","rating":7},{"name":"Frederick High School","type":"high","level":"9-12","rating":7}],
    "Most subdivisions have HOAs ($50-$150/month)",
    ["Newer construction homes","Stunning mountain views","Growing community","Close to Longmont and Boulder","Mead Town Park","Peaceful small-town atmosphere"],
    ["Mead Town Park","Bison Ridge Park","St. Vrain State Park"],
        "Highway 66 to Highway 56, Weld CR 1 to CR 5",40.2320,-104.9980,
        "Mead Colorado real estate - growing community with mountain views near Longmont. SAA Homes.",
        "Mead CO real estate, Mead Colorado homes, Mead subdivisions",
        [{"title":"Mountain views","description":"Panoramic views of Longs Peak and the Front Range from many neighborhoods."},{"title":"Small-town feel","description":"Mead maintains its welcoming small-town atmosphere while experiencing steady growth."},{"title":"Commuter location","description":"Minutes from Longmont, 20 minutes from Boulder, 40 minutes from Denver."}]))
N.append(e("la-salle-residential","la-salle","Weld County","neighborhood","La Salle Residential",
    "La Salle is a quiet agricultural community south of Greeley offering affordable housing and small-town living. Convenient to Greeley shopping and employment with the South Platte River nearby.",
    ["Ranch","Contemporary","Two-Story","Mobile/Manufactured","Duplex"],1960,2025,"$250K to $400K","Greeley-Evans School District 6",
    [{"name":"Martinez Elementary","type":"elementary","level":"K-5","rating":6},{"name":"Franklin Middle School","type":"middle","level":"6-8","rating":6},{"name":"Greeley Central High School","type":"high","level":"9-12","rating":6}],
    "Most areas have no HOA",
    ["Affordable housing - lowest prices in the region","South Platte River access","Close to Greeley","Quiet rural setting","Growing community","Easy US 85 access"],
    ["La Salle Community Park","South Platte River","Greeley Recreation Center"],
    "US 85 to Weld CR 51, O St to 36th St",40.3350,-104.7000,
    "La Salle Colorado real estate - affordable homes near Greeley with small-town charm. SAA Homes.",
    "La Salle Colorado homes, La Salle CO real estate, affordable Northern Colorado homes",
    [{"title":"Most affordable","description":"One of the most affordable housing markets in Northern Colorado - ideal for first-time buyers."},{"title":"Greeley access","description":"Minutes from Greeley shopping, dining, and employment centers via US 85."},{"title":"Rural setting","description":"Quiet agricultural community with South Platte River access and wide-open views."}]))
N.append(e("eaton-commons","eaton","Weld County","neighborhood","Eaton Commons",
    "Eaton is a family-friendly town north of Greeley known for its top-rated schools, strong community values, and the Eaton Days celebration. Established homes and newer subdivisions line tree-shaded streets.",
    ["Ranch","Contemporary","Two-Story","Bungalow"],1970,2025,"$325K to $550K","Eaton School District RE-2",
    [{"name":"Eaton Elementary","type":"elementary","level":"K-5","rating":8},{"name":"Eaton Middle School","type":"middle","level":"6-8","rating":8},{"name":"Eaton High School","type":"high","level":"9-12","rating":9}],
    "Most areas have no HOA; select newer subdivisions have HOAs",
    ["Eaton High School (9/10) - one of Weld County best","Family-friendly community with strong values","Tree-lined streets","Eaton Days annual celebration","Affordable compared to Greeley","Close to Greeley amenities"],
    ["Eaton Community Park","Eaton Pool","Poudre River Trail"],
    "US 85 to Weld CR 47, 1st St to 10th St",40.5250,-104.7150,
    "Eaton Colorado real estate - top-rated Eaton schools and family-friendly community near Greeley. SAA Homes.",
    "Eaton Colorado homes, Eaton CO real estate, Eaton schools, Eaton Days celebration",
    [{"title":"Top schools","description":"Eaton School District is one of the highest-rated in Weld County - Eaton High School (9/10)."},{"title":"Family community","description":"Strong community values, the annual Eaton Days celebration, and safe tree-lined streets."},{"title":"Affordable","description":"Lower home prices than Greeley with access to all Greeley amenities just minutes away."}]))
N.append(e("milliken-park","milliken","Weld County","neighborhood","Milliken Park",
    "Milliken is a growing community along the South Platte River between Greeley and Johnstown. Affordable homes, new subdivisions, and a peaceful small-town atmosphere define this Weld County town.",
    ["Ranch","Contemporary","Two-Story","Townhome"],1990,2025,"$300K to $500K","Weld County School District 6",
    [{"name":"Milliken Elementary","type":"elementary","level":"K-5","rating":7},{"name":"Severance Middle School","type":"middle","level":"6-8","rating":7},{"name":"Windsor High School","type":"high","level":"9-12","rating":8}],
    "Most subdivisions have HOAs ($50-$150/month)",
    ["Affordable housing options","Newer subdivisions available","South Platte River access","Close to Greeley and Johnstown","Growing community","Family-friendly atmosphere"],
    ["Milliken Community Park","South Platte River","Weld County Recreation"],
    "US 85 to Weld CR 37, 1st St to Broad St",40.3280,-104.8570,
    "Milliken Colorado real estate - affordable homes between Greeley and Johnstown. SAA Homes.",
    "Milliken CO homes, Milliken Colorado real estate, affordable Weld County homes",
    [{"title":"Affordable","description":"One of the most affordable housing markets in Weld County."},{"title":"Central location","description":"Between Greeley and Johnstown - close to both communities' amenities."},{"title":"Growing town","description":"Milliken is experiencing steady growth with new subdivisions and community improvements."}]))
# ── Extra FC entry to hit 15 ──
N.append(e("waterglen-fc","fort-collins","Larimer County","subdivision","Waterglen",
    "Waterglen is a popular south Fort Collins subdivision with newer homes, community parks, and top-rated Fossil Ridge schools. Family-friendly neighborhoods near Harmony Road shopping.",
    ["Contemporary","Ranch","Two-Story Traditional","Patio Home"],1995,2015,"$425K to $700K","Poudre School District",
    [{"name":"Ridgeview Elementary","type":"elementary","level":"K-5","rating":9},{"name":"Preston Middle School","type":"middle","level":"6-8","rating":8},{"name":"Fossil Ridge High School","type":"high","level":"9-12","rating":9}],
    "Mandatory HOA ($100-$200/month) covers common areas, pool, snow removal",
    ["Top-rated Fossil Ridge schools","Community pool and parks","Well-maintained newer homes","Close to Harmony Road shopping","Family-friendly atmosphere","Walking trails throughout"],
    ["Waterglen Community Park","Fossil Creek Park","Spring Canyon Park"],
    "Harmony Road to Trilby Road, Lemay Ave to Timberline Rd",40.5100,-105.0500,
    "Waterglen Fort Collins real estate - family-friendly subdivision with top Fossil Ridge schools. SAA Homes.",
    "Waterglen Fort Collins, Waterglen subdivision, south Fort Collins homes, Fossil Ridge schools",
    [{"title":"Top school cluster","description":"Ridgeview Elementary (9/10) through Fossil Ridge High School (9/10) - one of FC best school ladders."},{"title":"Community amenities","description":"Neighborhood pool, parks, and walking trails - designed for families."},{"title":"South-side convenience","description":"Minutes from Harmony Road shopping, major employers, and I-25."}]))

# Insert by city
for city_slug in ["loveland","windsor","greeley","longmont","evans","firestone","frederick","boulder","niwot","mead","la-salle","eaton","milliken","fort-collins"]:
    entries = [x for x in N if f"citySlug: '{city_slug}'" in x.split('\n')[2]]
    if not entries:
        continue
    last_idx = content.rfind(f"citySlug: '{city_slug}'")
    if last_idx != -1:
        after = content.find("  },", last_idx)
        if after != -1:
            after = content.index("\n", after) + 1
            content = content[:after] + "\n" + "\n\n".join(entries) + "\n" + content[after:]
            print(f"+{len(entries)} {city_slug}")
    else:
        # City not yet in file - find best insert point (alphabetically or at end)
        # Insert at end before closing ]
        end_idx = content.rfind("\n]")
        if end_idx != -1:
            content = content[:end_idx] + "\n" + "\n\n".join(entries) + "\n" + content[end_idx:]
            print(f"+{len(entries)} {city_slug} (new city)")

with open(FILE, 'w') as f:
    f.write(content)

import re
counts = {}
for m in re.finditer(r"citySlug: '([^']+)'", content):
    counts[m.group(1)] = counts.get(m.group(1), 0) + 1
print(f"\nTotal: {sum(counts.values())} across {len(counts)} cities")
for c, n in sorted(counts.items()):
    print(f"  {c}: {n}")
