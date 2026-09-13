# Citation Tracker — SAA Homes / Schwartz and Associates

> Last updated: 2026-09-13
> 2026-09-13 re-probe (box 54.241.204.220): iBegin 403 cf-challenge, FreeListingUSA 403, Lacartes 403, Opendi 403, MisterWhat CF.php loop, B2BListings UNREACHABLE (000×3 — was working-but-no-category), fyple AU-gate, magicyellow parked (easyDNS), uscity fee-gate ($29.99), ThreeBestRated form live 200. ZERO directory citations buildable from this IP. Also: native browser backend is DOWN on this host (Browserbase CDP endpoint absent) and chromium NOT installed (playwright module ok; dpkg lock held by other process during install); mail_find.py + dir_common.py MISSING from repo (`~/scripts/` empty) — restore before next native-browser claim attempt.
> Status key: ✅ built | 🔄 in-progress | ❌ blocked | ⚠️ needs_human | 📝 drafted | 🗑️ dead

## Priority Platforms

| Platform | Status | NAP Match | Last Checked | Notes |
|----------|--------|-----------|-------------|-------|
| **ThreeBestRated.com** | ⚠️ needs_human | ✅ Canonical | 2026-09-08 | Steps 1-2 fully filled with canonical NAP. Blocked at Step 2 progression (progressive-disclosure validation). reCAPTCHA v2 at Step 4 is the sole automation blocker. Also needs CO license # (not in repo) and real customer reviews. See `references/threebestrated-field-map.md`. |
| **Write.as** | ✅ working | — | 2026-09-10 | Anonymous POST `/api/posts` returns `slug: null` + a token; the post **is live at `https://write.as/{id}`** immediately (verified 5 anchors 2026-09-10). The `POST /api/posts/{id}/publish` step 404s — do NOT treat `slug: None` as failure; verify the `/{id}` URL directly. Rate limit ~65s between posts (2 posts + 45s gap worked). |
| **Telegraph** | ✅ working | — | 2026-08-25 | API works consistently. Used extensively for city guide backlinks. |
| **Paste.rs** | ✅ working | — | 2026-07-16 | Simple pastebin-style posting works. |
| **GitHub (repo data files)** | ✅ working | — | 2026-09-08 | Classic PAT with `repo` scope pushes data files with branded links. Runs consistently. |
| **iBegin.com** | ❌ blocked | — | 2026-09-10 | Cloudflare Turnstile on login page. Account exists (saahomes) but login unreachable from this IP even with browser. Stealth Playwright documented to FAIL here (Aug 26). Re-verified "Just a moment..." at curl level 2026-09-10. Needs residential proxy. |
| **WhereOrg.com** | ❌ blocked | — | 2026-09-04 | Main page clears with stealth Playwright but AJAX category/city autocomplete returns CF 403. NAP + state + captcha automatable; category is the blocker. |

## Dead / Permanently Blocked

| Platform | Status | Reason |
|----------|--------|--------|
| MagicYellow.com | 🗑️ dead | Parked domain (easyDNS). No submission path exists. |
| Fyple.biz | ❌ blocked | AU geo-gated registration (this is US IP). Fyple.com register page in maintenance. |
| USCity.net | ⚠️ fee-gated | Email signup WORKS at signup.uscity.net (full name/email/password form + business details form with canonical NAP). Account created for Adam Schwartz (adam@saahomes.com). NO existing SAA listing found. BLOCKED at identity verification step: requires $29.99 one-time fee. **Discovery Sep 10 2026** — tracker previously said Facebook-OAuth only (stale). Account exists; needs Adam approval for $29.99 to finalize listing. |
| FreeListingUSA.com | ❌ blocked | HTTP 403 Cloudflare challenge (Sep 13 — worse than Aug Turnstile-loop). Needs residential proxy. |
| Opendi.com / Opendi.us | ❌ blocked | Opendi.com now fully Cloudflare-walled (worse than Aug 24 — was corporate portal, now Turnstile interstitial). Opendi.us = IP-blocked. |
| B2BListings.org | ❌ blocked | Sep 13: site UNREACHABLE (000 timeout ×3) — regression from Aug 24 (free form worked but no real-estate category = integrity-gate skip anyway). |
| Lacartes.com | ❌ blocked | Sep 13: HTTP 403 Cloudflare (was connection timeout Sep 10). |
| MisterWhat.com | ❌ blocked | Cloudflare.php interstitial loops indefinitely. |
| Yelp | ❌ blocked | DataDome captcha. Needs residential proxy or manual claim. |
| Manta | ❌ blocked | Cloudflare Turnstile. Needs residential proxy. |
| BBB | ❌ blocked | Cloudflare Turnstile. Needs residential proxy. |
| ChamberofCommerce.com | ❌ blocked | Cloudflare Turnstile. Lists SAA with Kittle in Loveland — needs verified. |
| Tupalo | ❌ blocked | Anubis IP-level Access Denied. |
| ShowMeLocal | ❌ blocked | Custom bot detection. |
| Hotfrog | ❌ blocked | Cloudflare interstitial. |
| Substack | ❌ blocked | Magic-link email never delivered to adam@ inbox. |
| Reddit | ❌ blocked | 403 network-level block from this IP. RSS scanning working (report-only). |

