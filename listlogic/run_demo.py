#!/usr/bin/env python
"""Generate the demo ListLogic presentation locally (2845 W 13th St)."""
from __future__ import annotations

from pathlib import Path

from presentation import save_presentation
from subject import SUBJECT_2845_DEFAULTS, resolve_subject

ROOT = Path(__file__).resolve().parent
EXPORT_PATH = ROOT / "data" / "export-71.txt"
OUTPUT_DIR = ROOT / "output"


def main() -> None:
    if not EXPORT_PATH.exists():
        raise SystemExit(f"Missing sample export: {EXPORT_PATH}")

    subject = resolve_subject(
        str(EXPORT_PATH),
        address="2845 W 13th Street Greeley 80634",
        defaults=SUBJECT_2845_DEFAULTS,
        overrides={"living_area": 2392},
    )
    print("Resolved subject:")
    print(f"  Address: {subject.address}")
    print(f"  Living area: {subject.living_area}")
    print(f"  Beds/Baths: {subject.beds}/{subject.baths}")
    print(f"  Year: {subject.year_built}")
    print(f"  Source: {(subject.extra or {}).get('source')}")
    print()

    report, html_path = save_presentation(
        str(EXPORT_PATH),
        subject=subject,
        output_dir=str(OUTPUT_DIR),
        area_name="West Greeley · similar homes",
        city_filter="Greeley",
        market_notes="Greeley sample pull — ListLogic also reads sq ft, garage, and date span from the file.",
    )
    print(f"\nOpen in browser: {html_path.resolve()}")
    if report.get("positioning"):
        positioning = report["positioning"]
        print(
            f"Recommended ${positioning['recommended_price']:,.0f} | "
            f"MOI {report['stats']['months_of_inventory']:.2f} | "
            f"Active {report.get('active_count')} | UC {report.get('under_contract_count')}"
        )


if __name__ == "__main__":
    main()
