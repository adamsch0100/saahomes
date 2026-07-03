#!/usr/bin/env python3
"""
Add introParagraphs, whyChoose, and highlights to area pages in areaSeo.js
that are missing them (13 dedicated pages).
"""
import re

with open('src/data/areaSeo.js') as f:
    content = f.read()

def esc(s):
    """Escape single quotes and backslashes for JS string"""
    return s.replace('\\', '\\\\').replace("'", "\\'")

# Define content for each missing page
new_content = {}

new_content['fort-collins'] = {
    'introParagraphs': [
        "Fort Collins is Northern Colorado's premier city — home to Colorado State University, a thriving craft brewery scene, and endless outdoor recreation along the Poudre River and Horsetooth Reservoir. The city's mix of historic Old Town character, established family neighborhoods, and new communities makes it a top choice for buyers across every stage of life.",
        "SAA Homes provides expert guidance for Fort Collins buyers and sellers, from Old Town condos and CSU-area rentals to executive homes in coveted neighborhoods. Our team knows Larimer County market trends, pricing, and financing options including CHFA programs for qualified first-time buyers exploring Fort Collins homeownership.",
    ],
    'whyChoose': [
        {'title': 'CSU and education hub', 'description': 'Home to Colorado State University with excellent K-12 schools across Poudre School District.'},
        {'title': 'Thriving downtown', 'description': 'Old Town Square, craft breweries, farmers markets, and cultural venues within walking distance.'},
        {'title': 'Outdoor lifestyle', 'description': 'Poudre River Trail, Horsetooth Reservoir, and hundreds of miles of biking and hiking trails.'},
        {'title': 'Strong job market', 'description': 'Diverse economy spanning technology, healthcare, education, and manufacturing sectors.'},
    ],
    'highlights': {
        'neighborhoods': ['Old Town historic district', 'Midtown urban villages', 'South Fort Collins family neighborhoods', 'Northwest Fort Collins executive homes'],
        'attractions': ['Old Town Square and breweries', 'Horsetooth Mountain Open Space', 'Poudre River Trail system', 'CSU sporting and cultural events'],
    },
}

new_content['loveland'] = {
    'introParagraphs': [
        "Loveland — the Sweetheart City — sits between Fort Collins and Denver along the I-25 corridor, offering residents art galleries, lakefront recreation, and mountain views. From Lake Loveland and Boyd Lake State Park to the historic downtown sculpture tour, Loveland delivers a balanced lifestyle that appeals to families, retirees, and outdoor enthusiasts.",
        "SAA Homes helps Loveland buyers and sellers navigate neighborhoods ranging from established mature-tree communities to new construction along the northern and eastern edges of the city. Our team covers Larimer County market trends and financing solutions including CHFA down payment assistance for those who qualify.",
    ],
    'whyChoose': [
        {'title': 'Arts and culture hub', 'description': 'Home to the Loveland Sculpture Tour, art galleries, and cultural festivals year-round.'},
        {'title': 'Lake recreation', 'description': 'Boyd Lake State Park and Lake Loveland offer boating, fishing, and waterfront living.'},
        {'title': 'I-25 corridor access', 'description': 'Convenient location between Fort Collins and Denver with easy commuting options.'},
        {'title': 'Varied housing options', 'description': 'From historic downtown homes to new construction communities for every budget.'},
    ],
    'highlights': {
        'neighborhoods': ['Historic downtown Loveland', 'Lakefront and golf course communities', 'New construction north and east', 'Established mature-tree neighborhoods'],
        'attractions': ['Boyd Lake State Park', 'Loveland Sculpture Tour', 'Downtown Loveland dining and shopping', 'Chapungu Sculpture Park'],
    },
}

new_content['windsor'] = {
    'introParagraphs': [
        "Windsor is one of Northern Colorado's most sought-after family communities, situated between Fort Collins and Greeley with top-rated schools, extensive trail systems, and a charming downtown. The town's mix of established neighborhoods, new construction, and lake-access properties along Windsor Lake attracts buyers seeking community-oriented living.",
        "SAA Homes guides Windsor buyers through the town's diverse housing market — from historic downtown bungalows to new master-planned communities in the growing eastern corridor. Many Windsor buyers explore CHFA financing programs to make their move to this Larimer-Weld border community more accessible.",
    ],
    'whyChoose': [
        {'title': 'Top-rated schools', 'description': 'Weld RE-4 School District consistently earns high marks for academics and activities.'},
        {'title': 'Windsor Lake community', 'description': 'Lakefront dining, walking paths, concerts, and community events at Boardwalk Park.'},
        {'title': 'Family-focused', 'description': 'Extensive parks, youth sports, and community programs designed for raising families.'},
        {'title': 'Growth and value', 'description': 'New development adds inventory while home prices remain accessible versus Fort Collins.'},
    ],
    'highlights': {
        'neighborhoods': ['Historic downtown Windsor', 'Windsor Lake area', 'New master-planned communities', 'East Windsor growth corridor'],
        'attractions': ['Boardwalk Park and Windsor Lake', 'Windsor Community Recreation Center', 'Pelican Lakes golf and country club', 'Year-round town festivals'],
    },
}

