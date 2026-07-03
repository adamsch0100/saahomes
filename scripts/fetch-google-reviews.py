#!/usr/bin/env python3
"""
Fetch Google reviews from Google Business Profile API and save to data file.
Run via cron to keep reviews up to date.

Usage:
  python3 scripts/fetch-google-reviews.py
  python3 scripts/fetch-google-reviews.py --output src/data/reviews.json
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

def fetch_reviews_via_api(credentials_json):
    """
    Fetch reviews from Google Business Profile API v4.
    Uses the My Business API with a service account.
    """
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
    except ImportError:
        print("Installing google-api-python-client...")
        os.system(f"{sys.executable} -m pip install google-api-python-client google-auth-httplib2")
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

    # Parse credentials
    if isinstance(credentials_json, str):
        creds_info = json.loads(credentials_json)
    else:
        creds_info = credentials_json

    SCOPES = ['https://www.googleapis.com/auth/business.manage']

    credentials = service_account.Credentials.from_service_account_info(
        creds_info, scopes=SCOPES
    )

    # Build the My Business API service
    mybusiness = build('mybusiness', 'v4', credentials=credentials)

    # Get the business account
    accounts = mybusiness.accounts().list().execute()
    if not accounts.get('accounts'):
        print("No GBP accounts found with these credentials.")
        return []

    account_name = accounts['accounts'][0]['name']
    print(f"Account: {accounts['accounts'][0].get('accountName', account_name)}")

    # Get locations
    locations = mybusiness.accounts().locations().list(parent=account_name, pageSize=100).execute()
    if not locations.get('locations'):
        print("No locations found.")
        return []

    all_reviews = []
    for location in locations['locations']:
        loc_name = location['name']
        loc_title = location.get('locationName', loc_name)
        print(f"Location: {loc_title}")

        # Fetch reviews for this location
        try:
            reviews = mybusiness.accounts().locations().reviews().list(parent=loc_name).execute()
            for review in reviews.get('reviews', []):
                all_reviews.append({
                    'name': review.get('reviewer', {}).get('displayName', 'Anonymous'),
                    'text': review.get('comment', ''),
                    'rating': review.get('starRating', 'FIVE').count('T'),
                    'date': review.get('createTime', '')[:10],
                    'source': 'Google',
                    'reviewUrl': review.get('reviewReply', {}).get('reviewUrl', ''),
                })
            print(f"  → {len(reviews.get('reviews', []))} reviews")
        except Exception as e:
            print(f"  → Error fetching reviews: {e}")

    # Sort by date, newest first
    all_reviews.sort(key=lambda r: r.get('date', ''), reverse=True)
    return all_reviews


def main():
    parser = argparse.ArgumentParser(description='Fetch Google reviews for SAA Homes')
    parser.add_argument('--output', default='src/data/reviews.json',
                        help='Output JSON file (default: src/data/reviews.json)')
    args = parser.parse_args()

    # Get credentials from environment
    creds_json = os.environ.get('GBP_CREDENTIALS')
    if not creds_json:
        print("ERROR: GBP_CREDENTIALS environment variable not set.")
        print("Set it to the Google service account JSON key.")
        sys.exit(1)

    reviews = fetch_reviews_via_api(creds_json)

    if not reviews:
        print("\nNo reviews found. You may need to:")
        print("1. Add the service account email to your Google Business Profile")
        print("2. Enable the My Business API in Google Cloud Console")
        print("3. Wait for the service account to be granted access")
        sys.exit(1)

    # Ensure output directory exists
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    data = {
        'reviews': reviews,
        'count': len(reviews),
        'averageRating': round(sum(r['rating'] for r in reviews) / len(reviews), 1),
        'lastFetched': time.strftime('%Y-%m-%dT%H:%M:%S'),
    }

    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"\n✅ Saved {len(reviews)} reviews to {output_path}")
    print(f"   Average rating: {data['averageRating']}")
    print(f"   Last fetched: {data['lastFetched']}")


if __name__ == '__main__':
    main()
