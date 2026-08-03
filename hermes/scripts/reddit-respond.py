#!/usr/bin/env python3
"""
Reddit Response Poster — SAA Homes / Schwartz and Associates

Posts drafted, value-first replies to Reddit threads via PRAW (script-app API
credentials). The daily cron (reddit-opportunity-scan) drafts the reply text
with an LLM; this script handles the mechanical post + hard guardrails.

Requirements (in repo .env):
  REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET   (script app — reddit.com/prefs/apps)
  REDDIT_USERNAME, REDDIT_PASSWORD         (dedicated business account)

Usage:
  .venv/bin/python3 hermes/scripts/reddit-respond.py --file hermes/backlinks/reddit/response-YYYY-MM-DD.json
  .venv/bin/python3 hermes/scripts/reddit-respond.py --file ... --dry-run   # validate only, no post
  .venv/bin/python3 hermes/scripts/reddit-respond.py --thread <url> --text "reply"   # quick CLI path

Pack JSON schema (written by the cron agent):
{
  "thread_url": "https://www.reddit.com/r/FortCollins/comments/abc123/...",
  "subreddit": "FortCollins",
  "response": "Full comment text ...",
  "angle": "why this thread was chosen (logged for the report)",
  "allow_link": true | false       # optional, default true
}

Hard guardrails enforced here (not negotiable):
  1. No duplicate replies — responded thread IDs are recorded forever.
  2. Daily cap — max MAX_DAILY responses per calendar day (default 2).
  3. Per-subreddit link policy — r/RealEstate forbids links: any http(s) URL
     is stripped from the reply. r/FirstTimeHomeBuyer allows soft resource
     mentions only; other monitored subs allow links in context.
  4. No phone numbers / emails ever.
  5. All replies logged to hermes/backlinks/reddit/ with permalinks.
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import praw
import prawcore

# ─── Config ─────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = SCRIPT_DIR.parent / "backlinks" / "reddit"

MONITORED_SUBREDDITS = {
    "FortCollins", "loveland", "Greeley", "Colorado",
    "RealEstate", "FirstTimeHomeBuyer",
}
# Subs that ban self-promotion outright — strip every URL from replies.
NO_LINK_SUBREDDITS = {"RealEstate"}
# Default cap on replies per calendar day.
MAX_DAILY = int(os.environ.get("REDDIT_MAX_DAILY", "2"))

PHONE_RE = re.compile(r"[\d(][\d\s().-]{6,}\d")  # loose phone/contact guard


# ─── Env / client ───────────────────────────────────────────────────────────

def load_env() -> None:
    env_dirs = [
        Path(os.getcwd()) / ".env",
        Path.home() / ".hermes" / ".env",
        Path("/opt/data/.env"),
    ]
    for env_path in env_dirs:
        if env_path.exists():
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if "=" in line and not line.startswith("#"):
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def get_reddit() -> praw.Reddit | None:
    client_id = os.environ.get("REDDIT_CLIENT_ID", "")
    client_secret = os.environ.get("REDDIT_CLIENT_SECRET", "")
    username = os.environ.get("REDDIT_USERNAME", "")
    password = os.environ.get("REDDIT_PASSWORD", "")
    if not all([client_id, client_secret, username, password]):
        return None
    return praw.Reddit(
        client_id=client_id,
        client_secret=client_secret,
        user_agent="linux:saahomes:v1.0 (by /u/saahomes-bot)",
        username=username,
        password=password,
    )


def creds_missing() -> list[str]:
    missing = []
    for var in ("REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET", "REDDIT_USERNAME", "REDDIT_PASSWORD"):
        if not os.environ.get(var, ""):
            missing.append(var)
    return missing


# ─── Guardrail state ────────────────────────────────────────────────────────

def _read_json(path: Path, default):
    if path.exists():
        try:
            return json.loads(path.read_text())
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, default=str))


def load_responded() -> list[str]:
    """Thread IDs we've already replied to — never reply twice."""
    return _read_json(OUTPUT_DIR / "responded-threads.json", [])


def load_daily_count() -> dict:
    return _read_json(OUTPUT_DIR / "daily-count.json", {})


def record_response(thread_id: str, subreddit: str, permalink: str, angle: str) -> None:
    responded = load_responded()
    if thread_id not in responded:
        responded.append(thread_id)
        _write_json(OUTPUT_DIR / "responded-threads.json", responded)

    counts = load_daily_count()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    counts[today] = counts.get(today, 0) + 1
    # prune old entries (keep last 30 days)
    cutoff = {d for d in counts if d >= (datetime.now(timezone.utc).date().fromordinal(
        max(1, datetime.now(timezone.utc).date().toordinal() - 30)).isoformat())}
    counts = {d: c for d, c in counts.items() if d in cutoff}
    _write_json(OUTPUT_DIR / "daily-count.json", counts)

    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "thread_id": thread_id,
        "subreddit": subreddit,
        "permalink": permalink,
        "angle": angle,
    }
    log_path = OUTPUT_DIR / "responses.json"
    log = _read_json(log_path, [])
    log.append(log_entry)
    _write_json(log_path, log)


# ─── Sanitization ───────────────────────────────────────────────────────────