new_content['greeley'] = {
    'introParagraphs': [
        "Greeley is the largest city in Weld County and one of Northern Colorado's fastest-growing urban centers, anchored by the University of Northern Colorado and a strong agricultural and energy economy. The city's affordable home prices, diverse neighborhoods, and expanding amenities make it a smart choice for first-time buyers, investors, and families seeking value.",
        "SAA Homes provides Greeley real estate expertise across established neighborhoods, new developments, and communities near UNC and the Greeley medical corridor. Many Greeley buyers qualify for CHFA down payment assistance programs, making homeownership achievable in one of the region's most affordable major markets.",
    ],
    'whyChoose': [
        {'title': 'Affordable pricing', 'description': 'The most accessible home prices among Northern Colorado major cities.'},
        {'title': 'UNC and education', 'description': 'University of Northern Colorado plus strong K-12 options across Greeley-Evans District 6.'},
        {'title': 'Growing economy', 'description': 'Agriculture, healthcare, education, and energy sectors drive diverse employment.'},
        {'title': 'CHFA friendly', 'description': 'Weld County income limits favor moderate-income buyers using down payment assistance.'},
    ],
    'highlights': {
        'neighborhoods': ['Downtown Greeley historic district', 'UNC area and college neighborhoods', 'West Greeley family communities', 'New development on east and south sides'],
        'attractions': ['UNC campus events and athletics', 'Greeley Stampede and Island Grove Park', 'Poudre River Trail access', 'Growing west Greeley retail corridor'],
    },
}

new_content['timnath'] = {
    'introParagraphs': [
        "Timnath is one of Northern Colorado's fastest-growing towns, located along the I-25 corridor between Fort Collins and Windsor. New master-planned communities, resort-style amenities, and convenient access to both Fort Collins and Denver make Timnath a top choice for buyers seeking modern living in a growing community.",
        "SAA Homes helps Timnath buyers evaluate new construction communities, understand HOA structures, and navigate competitive offers in this high-demand market. Qualified buyers may also explore CHFA down payment assistance programs for move-in ready homes.",
    ],
    'whyChoose': [
        {'title': 'New construction hub', 'description': 'Active master-planned communities with modern floor plans and neighborhood amenities.'},
        {'title': 'I-25 access', 'description': 'Direct highway access for commuters to Fort Collins, Loveland, and Denver.'},
        {'title': 'Resort amenities', 'description': 'Clubhouses, pools, parks, and trails in Timnath communities like The Ridge and Water Valley.'},
        {'title': 'Family-friendly design', 'description': 'Walkable neighborhoods, community schools, and parks planned for growing households.'},
    ],
    'highlights': {
        'neighborhoods': ['The Ridge at Timnath', 'Water Valley area', 'Harmony Club neighborhoods', 'New construction communities off I-25'],
        'attractions': ['Northern Colorado commercial hub', 'Timnath Reservoir recreation', 'Topgolf and nearby dining', 'Proximity to Fort Collins shopping'],
    },
}

new_content['wellington'] = {
    'introParagraphs': [
        "Wellington offers small-town living just 10 minutes north of Fort Collins, combining rural charm with convenient access to one of Northern Colorado's largest employment and education centers. With strong schools in Poudre School District, affordable home prices, and a tight-knit community, Wellington attracts families seeking value without sacrificing quality.",
        "SAA Homes serves Wellington home buyers and sellers with knowledge of the local market, from established neighborhoods to newer subdivisions. Wellington's affordability relative to Fort Collins makes it a popular entry point, and many buyers explore CHFA financing programs to make their purchase more manageable.",
    ],
    'whyChoose': [
        {'title': 'Poudre Schools access', 'description': 'Part of top-rated Poudre School District serving Wellington and Fort Collins.'},
        {'title': 'Fort Collins proximity', 'description': '10-minute commute to Fort Collins employment, shopping, and CSU.'},
        {'title': 'Affordable pricing', 'description': 'Lower home prices than Fort Collins proper while retaining school and amenity access.'},
        {'title': 'Community character', 'description': 'Small-town feel with annual festivals, local businesses, and active civic engagement.'},
    ],
    'highlights': {
        'neighborhoods': ['Historic downtown Wellington', 'North Fort Collins corridor subdivisions', 'Country properties with acreage', 'Newer Wellington developments'],
        'attractions': ['Wellington Harvest Festival', 'Local parks and recreation', 'Proximity to Fort Collins', 'Agricultural heritage and open space'],
    },
}

