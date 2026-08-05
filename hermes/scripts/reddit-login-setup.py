#!/usr/bin/env python3
"""
One-time Reddit login setup for SAA Homes via a Browserbase persistent context.

Flow:
1. Create/reuse a persistent Browserbase context ("saahomes-reddit")
2. Start a session bound to that context (persist=True) and open reddit.com/login
3. Print the session live-view URL for the human to log in (Google SSO OK)
4. Poll for login (reddit_session/token_v2 cookies), then persist a screenshot
5. On success the context keeps the login for all future posting sessions

Usage:
  .venv/bin/python3 hermes/scripts/reddit-login-setup.py [--timeout-min 25]
"""
import argparse, json, sys, time
from pathlib import Path
from datetime import datetime, timezone

ENV_PATH = Path("/opt/data/.env")
REPO = Path("/opt/data/workspace/saahomes-repo")
STATE_PATH = REPO / "hermes/backlinks/reddit/bb-context.json"

def load_env():
    env = {}
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--timeout-min", type=int, default=25)
    args = ap.parse_args()

    env = load_env()
    key = env.get("BROWSERBASE_API_KEY", "").replace(" ", "")
    pid = env.get("BROWSERBASE_PROJECT_ID", "").replace(" ", "")
    if not key or not pid:
        print("ERROR: BROWSERBASE_API_KEY / BROWSERBASE_PROJECT_ID missing from /opt/data/.env")
        sys.exit(1)

    from browserbase import Browserbase
    from playwright.sync_api import sync_playwright

    bb = Browserbase(api_key=key)

    # 1. Reuse or create the persistent context
    ctx_id = None
    if STATE_PATH.exists():
        try:
            ctx_id = json.loads(STATE_PATH.read_text()).get("context_id")
        except Exception:
            ctx_id = None
    if not ctx_id:
        created = bb.contexts.create(project_id=pid)
        ctx_id = created.id
        print(f"created new context: {ctx_id}")
    print(f"CONTEXT: {ctx_id}")

    # 2. Session bound to the persistent context
    session = bb.sessions.create(
        project_id=pid,
        timeout=args.timeout_min * 60,
        keep_alive=True,
        browser_settings={"context": {"id": ctx_id, "persist": True}},
        user_metadata={"purpose": "reddit-login-setup"},
    )
    sid = session.id
    print(f"SESSION: {sid}")
    print(f"CONNECT_URL: {session.connect_url}")

    # 3. Live-view URL for the human
    try:
        urls = bb.sessions.debug(sid)
        print(f"LIVE_URL: {urls.debugger_url}")
        print(f"LIVE_FULLSCREEN_URL: {urls.debugger_fullscreen_url}")
    except Exception as e:
        print(f"LIVE_URL_ERROR: {e}")

    # 4. Drive to the login page via CDP
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.connect_over_cdp(session.connect_url)
            ctx = browser.contexts[0]
            page = ctx.pages[0] if ctx.pages else ctx.new_page()
            page.goto("https://www.reddit.com/login/", wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(4000)
            print(f"PAGE_TITLE: {page.title()[:80]}")
            print("READY: waiting for human login via live view...")

            # 5. Poll for login cookies
            deadline = time.time() + args.timeout_min * 60
            logged_in = False
            while time.time() < deadline:
                page.wait_for_timeout(15000)
                cookies = ctx.cookies()
                names = [c["name"] for c in cookies]
                if any(n in ("reddit_session", "token_v2", "session_tracker") for n in names):
                    logged_in = True
                    break
                # also detect via DOM as fallback (login form gone)
                try:
                    body = page.inner_text("body")[:400]
                    if "Log in" not in body and "login" not in page.url and "reddit_session" in names:
                        logged_in = True
                        break
                except Exception:
                    pass

            if logged_in:
                page.goto("https://www.reddit.com/", wait_until="domcontentloaded", timeout=45000)
                page.wait_for_timeout(5000)
                shot = REPO / "hermes/backlinks/reddit/login-verified.png"
                page.screenshot(path=str(shot))
                print("LOGGED_IN: true")
                print(f"SCREENSHOT: {shot}")
            else:
                print("LOGGED_IN: false (timed out waiting for human login)")
            browser.close()
    except Exception as e:
        print(f"DRIVE_ERROR: {e}")

    # 6. Persist context id for the poster script
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps({
        "context_id": ctx_id,
        "session_id": sid,
        "updated": datetime.now(timezone.utc).isoformat(),
    }))
    print(f"STATE: {STATE_PATH}")

if __name__ == "__main__":
    main()
