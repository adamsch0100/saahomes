#!/usr/bin/env python3
"""Find rows in backlinks-log.csv whose field count != 7."""
import csv

rows = list(csv.reader(open('/opt/data/workspace/saahomes-repo/hermes/backlinks-log.csv')))
for i, r in enumerate(rows):
    if len(r) != 7:
        print(f"ROW {i} fields={len(r)} -> {r[:3]} ||| {r[6:] if len(r) > 6 else ''}")
print("scan done")