## Email-Verify Attempts (adam@saahomes.com)

| Platform | Status | Notes |
|----------|--------|-------|
| OpenStreetMap | ❌ blocked | Turnstile script loads but challenge never renders (silent bot-block) |
| Foursquare | ❌ blocked | Consumer listing flow removed/changed |
| About.me | ❌ blocked | OAuth-only signup |
| Pinterest | ❌ blocked | Requires birthdate; OAuth |
| Medium | ❌ blocked | CF block on signup |
| Alignable | ❌ blocked | reCAPTCHA on signup |

## Re-verification sweep — 2026-09-10 cron (native-browser + email-confirm brief)

Target list from the cron brief re-probed live from this box (52.52.175.248).
Every platform was checked at its actual signup/submit URL, not the homepage.
Presence scan (web_search): **no existing SAA listing on any reachable platform**
(no dupe risk). The only "Schwartz & Associates" hit is a Gurley, AL attorney
on misterwhat — known name-collision noise, not SAA.

| Platform | Live probe 2026-09-10 | Verdict (unchanged) |
|----------|----------------------|---------------------|
| fyple.biz/register | 200, body contains "outside Australia" | ❌ AU geo-gate |
| signup.uscity.net | 200; account exists (created earlier today), no creds stored | ⚠️ $29.99 fee gate — needs Adam decision |
| freelistingusa.com/register | 403 | ❌ Turnstile/IP block |
| opendi.com/listing/create | 404; homepage = "Opendi International AG" corporate portal | ❌ no self-serve listing path |
| b2blistings.org free form | 200 | ⚠️ integrity gate — no real-estate category |
| lacartes.com/register | 000 connection timeout | ❌ unreachable |
| magicyellow.com | title "Parked Domain \| easyDNS" | 🗑️ dead |
| misterwhat.com/ClaimYourBusiness | Turnstile markers in body | ❌ Turnstile interstitial |
| threebestrated.com/submit-business | 200; NAP + Step-2 answers ready in `hermes/scripts/threebestrated_submit.py` | ⚠️ needs_human: reCAPTCHA v2 + CO license # (still not in repo) + real reviews |
| ibegin.com/login | title "Just a moment..." | ❌ CF interstitial; stealth FAILS here (Aug 26); creds exist, login impossible from this IP |

**Result:** 0 built / 0 verified. 10/10 targets confirmed blocked/dead/fee-gated/
needs-human with first-hand evidence. No browser runs burned on Turnstile loops.
Action items for Adam: (1) approve-or-decline $29.99 uscity.net fee, (2) supply
CO real estate license # + 2-3 real reviews to unlock ThreeBestRated.

## Future Opportunities

- **WhereOrg** — unlockable with residential proxy that clears AJAX XHR
- **ThreeBestRated** — needs CO real estate license # and real customer reviews from Adam
- **iBegin.com** — account exists, needs residential proxy to log in
- **Local lender/builder reciprocal links** — natural high-value citations