#!/usr/bin/env python3
"""Build the Aug 17 2026 social backlog packs + validate X/GBP constraints."""
import json, os, sys

os.makedirs("outreach/pending", exist_ok=True)

P = "https://saahomes.com"
IMG = "https://saahomes.com/images"

def pack(name, subject, title, url, intro, platforms, extra=None):
    p = {
        "subject": subject,
        "promoting": {"title": title, "url": url},
        "intro": intro,
        "scheduled_posts": [],
        "operator_schedule": ["Posts are queued via Buffer automatically."],
        "platforms": platforms,
    }
    if extra:
        p.update(extra)
    path = f"outreach/pending/social-2026-08-17-{name}.json"
    with open(path, "w") as f:
        json.dump(p, f, indent=2)
    print(f"built {path}")

# ---------- Pack 1: 49 Neighborhood Guides ----------
pack(
    "neighborhood-guides",
    "SAA Homes — Social posts | 49 New Neighborhood Guides",
    "49 New Neighborhood Guides Across Northern Colorado",
    f"{P}/northern-colorado-areas/erie/colliers-hill-erie/",
    "49 neighborhood guides shipped this week across 8 communities — Erie, Brighton, Estes Park, Red Feather Lakes, Fort Lupton, Lyons, Bellvue, and Carbon Valley. Every guide has verified schools, home styles, boundaries, and local highlights.",
    [
        {
            "name": "Google Business Profile",
            "caption": "New neighborhood guides are live for Erie, Brighton, Estes Park, Red Feather Lakes, Fort Lupton, Lyons, Bellvue, and Carbon Valley. Schools, home styles, boundaries, and local highlights for every area — 49 guides in all. Explore the details for your community at the link below.",
            "image_url": f"{IMG}/noco-neighborhood-guides-2026.jpg",
        },
        {
            "name": "Facebook",
            "caption": "🏘️ 49 brand-new neighborhood guides just went live across Northern Colorado!\n\nWe added dedicated guides for 8 communities: Erie, Brighton, Estes Park, Red Feather Lakes, Fort Lupton, Lyons, Bellvue, and Carbon Valley. Each one breaks down the real details buyers ask us about daily:\n• Schools & districts\n• Home styles & price ranges\n• Neighborhood boundaries\n• Parks, trails & local highlights\n\nWhether you're scouting Erie's Colliers Hill or dreaming of a cabin near Red Feather Lakes, start here: https://saahomes.com/northern-colorado-areas/erie/colliers-hill-erie/\n\nExplore all guides → https://saahomes.com/northern-colorado-areas/\n\nAdam & Mandi Schwartz | SAA Homes\n(970) 999-1407\n\n#NorthernColoradoRealEstate #ErieCO #BrightonColorado #EstesPark #FortLupton #LyonsColorado #Bellvue #CarbonValley #SAAHomes",
            "image_url": f"{IMG}/noco-neighborhood-guides-2026.jpg",
        },
        {
            "name": "X",
            "caption": "49 new neighborhood guides just dropped — Erie, Brighton, Estes Park, Red Feather Lakes, Fort Lupton, Lyons, Bellvue & Carbon Valley. Schools, home styles, boundaries, local highlights. Start here: https://saahomes.com/northern-colorado-areas/erie/colliers-hill-erie/",
            "image_url": f"{IMG}/noco-neighborhood-guides-2026.jpg",
        },
    ],
    extra={"rotation_week": None, "rotation_theme": "New content megapack — neighborhood guides"},
)

# ---------- Pack 2: Best-Realtor Posts ----------
pack(
    "best-realtor-posts",
    "SAA Homes — Social posts | Best Realtor Guides (Loveland, Greeley, Longmont)",
    "Best Realtor Guides — Loveland, Greeley, Longmont",
    f"{P}/blog/loveland-colorado-real-estate-agent/",
    "Three new city-by-city guides on finding the right real estate agent in Loveland, Greeley, and Longmont — what to check, what to ask, and why local expertise matters.",
    [
        {
            "name": "Google Business Profile",
            "caption": "Choosing an agent? New city-by-city guides break down what to look for in Loveland, Greeley, and Longmont — credentials, local track record, and the right questions to ask. Read the guide at the link below.",
            "image_url": f"{IMG}/best-realtor-noco-2026.jpg",
        },
        {
            "name": "Facebook",
            "caption": "🏡 How do you actually pick the right real estate agent?\n\nWe published three new guides covering exactly that — one for Loveland, one for Greeley, and one for Longmont. Each walks through:\n• Credentials & local track record to verify\n• The questions that separate pros from part-timers\n• Why neighborhood-level knowledge changes your outcome\n\nStart with your city:\nLoveland → https://saahomes.com/blog/loveland-colorado-real-estate-agent/\nGreeley → https://saahomes.com/blog/greeley-colorado-real-estate-agent/\nLongmont → https://saahomes.com/blog/longmont-colorado-real-estate-agent/\n\nAdam & Mandi Schwartz | SAA Homes\n(970) 999-1407\n\n#LovelandRealEstate #GreeleyRealEstate #LongmontRealEstate #NorthernColorado #SAAHomes",
            "image_url": f"{IMG}/best-realtor-noco-2026.jpg",
        },
        {
            "name": "X",
            "caption": "Picking an agent in Loveland, Greeley, or Longmont? New guides on what to verify, what to ask, and why local knowledge wins: https://saahomes.com/blog/loveland-colorado-real-estate-agent/",
            "image_url": f"{IMG}/best-realtor-noco-2026.jpg",
        },
    ],
)

