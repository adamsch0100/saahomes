#!/usr/bin/env python3
"""Create PR for CHFA prerender body injection."""
import os, json, urllib.request

token = os.environ.get('GITHUB_TOKEN', '')
if not token:
    print("No GITHUB_TOKEN")
    exit(1)

pr_data = {
    "title": "P0 SEO: Inject prerendered body content into CHFA pages",
    "head": "hermes/seo-20260629-chfa-prerender",
    "base": "main",
    "body": "## What\nAdds prerendered body content to CHFA down payment assistance pages so crawlers can read program info, FAQs, requirements, and CTAs without executing JavaScript.\n\n## Before\n- CHFA DPA page: 86 chars visible body text, no H2s, no FAQ structure\n- CHFA Schools page: 75 chars visible body text\n\n## After\n- CHFA DPA page: 6,149 chars visible body text, 7 H2 sections\n- CHFA Schools page: 2,223 chars visible body text, 3 sections\n- Phone (970) 999-1407 in CTAs\n\n## Impact\nThese pages already rank (CHFA Schools at pos 5.5). This makes them readable by Googlebot without React execution.\n\nFiles: src/data/chfaData.js, scripts/prerender-meta.mjs",
    "maintainer_can_modify": True
}

data = json.dumps(pr_data).encode()
req = urllib.request.Request(
    "https://api.github.com/repos/adamsch0100/saahomes/pulls",
    data=data,
    headers={
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
    }
)
resp = urllib.request.urlopen(req, timeout=15)
pr = json.loads(resp.read())
pr_num = pr["number"]
print(f"PR #{pr_num} created: {pr['html_url']}")
print(f"PR number: {pr_num}")
