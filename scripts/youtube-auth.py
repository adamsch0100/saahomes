#!/usr/bin/env python3
"""One-time auth: generate URL, wait for user to paste code, exchange it."""
import pickle
import sys
from google_auth_oauthlib.flow import InstalledAppFlow
import googleapiclient.discovery

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.force-ssl",
]

# Generate URL (stores PKCE verifier internally)
flow = InstalledAppFlow.from_client_secrets_file("client_secret.json", SCOPES)
flow.redirect_uri = "http://localhost"
url, _ = flow.authorization_url(prompt="consent")

print("=" * 60)
print("  YOUTUBE AUTH — ONE-TIME SETUP")
print("=" * 60)
print()
print("  1. Click this link (or open in browser):")
print(f"  {url}")
print()
print("  2. Sign in with the account that owns youtube.com/@SAAHomes")
print()
print("  3. After authorizing, the page will say 'This site can't be reached'")
print("     — that's expected. Copy the FULL URL from the address bar")
print("     (starts with http://localhost/?code=...)")
print()
print("  4. Paste the FULL URL below and press Enter")
print()
print("=" * 60)

# Read the full redirect URL from stdin
redirect_url = input("\nPaste full redirect URL: ").strip()

# Extract code from the URL
from urllib.parse import urlparse, parse_qs
parsed = urlparse(redirect_url)
params = parse_qs(parsed.query)
code = params.get("code", [None])[0]

if not code:
    print("ERROR: Could not extract authorization code from URL.")
    sys.exit(1)

print(f"\nCode extracted. Exchanging for tokens...")

# Exchange using the SAME flow (has the PKCE verifier)
flow.fetch_token(code=code)
print("✅ Token obtained!")
print(f"   Expires: {flow.credentials.expiry}")
print(f"   Refresh: {'Yes' if flow.credentials.refresh_token else 'No'}")

# Save
with open("youtube_token.pickle", "wb") as f:
    pickle.dump(flow.credentials, f)
print("   Saved to: youtube_token.pickle")

# Verify
youtube = googleapiclient.discovery.build("youtube", "v3", credentials=flow.credentials)
resp = youtube.channels().list(part="snippet", mine=True).execute()
channel = resp["items"][0]
print(f"\n{'=' * 60}")
print(f'   ✅ Authenticated as: {channel["snippet"]["title"]}')
print(f"{'=' * 60}")