def sanitize_response(text: str, subreddit: str, allow_link: bool) -> tuple[str, list[str]]:
    """Apply hard guardrails to the drafted reply. Returns (clean_text, warnings)."""
    warnings = []
    original = text

    # 1. Never post contact info.
    if PHONE_RE.search(text) or re.search(r"\b(?:call|text|email)\s+(?:us|me)\b", text, re.I):
        text = re.sub(r"[\d(][\d\s().-]{6,}\d", "[contact removed]", text)
        warnings.append("phone/contact pattern removed")

    # 2. Subreddit link policy.
    if subreddit in NO_LINK_SUBREDDITS:
        before = len(re.findall(r"https?://\S+", text))
        text = re.sub(r"https?://\S+", "", text)
        text = re.sub(r"\s{2,}", " ", text).strip()
        if before:
            warnings.append(f"stripped {before} URL(s) — {subreddit} bans links")
    elif not allow_link:
        before = len(re.findall(r"https?://\S+", text))
        text = re.sub(r"https?://\S+", "", text)
        text = re.sub(r"\s{2,}", " ", text).strip()
        if before:
            warnings.append(f"stripped {before} URL(s) — allow_link=false")

    # 3. Trim runaway length (Reddit soft limit ~10k, keep replies tight).
    if len(text) > 1000:
        text = text[:1000].rstrip() + "…"
        warnings.append("trimmed to 1000 chars")

    if text != original:
        warnings.append("text modified by sanitizer")
    return text, warnings


# ─── Posting ────────────────────────────────────────────────────────────────

def post_reply(reddit: praw.Reddit, thread_url: str, text: str) -> tuple[str, str]:
    """Post a comment. Returns (thread_id, permalink)."""
    submission = reddit.submission(url=thread_url)
    submission._fetch()  # force fetch so author/permalink are populated
    comment = submission.reply(text)
    return submission.id, f"https://www.reddit.com{comment.permalink}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Post a drafted reply to a Reddit thread.")
    parser.add_argument("--file", help="Path to response pack JSON")
    parser.add_argument("--thread", help="Thread URL (CLI path)")
    parser.add_argument("--text", help="Reply text (CLI path)")
    parser.add_argument("--dry-run", action="store_true", help="Validate only — do not post")
    args = parser.parse_args()

    load_env()

    if args.file:
        pack_path = Path(args.file)
        if not pack_path.exists():
            print(f"❌ Pack not found: {pack_path}")
            return 2
        pack = json.loads(pack_path.read_text())
        thread_url = pack.get("thread_url", "")
        subreddit = pack.get("subreddit", "")
        text = pack.get("response", "")
        angle = pack.get("angle", "")
        allow_link = pack.get("allow_link", True)
    elif args.thread and args.text:
        thread_url, subreddit = args.thread, ""
        text, angle, allow_link = args.text, "CLI direct post", True
    else:
        parser.print_help()
        return 2

    if not thread_url or not text:
        print("❌ Pack must include thread_url and response.")
        return 2

    # Credential check.
    missing = creds_missing()
    if missing:
        print("❌ SETUP REQUIRED — missing env vars: " + ", ".join(missing))
        print("   Create a 'script' app at https://www.reddit.com/prefs/apps and add")
        print("   REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET / REDDIT_USERNAME / REDDIT_PASSWORD to .env")
        return 1

    # Derive thread id + subreddit from URL when not provided.
    m = re.search(r"/comments/([a-z0-9]+)", thread_url)
    if not m:
        print(f"❌ Not a valid Reddit thread URL: {thread_url}")
        return 2
    thread_id = m.group(1)
    if not subreddit:
        m2 = re.search(r"/r/([A-Za-z0-9_]+)/", thread_url)
        subreddit = m2.group(1) if m2 else ""

    # Dedup guardrail.
    if thread_id in load_responded():
        print(f"⏭️  Already responded to thread {thread_id} — skipping.")
        return 0

    # Sanitize.
    clean_text, warnings = sanitize_response(text, subreddit, allow_link)
    if clean_text != text:
        print("⚠️  Sanitizer warnings: " + "; ".join(warnings))

    reddit = get_reddit()
    if reddit is None:
        print("❌ Could not build Reddit client.")
        return 1

    if args.dry_run:
        print("🔍 DRY RUN — would post this reply:")
        print("-" * 60)
        print(f"Thread: {thread_url}")
        print(f"Subreddit: {subreddit or '(from URL)'}")
        print("-" * 60)
        print(clean_text)
        print("-" * 60)
        print(f"Length: {len(clean_text)} chars | allow_link: {allow_link}")
        return 0

    # Daily cap guardrail.
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    daily = load_daily_count()
    if daily.get(today, 0) >= MAX_DAILY:
        print(f"⏸️  Daily cap reached ({MAX_DAILY}/day) — not posting. Try again tomorrow.")
        return 0

    try:
        posted_id, permalink = post_reply(reddit, thread_url, clean_text)
    except prawcore.exceptions.OAuthException as e:
        print(f"❌ Auth failed (check client_id/secret/username/password): {e}")
        return 1
    except prawcore.exceptions.Forbidden:
        print("❌ Forbidden — account lacks permission or is banned in this sub.")
        return 1
    except prawcore.exceptions.NotFound:
        print(f"❌ Thread not found: {thread_url}")
        return 1
    except prawcore.exceptions.RateLimit as e:
        print(f"⏸️  Rate limited: {e}")
        return 1
    except prawcore.exceptions.ResponseException as e:
        print(f"❌ Reddit API error ({e.response.status_code}): {e}")
        return 1
    except Exception as e:
        print(f"❌ Unexpected error: {type(e).__name__}: {e}")
        return 1

    record_response(posted_id, subreddit, permalink, angle)
    print(f"✅ Reply posted! Permalink: {permalink}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
