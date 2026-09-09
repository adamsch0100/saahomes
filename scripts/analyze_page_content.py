#!/usr/bin/env python3
"""Analyze body content of a fetched saahomes.com page."""
import re, sys

with open(sys.argv[1]) as f:
    html = f.read()

body = re.search(r'<body[^>]*>(.*?)</body>', html, re.DOTALL)
if body:
    text = re.sub(r'<[^>]+>', ' ', body.group(1)).strip()
    text = re.sub(r'\s+', ' ', text)
    print(f"Body text: {len(text)} chars")
    print(f"--- Preview ---")
    print(text[:2500])
else:
    print("No body found")
    print(f"HTML size: {len(html)} bytes")

# Check prerender markers
print(f"\n--- Prerender check ---")
print(f"prerendered-blog-section: {'prerendered-blog-section' in html}")
print(f"faq-section: {'faq-section' in html}")
print(f"FAQPage schema: {'FAQPage' in html}")
root_div = re.search(r'<div id="root">(.*?)</div>', html, re.DOTALL)
if root_div:
    print(f"#root div content: {len(root_div.group(1))} chars")
    print(f"#root preview: {root_div.group(1)[:200]}")