new_content['johnstown'] = {
    'introParagraphs': [
        "Johnstown sits at the intersection of Larimer and Weld counties along the I-25 corridor, blending historic character with new development. The town's original grain elevator downtown, growing residential communities, and central location between Loveland and Greeley make it a convenient and character-rich choice for Northern Colorado buyers.",
        "SAA Homes provides Johnstown real estate expertise for both historic downtown properties and newer construction neighborhoods. Johnstown's location at the crossroads of major employment centers attracts commuters, and CHFA programs often benefit buyers in this mixed-market area.",
    ],
    'whyChoose': [
        {'title': 'I-25 corridor central', 'description': 'Balanced access to Fort Collins, Loveland, Greeley, and Longmont for commuting.'},
        {'title': 'Historic character', 'description': 'Preserved downtown with local shops and the landmark grain elevator.'},
        {'title': 'New development', 'description': 'Active residential construction adding modern housing options for buyers.'},
        {'title': 'Community events', 'description': 'Johnstown Corn Roast Festival and other gatherings build strong community ties.'},
    ],
    'highlights': {
        'neighborhoods': ['Historic Johnstown downtown', 'I-25 corridor subdivisions', 'Larimer-Weld border communities', 'New construction neighborhoods'],
        'attractions': ['Johnstown Corn Roast Festival', 'Thompson River access', 'Proximity to Loveland and Greeley', 'Boulder valley views from I-25'],
    },
}

new_content['eaton'] = {
    'introParagraphs': [
        "Eaton is a welcoming Weld County community east of Greeley known for top-rated schools, agricultural heritage, and a strong sense of community. Located just 10 minutes from Greeley's shopping and employment, Eaton offers peaceful small-town living without sacrificing access to urban amenities.",
        "SAA Homes serves Eaton buyers looking for affordable homes, family-friendly neighborhoods, and access to Eaton RE-2 schools — consistently ranked among Colorado's best. Many Eaton buyers qualify for CHFA down payment assistance programs, making this tight-knit community even more accessible for first-time homeowners.",
    ],
    'whyChoose': [
        {'title': 'Top-rated schools', 'description': 'Eaton RE-2 School District consistently ranks among Colorado best for academics.'},
        {'title': 'Agricultural roots', 'description': 'Strong farming and ranching heritage with a close-knit community identity.'},
        {'title': 'Greeley proximity', 'description': '10 minutes from Greeley shopping, healthcare, dining, and employment.'},
        {'title': 'Affordable living', 'description': 'Lower home prices than Larimer County with strong community values.'},
    ],
    'highlights': {
        'neighborhoods': ['Historic downtown Eaton', 'Residential subdivisions', 'Country properties with land', 'Newer developments on town edges'],
        'attractions': ['Eaton High School athletics', 'Community parks and recreation', 'Nearby Boyd Lake and reservoirs', 'Annual community events'],
    },
}

new_content['milliken'] = {
    'introParagraphs': [
        "Milliken offers affordable small-town living in Weld County, positioned between Greeley, Loveland, and Johnstown for easy commuting access. With steady population growth, improving infrastructure, and a welcoming community atmosphere, Milliken is increasingly popular for families and first-time buyers.",
        "SAA Homes helps Milliken buyers find value in this growing community, from existing homes in established neighborhoods to newer construction options. Milliken's central Weld County location and affordable price points make it a strong contender for buyers exploring CHFA financing and first-time homebuyer programs.",
    ],
    'whyChoose': [
        {'title': 'Affordable entry', 'description': 'Some of the most competitive home prices in the Northern Colorado corridor.'},
        {'title': 'Central Weld location', 'description': 'Easy access to Greeley, Loveland, Johnstown, and Fort Collins area employers.'},
        {'title': 'Growing town', 'description': 'Ongoing development adding amenities, retail, and housing options for buyers.'},
        {'title': 'Commuter friendly', 'description': 'Convenient Highway 60 and I-25 access for regional commuting.'},
    ],
    'highlights': {
        'neighborhoods': ['Historic Milliken core', 'Newer Milliken subdivisions', 'Johnstown border communities', 'Country properties with acreage'],
        'attractions': ['Community parks and playgrounds', 'Milliken annual events', 'Nearby Boyd Lake State Park', 'Short drive to Greeley amenities'],
    },
}

