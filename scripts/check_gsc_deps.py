#!/usr/bin/env python3
"""Check GSC dependencies are installed."""
try:
    from googleapiclient.discovery import build
    print("GSC deps OK")
except ImportError as e:
    print(f"MISSING: {e}")