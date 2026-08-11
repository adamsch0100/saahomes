"""Check if Realtor SFR pull leaks townhomes/condos; inspect attached signals."""
from __future__ import annotations

import json
import sys

sys.stdout.reconfigure(encoding="utf-8")

from portal_market import reef_call

BOUNDS = {"west": -104.7567, "east": -104.7036, "south": 40.3993, "north": 40.4299}
BASE = {
    "location": "Greeley, CO",
    "map_bounds": BOUNDS,
    "beds_min": 3,
    "baths_min": 2,
    "sqft_min": 1600,
    "sqft_max": 2800,
    "sort": "sold_date",
    "limit": 200,
    "offset": 0,
}


def results_of(resp: dict) -> list:
    return (resp.get("data") or {}).get("results") or []


def main() -> None:
    for ht in ["single_family", "townhomes", "condos", "multi_family"]:
        r = reef_call("realtor", "sold", {**BASE, "home_type": ht})
        items = results_of(r)
        total = (r.get("data") or {}).get("total")
        print(ht, "n", len(items), "total", total)
        types: dict[str, int] = {}
        for it in items:
            key = f"{it.get('property_type')}|{it.get('sub_type')}"
            types[key] = types.get(key, 0) + 1
        print("  types", types)
        if items:
            s = items[0]
            print(
                "  sample",
                s.get("address_line"),
                "lot",
                s.get("lot_sqft"),
                s.get("property_type"),
                s.get("sub_type"),
            )

    r = reef_call("realtor", "sold", {**BASE, "home_type": "single_family"})
    items = results_of(r)
    sfr_ids = {str(it.get("property_id")) for it in items}
    r_th = reef_call("realtor", "sold", {**BASE, "home_type": "townhomes"})
    th = results_of(r_th)
    th_ids = {str(it.get("property_id")) for it in th}
    print("\nOverlap SFR ∩ townhomes ids:", len(sfr_ids & th_ids))

    small = sorted([x for x in items if x.get("lot_sqft")], key=lambda x: x["lot_sqft"])[:8]
    print("\nSmallest lots in SFR pull:")
    for it in small:
        print(
            it.get("address_line"),
            "lot",
            it.get("lot_sqft"),
            "sqft",
            it.get("sqft"),
            "ptype",
            it.get("property_type"),
            "sub",
            it.get("sub_type"),
            "hoa_flag?",
        )
        d = reef_call("realtor", "detail", {"property_id": str(it["property_id"])})
        data = d.get("data") or {}
        prop = data.get("property") if isinstance(data.get("property"), dict) else data
        if not isinstance(prop, dict):
            print("  detail unexpected", type(prop))
            continue
        print("  hoa_fee_usd", prop.get("hoa_fee_usd"))
        desc = (prop.get("description_text") or "").replace("\n", " ")[:220]
        print("  desc", desc)
        blob = json.dumps(prop.get("feature_groups") or {}).lower()
        hits = [tok for tok in ("town", "condo", "attach", "patio", "zero lot", "row home", "duplex", "shared wall") if tok in blob]
        if hits:
            print("  feature hits", hits)
        # also check top-level type-ish fields
        for k in ("property_type", "sub_type", "home_type", "style", "description"):
            if k in prop:
                print(f"  {k}", prop.get(k))


if __name__ == "__main__":
    main()