new_content['la-salle'] = {
    'introParagraphs': [
        "La Salle is a historic Weld County community south of Greeley with deep agricultural roots and a quiet, family-oriented atmosphere. Its location along the South Platte River valley and proximity to Greeley's employment, shopping, and UNC campus make it an appealing choice for buyers seeking affordability and small-town peace.",
        "SAA Homes serves La Salle buyers looking for value in Weld County real estate, including existing homes and properties with acreage. La Salle's affordability makes it especially attractive for first-time buyers, many of whom access CHFA down payment assistance programs through SAA Homes guidance.",
    ],
    'whyChoose': [
        {'title': 'Historic community', 'description': 'Well-preserved agricultural character with a strong sense of local history.'},
        {'title': 'Greeley access', 'description': 'Minutes south of Greeley for shopping, dining, healthcare, and UNC.'},
        {'title': 'Affordable pricing', 'description': 'Some of the lowest home prices in the Greeley metro area.'},
        {'title': 'Rural setting', 'description': 'Quiet streets, open views, and space between homes for a peaceful lifestyle.'},
    ],
    'highlights': {
        'neighborhoods': ['Central La Salle neighborhoods', 'South Platte Valley properties', 'Evans border area', 'Country properties near Greeley'],
        'attractions': ['South Platte River access', 'Proximity to UNC and Greeley', 'Agricultural heritage', 'Short drive to Fort Collins'],
    },
}

new_content['mead'] = {
    'introParagraphs': [
        "Mead is a quiet Weld County town between Longmont and Fort Collins, offering peaceful country living with open-space views and easy interstate access. This under-the-radar community attracts buyers seeking escape from busier Front Range cities while maintaining reasonable commutes to major employment centers along the I-25 corridor.",
        "SAA Homes helps Mead buyers discover value in this growing community, with housing options ranging from historic homes to newer construction on larger lots. Mead's affordability compared to Longmont and Fort Collins makes it a smart option for buyers using CHFA down payment assistance and first-time buyer programs.",
    ],
    'whyChoose': [
        {'title': 'Peaceful setting', 'description': 'Quiet agricultural community with open space and mountain views.'},
        {'title': 'I-25 access', 'description': 'Minutes from I-25 for commuting to Longmont, Fort Collins, and Denver.'},
        {'title': 'Undiscovered value', 'description': 'More home and land for your budget compared to nearby Front Range cities.'},
        {'title': 'Space to spread out', 'description': 'Larger lots, country properties, and room for gardening and recreation.'},
    ],
    'highlights': {
        'neighborhoods': ['Downtown Mead area', 'Country properties with acreage', 'Newer Weld County subdivisions', 'Longmont border communities'],
        'attractions': ['Quiet rural atmosphere', 'Open-space views', 'Proximity to I-25', 'Short drive to Longmont and Fort Collins'],
    },
}

new_content['longmont'] = {
    'introParagraphs': [
        "Longmont is the largest city in Boulder County outside of Boulder itself, offering a progressive tech-and-agriculture identity, historic downtown, and more accessible home prices than its county seat neighbor. Located along I-25 and the St. Vrain Greenway between Boulder and Loveland, Longmont attracts professionals, families, and outdoor enthusiasts alike.",
        "SAA Homes serves Longmont buyers and sellers across the city's diverse neighborhoods — from Victorian homes near historic Main Street to newer communities along the city's growing edges. Longmont's strong employment base and Boulder County location make it a competitive market, and CHFA programs help qualified buyers enter this desirable area.",
    ],
    'whyChoose': [
        {'title': 'Boulder County access', 'description': 'Lower home prices than Boulder with access to the same county amenities.'},
        {'title': 'Historic downtown', 'description': 'Main Street dining, breweries, farmers market, and year-round festivals.'},
        {'title': 'Tech and agriculture', 'description': 'Growing tech sector plus a strong agricultural heritage define the local economy.'},
        {'title': 'Trail network', 'description': 'St. Vrain Greenway and regional trail connections for biking and walking.'},
    ],
    'highlights': {
        'neighborhoods': ['Historic Old Town Longmont', 'South Longmont family neighborhoods', 'Prospect New Town', 'New development along I-25 corridor'],
        'attractions': ['Main Street downtown district', 'St. Vrain Greenway trail system', 'Boulder County events', 'Union Reservoir recreation'],
    },
}

