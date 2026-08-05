#!/usr/bin/env python3
"""
Buffer Social Post Automation — SAA Homes

Usage:
  python3 buffer-post.py --help
  python3 buffer-post.py --list-channels
  python3 buffer-post.py --post "caption text" --channel CHANNEL_ID
  python3 buffer-post.py --post "caption" --channel ID --image https://saahomes.com/images/img.jpg
  python3 buffer-post.py --file /path/to/social-package.json

Reads BUFFER_API_KEY from environment or .env file.
"""

import os, sys, json, argparse
from urllib.request import Request, urlopen
from urllib.error import URLError

API_URL = "https://api.buffer.com/graphql"

def get_token():
    """Get Buffer API token from env or .env file."""
    token = os.environ.get("BUFFER_API_KEY")
    if not token:
        env_path = os.path.expanduser("~/.hermes/.env")
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("BUFFER_API_KEY="):
                        token = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
    if not token:
        # Also check repo .env
        repo_env = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env")
        if os.path.exists(repo_env):
            with open(repo_env) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("BUFFER_API_KEY="):
                        token = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
    return token

def graphql(query, variables=None):
    """Execute a GraphQL query against Buffer API."""
    token = get_token()
    if not token:
        print("ERROR: BUFFER_API_KEY not found in environment or .env")
        sys.exit(1)
    
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    
    data = json.dumps(payload).encode("utf-8")
    req = Request(API_URL, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    
    try:
        resp = urlopen(req)
        result = json.loads(resp.read().decode("utf-8"))
        if "errors" in result:
            print(f"API Error: {json.dumps(result['errors'], indent=2)}")
            sys.exit(1)
        return result.get("data", {})
    except URLError as e:
        print(f"Connection Error: {e}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Parse Error: {e}")
        sys.exit(1)

def list_channels():
    """List all connected Buffer channels."""
    org_id = get_org_id()
    result = graphql(f"""
        query {{
            channels(input: {{ organizationId: "{org_id}" }}) {{
                id
                service
                type
                name
                avatar
            }}
        }}
    """)
    channels = result.get("channels", [])
    if not channels:
        print("No channels connected. Connect social accounts in Buffer first.")
        return []
    
    print(f"\nConnected Channels ({len(channels)}):")
    print(f"{'ID':30s} {'Service':15s} {'Name'}")
    print("-" * 80)
    for ch in channels:
        print(f"{ch['id']:30s} {ch['service']:15s} {ch['name']}")
    print()
    return channels

def get_org_id():
    """Get the organization ID for the account."""
    result = graphql("""
        query {
            account {
                organizations { id name }
            }
        }
    """)
    orgs = result.get("account", {}).get("organizations", [])
    if orgs:
        return orgs[0]["id"]
    print("ERROR: No organization found")
    sys.exit(1)

def create_post(channel_id, text, image_url=None, scheduled_at=None, link_url=None):
    """
    Create a post in Buffer for a specific channel.

    Args:
        channel_id: Buffer channel ID
        text: Post caption/text
        image_url: Optional image URL
        scheduled_at: Optional ISO 8601 datetime for scheduling
        link_url: Optional CTA link for GBP posts (from pack's promoting.url)
    """
    variables = {
        "input": {
            "channelId": channel_id,
            "text": text,
            "mode": "addToQueue",
            "schedulingType": "automatic",
            "assets": [],
        }
    }
    
    if image_url:
        variables["input"]["assets"].append({
            "image": {
                "url": image_url
            }
        })
    
    if scheduled_at:
        variables["input"]["mode"] = "customScheduled"
        variables["input"]["dueAt"] = scheduled_at
    
    # Add platform-specific metadata
    if channel_id == "6a662faf4b2d03035f44203f":
        # Google Business Profile
        variables["input"]["metadata"] = {
            "google": {
                "type": "whats_new",
                "detailsWhatsNew": {
                    "button": "learn_more",
                    "link": link_url or "https://saahomes.com/blog/fort-collins-housing-market-mid-2026/"
                }
            }
        }
    elif channel_id == "6a662feb4b2d03035f44269f":
        # Facebook
        variables["input"]["metadata"] = {
            "facebook": {
                "type": "post"
            }
        }
    
    result = graphql("""
        mutation createPost($input: CreatePostInput!) {
            createPost(input: $input) {
                ... on PostActionSuccess {
                    post {
                        id
                        status
                        text
                        createdAt
                        dueAt
                    }
                }
                ... on MutationError {
                    message
                }
            }
        }
    """, variables)
    
    post_result = result.get("createPost", {})
    if "post" in post_result:
        post = post_result["post"]
        print(f"✅ Post created: {post['id']}")
        print(f"   Status: {post.get('status', 'N/A')}")
        print(f"   Text preview: {post.get('text', '')[:60]}...")
        if post.get("createdAt"):
            print(f"   Created: {post['createdAt']}")
        if post.get("dueAt"):
            print(f"   Scheduled for: {post['dueAt']}")
        return post
    else:
        print(f"❌ Failed: {post_result.get('message', 'Unknown error')}")
        return None

def image_check(url):
    """Return (ok, message). Empty URL = allowed (text-only). Black placeholder
    or unreachable/non-image URL = hard fail (Adam: no black images, Aug 2026)."""
    if not url:
        return True, "no image (text-only post, allowed)"
    if "blog-default-black" in url:
        return False, "uses blog-default-black.jpg placeholder — create a real branded image first"
    try:
        req = Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(req, timeout=15) as resp:
            ct = resp.headers.get_content_type() or ""
            if ct.startswith("image/"):
                return True, f"serves {ct}"
            return False, f"URL serves {ct or 'unknown content-type'}, not an image"
    except Exception as e:
        return False, f"image URL unreachable: {e}"


def post_from_file(filepath):
    """Post social content from a JSON pack file."""
    with open(filepath) as f:
        pack = json.load(f)
    
    print(f"Posting from: {filepath}")
    print(f"Subject: {pack.get('subject', 'N/A')}")
    
    channels = list_channels()
    if not channels:
        return
    
    # Map platform names to channel IDs
    platform_map = {}
    for ch in channels:
        svc = ch["service"].lower()
        platform_map[svc] = ch["id"]
    
    platforms = pack.get("platforms", [])
    results = []
    promoting = pack.get("promoting", {})
    link_url = promoting.get("url", "") if promoting else ""

    # HARD IMAGE GATE: refuse the whole pack if any platform's image is the
    # black placeholder or unreachable — the agent must fix it before posting.
    image_failures = []
    for plat in platforms:
        img = plat.get("image_url") or plat.get("image") or ""
        ok, msg = image_check(img)
        if not ok:
            image_failures.append(f"  - {plat.get('name')}: {msg}")
    if image_failures:
        print("❌ IMAGE GATE FAILED — aborting (no posts sent). Fix images first:")
        for line in image_failures:
            print(line)
        return None
    print("✅ Image gate passed — no black/broken images in this pack.")
    
    for plat in platforms:
        name = plat["name"].lower()
        caption = plat.get("caption", "")
        image_url = plat.get("image_url", "")
        
        # Map common platform names to Buffer service names
        channel_id = None
        if "google" in name or "gbp" in name or "business" in name:
            channel_id = platform_map.get("googlebusiness")
        elif "facebook" in name or "fb" in name:
            channel_id = platform_map.get("facebook")
        elif "x" in name or "twitter" in name:
            channel_id = platform_map.get("twitter")
        
        if not channel_id:
            print(f"  ⚠️ No connected channel for '{name}'. Skipping.")
            continue
        
        print(f"  📤 Posting to {plat['name']}...")
        result = create_post(channel_id, caption, image_url, link_url=link_url)
        if result:
            results.append({
                "platform": plat["name"],
                "status": result.get("status", "posted"),
                "scheduled_at": result.get("dueAt"),
                "buffer_id": result["id"],
            })
    
    # Write scheduled_posts back into the pack so the email script can show
    # real per-platform times instead of a vague "post by" deadline.
    if results:
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                pack_data = json.load(f)
            pack_data["scheduled_posts"] = [
                {"platform": r["platform"], "status": r["status"], "scheduled_at": r["scheduled_at"]}
                for r in results if r.get("scheduled_at")
            ]
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(pack_data, f, indent=2, ensure_ascii=False)
            print(f"📝 Wrote scheduled_posts with {len(pack_data['scheduled_posts'])} entries to {filepath}")
        except OSError as err:
            print(f"⚠️ Could not write scheduled_posts to pack: {err}", file=sys.stderr)
    
    return results

def main():
    parser = argparse.ArgumentParser(description="Buffer Social Post Automation")
    parser.add_argument("--list-channels", action="store_true", help="List connected channels")
    parser.add_argument("--post", type=str, help="Post caption text")
    parser.add_argument("--channel", type=str, help="Channel ID to post to")
    parser.add_argument("--image", type=str, help="Image URL for the post")
    parser.add_argument("--file", type=str, help="JSON pack file to post from")
    parser.add_argument("--schedule", type=str, help="ISO 8601 datetime to schedule the post")
    
    args = parser.parse_args()
    
    if args.list_channels:
        list_channels()
    elif args.file:
        post_from_file(args.file)
    elif args.post and args.channel:
        create_post(args.channel, args.post, args.image, args.schedule)
    else:
        parser.print_help()
        print("\nExamples:")
        print("  python3 buffer-post.py --list-channels")
        print('  python3 buffer-post.py --post "Hello world" --channel CHANNEL_ID')
        print("  python3 buffer-post.py --file outreach/pending/social-package.json")

if __name__ == "__main__":
    main()