# ---------- Pack 3: Recently Sold + Market Update ----------
pack(
    "recently-sold",
    "SAA Homes — Social posts | Recently Sold Data + August Market Update",
    "Recently Sold Homes on Every City Page",
    f"{P}/for-sellers/",
    "Live MLS closed-sale data is now on all 27 city pages plus the sellers page — see what homes actually sell for in your neighborhood. The August market update is live too.",
    [
        {
            "name": "Google Business Profile",
            "caption": "Curious what homes are actually selling for in your neighborhood? Live recently-sold data is now on every Northern Colorado city page — 27 communities covered. See the latest numbers at the link below.",
            "image_url": f"{IMG}/recently-sold-noco-2026.jpg",
        },
        {
            "name": "Facebook",
            "caption": "📊 What did homes in YOUR neighborhood actually sell for?\n\nWe just put live recently-sold data on all 27 Northern Colorado city pages — real MLS closed sales, not estimates. Check your community:\n\nhttps://saahomes.com/for-sellers/\n\nAnd for the big picture, our August market update covers home prices, inventory, and summer trends across Fort Collins, Loveland, Windsor, and Greeley: https://saahomes.com/blog/northern-colorado-market-update-august-2026/\n\nAdam & Mandi Schwartz | SAA Homes\n(970) 999-1407\n\n#NorthernColoradoRealEstate #RecentlySold #FortCollins #Loveland #Windsor #Greeley #SAAHomes",
            "image_url": f"{IMG}/recently-sold-noco-2026.jpg",
        },
        {
            "name": "X",
            "caption": "See what homes actually sell for in your neighborhood — live closed-sale data now on all 27 NoCo city pages: https://saahomes.com/for-sellers/",
            "image_url": f"{IMG}/recently-sold-noco-2026.jpg",
        },
    ],
)

# ---------- Pack 4: Assumable Mortgages ----------
pack(
    "assumable-mortgages",
    "SAA Homes — Social posts | Assumable Mortgages Hub",
    "Assumable Mortgages — Lower-Rate Listings",
    f"{P}/assumable-mortgages/",
    "New hub explaining assumable mortgages — how buyers can take over a seller's low interest rate and what to watch for. Plus two deep-dive posts.",
    [
        {
            "name": "Google Business Profile",
            "caption": "Buyers can inherit a seller's low interest rate with an assumable mortgage. New hub explains how it works, what it costs, and which loans qualify. Learn more at the link below.",
            "image_url": f"{IMG}/assumable-mortgages-noco.jpg",
        },
        {
            "name": "Facebook",
            "caption": "🔑 Could you take over a 2.5–3% mortgage rate?\n\nAssumable mortgages are one of the smartest buyer plays in this market — you inherit the seller's existing low-rate loan instead of financing at today's rates. Savings can be huge over the life of the loan.\n\nOur new hub breaks down:\n• How assumability actually works\n• Which loan types qualify (VA, FHA, USDA, some conventional)\n• What it costs to assume vs. refinance\n• The fine print that trips buyers up\n\nStart here: https://saahomes.com/assumable-mortgages/\n\nDeep dives: Colorado assumable guide → https://saahomes.com/blog/assumable-mortgage-colorado/ and Fort Collins assumable homes → https://saahomes.com/blog/assumable-homes-fort-collins/\n\nAdam & Mandi Schwartz | SAA Homes\n(970) 999-1407\n\n#AssumableMortgage #LowerRates #NorthernColoradoRealEstate #FortCollins #SAAHomes",
            "image_url": f"{IMG}/assumable-mortgages-noco.jpg",
        },
        {
            "name": "X",
            "caption": "Assumable mortgages = take over a seller's low rate. New hub on how it works, what it costs, and which loans qualify: https://saahomes.com/assumable-mortgages/",
            "image_url": f"{IMG}/assumable-mortgages-noco.jpg",
        },
    ],
)

