#!/usr/bin/env python3
"""Rebuild presentation.html from presentation_data.json."""
from pathlib import Path
import json

from interactive_html import save_interactive_html

report = json.loads(Path("presentation_data.json").read_text(encoding="utf-8"))
out = save_interactive_html(report, "presentation.html")
text = out.read_text(encoding="utf-8")
print(f"Wrote {out} ({out.stat().st_size:,} bytes)")
print("Has charts:", all(x in text for x in ["scatter", "salesTrend", "priceTrend", "domChart"]))
print("Has TABLE:", "const TABLE=" in text)