new_content['boulder'] = {
    'introParagraphs': [
        "Boulder is an iconic Colorado city at the foot of the Flatirons, synonymous with outdoor adventure, academic excellence at CU Boulder, and a premium lifestyle that draws buyers from across the country. From University Hill and North Boulder to Chautauqua and south Boulder, each neighborhood offers a distinct character within this world-class mountain city.",
        "SAA Homes provides Boulder County real estate expertise for buyers and sellers navigating this premium market. While Boulder's pricing is the highest in our service area, our team helps clients identify the right neighborhood and financing approach — including CHFA program eligibility where applicable for qualified buyers entering Boulder County.",
    ],
    'whyChoose': [
        {'title': 'Flatirons setting', 'description': 'World-famous mountain backdrop with Chautauqua Park and open space at your doorstep.'},
        {'title': 'CU Boulder', 'description': 'Top-tier university driving culture, events, and a dynamic local economy.'},
        {'title': 'Premium lifestyle', 'description': 'Pearl Street Mall, farm-to-table dining, and year-round outdoor recreation.'},
        {'title': 'Strong property values', 'description': 'Consistent long-term appreciation in one of Colorado most desirable markets.'},
    ],
    'highlights': {
        'neighborhoods': ['Chautauqua historic area', 'North Boulder (NoBo)', 'University Hill', 'South Boulder family neighborhoods'],
        'attractions': ['Pearl Street Mall', 'Chautauqua Park and hiking', 'CU sporting and cultural events', 'Boulder Creek Path'],
    },
}

# Process each entry
for slug, data in new_content.items():
    entry_pattern = f"    slug: '{slug}',"
    idx = content.find(entry_pattern)
    if idx == -1:
        print(f"WARNING: Could not find entry for {slug}")
        continue
    
    # Find the end of this entry (before next '  {' or '];')
    entry_end = content.find('\n  {', idx + 1)
    if entry_end == -1:
        entry_end = content.find('\n];', idx)
    
    entry_block = content[idx:entry_end]
    
    if 'introParagraphs' in entry_block:
        print(f"SKIP: {slug} already has introParagraphs")
        continue
    
    # Find the last geo line before } closing
    geo_line = content.rfind('\n    geo:', idx, entry_end)
    if geo_line == -1:
        print(f"WARNING: Could not find geo for {slug}")
        continue
    
    # Find the end of geo value: ' },'
    # Pattern is: `    geo: { latitude: '...', longitude: '...' },`
    # The value ends with ` },` then newline
    value_end = content.find(' },', geo_line)
    if value_end == -1 or value_end > entry_end:
        print(f"WARNING: Could not find geo end for {slug}")
        continue
    
    # Insert after ' },' and newline character
    insert_pos = value_end + 3  # after ' },'
    
    # Build insertion text
    intro_lines = "\n".join(f"      '{esc(p)}'," for p in data['introParagraphs'])
    why_lines = "\n".join(
        f"      {{ title: '{esc(w['title'])}', description: '{esc(w['description'])}' }},"
        for w in data['whyChoose']
    )
    hood_lines = ",\n".join(f"        '{esc(n)}'" for n in data['highlights']['neighborhoods'])
    attr_lines = ",\n".join(f"        '{esc(a)}'" for a in data['highlights']['attractions'])
    
    insertion = (
        f"\n    introParagraphs: [\n"
        f"{intro_lines}\n"
        f"    ],\n"
        f"    whyChoose: [\n"
        f"{why_lines}\n"
        f"    ],\n"
        f"    highlights: {{\n"
        f"      neighborhoods: [\n"
        f"{hood_lines},\n"
        f"      ],\n"
        f"      attractions: [\n"
        f"{attr_lines},\n"
        f"      ],\n"
        f"    }},"
    )
    
    after = content[insert_pos:insert_pos+3]
    if after != '\n  ':
        print(f"WARNING: Insert position mismatch for {slug}: found '{after}'")
        continue
    
    content = content[:insert_pos] + insertion + content[insert_pos:]
    print(f"✅ Added content for {slug}")

with open('src/data/areaSeo.js', 'w') as f:
    f.write(content)

print("\nDone! All 13 pages updated.")