# ---------- Pack 5: Veterans ----------
pack(
    "veterans",
    "SAA Homes — Social posts | Veterans Hub + VA Loan Guides",
    "Veterans Hub — 0.5% Back Pledge + VA Loan Guides",
    f"{P}/veterans/",
    "SAA Homes gives back to those who served: 0.5% pledge at closing, VA loan guide, and a military relocation guide.",
    [
        {
            "name": "Google Business Profile",
            "caption": "Serving Northern Colorado veterans: our team pledges 0.5% back at closing (applied to your warranty, closing costs, or price — whichever helps most). Plus VA loan and relocation guides. Details at the link below.",
            "image_url": f"{IMG}/veterans-noco-2026.jpg",
        },
        {
            "name": "Facebook",
            "caption": "🇺🇸 To the veterans and military families of Northern Colorado — thank you.\n\nWe made it official: SAA Homes pledges 0.5% of our commission back to every veteran and active-duty client at closing. You choose how it's applied — extended warranty, closing costs, or a price reduction.\n\nNew resources to help you buy or sell:\n• Veterans hub & pledge details → https://saahomes.com/veterans/\n• VA loan guide for Colorado → https://saahomes.com/blog/va-loan-colorado-guide/\n• Military relocation guide → https://saahomes.com/blog/military-relocation-northern-colorado/\n\nAdam & Mandi Schwartz | SAA Homes\n(970) 999-1407\n\n#Veterans #MilitaryFriendly #VALoan #NorthernColoradoRealEstate #SAAHomes",
            "image_url": f"{IMG}/veterans-noco-2026.jpg",
        },
        {
            "name": "X",
            "caption": "Veterans & military families: we pledge 0.5% back at closing — applied to your warranty, costs, or price. VA loan + relocation guides: https://saahomes.com/veterans/",
            "image_url": f"{IMG}/veterans-noco-2026.jpg",
        },
    ],
)

# ---------- Pack 6: Catch-up batch (short sale, Erie new construction, realtor guides, events) ----------
pack(
    "catch-up-guides",
    "SAA Homes — Social posts | More New Guides (Short Sale, Erie, Realtor Tips, Events)",
    "New Guides: Short Sales, Erie New Construction & More",
    f"{P}/blog/short-sale-fort-collins-colorado/",
    "Catch-up batch: Fort Collins short-sale guide, Erie new-construction buyer guide, realtor guides for Timnath/Berthoud/Johnstown, and the 2026 events calendar.",
    [
        {
            "name": "Google Business Profile",
            "caption": "New guides to browse: short sales in Fort Collins, new-construction buying in Erie, realtor tips for Timnath/Berthoud/Johnstown, and the full 2026 Northern Colorado events calendar. Start reading at the link below.",
            "image_url": f"{IMG}/foreclosure-short-sale-northern-colorado-guide.jpg",
        },
        {
            "name": "Facebook",
            "caption": "📚 New on the SAA Homes blog:\n\n• Short sale in Fort Collins? What sellers should know → https://saahomes.com/blog/short-sale-fort-collins-colorado/\n• New-construction buyer guide for Erie → https://saahomes.com/blog/erie-colorado-new-construction-buyer-guide/\n• Realtor guides: Timnath → https://saahomes.com/blog/timnath-colorado-real-estate-agent/ · Berthoud → https://saahomes.com/blog/berthoud-colorado-real-estate-agent/ · Johnstown → https://saahomes.com/blog/johnstown-colorado-real-estate-agent/\n• 2026 events calendar → https://saahomes.com/events/\n\nAdam & Mandi Schwartz | SAA Homes\n(970) 999-1407\n\n#FortCollins #ErieColorado #Timnath #Berthoud #Johnstown #NorthernColoradoEvents #SAAHomes",
            "image_url": f"{IMG}/foreclosure-short-sale-northern-colorado-guide.jpg",
        },
        {
            "name": "X",
            "caption": "New guides: Fort Collins short sales, Erie new construction, Timnath/Berthoud/Johnstown agent tips + the 2026 events calendar: https://saahomes.com/blog/short-sale-fort-collins-colorado/",
            "image_url": f"{IMG}/foreclosure-short-sale-northern-colorado-guide.jpg",
        },
    ],
)

print("all packs built")