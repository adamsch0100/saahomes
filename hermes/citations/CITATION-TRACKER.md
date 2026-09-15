# Citation Tracker — SAA Homes / Schwartz and Associates

> Last updated: 2026-09-15
> 2026-09-15 re-probe (box 54.241.204.220, 18:05 UTC): identical verdicts to Sep 14 —
> freelistingusa/opendi.com/opendi.us/lacartes/ibegin all 403 CF "Just a moment...";
> misterwhat 200 with Turnstile markers; fyple AU-gate ("outside Australia"); magicyellow
> parked (easyDNS); uscity signup 200 (fee-gate $29.99); threebestrated form 200 with
> reCAPTCHA. **Delta:** B2BListings 200 again (flapping 000→200) but still no real-estate
> category = integrity-gate skip. **Zero directory citations buildable from this IP, again.**
> Native browser DOWN (no Chromium in /root/.cache/ms-playwright or /opt/data/home); no
> OUTREACH_SMTP_*/IBEGIN_*/SERPER keys anywhere on host (/opt/data/.env gone; /root/.hermes/.env
> has only commented EMAIL_IMAP stubs) → email-confirm flow unavailable. **Archive.org pass
> today:** CDX sweep across 34 money pages (27 area + 7 core) → 6 previously-unlogged captures
> now VERIFIED + logged built (fort-lupton 09-11, niwot 09-09, champions 09-09, schools-to-home
> 09-09, about-us 09-09, contact 09-10); SPN 429 handled per discipline (roll, don't hammer).
> 34/34 money pages now have live, verified Archive.org captures.
> Status key: ✅ built | 🔄 in-progress | ❌ blocked | ⚠️ needs_human | 📝 drafted | 🗑️ dead

## Priority Platforms

| Platform | Status | NAP Match | Last Checked | Notes |
|----------|--------|-----------|-------------|-------|
| **ThreeBestRated.com** | ⚠️ needs_human | ✅ Canonical | 2026-09-08 | Steps 1-2 fully filled with canonical NAP. Blocked at Step 2 progression (progressive-disclosure validation). reCAPTCHA v2 at Step 4 is the sole automation blocker. Also needs CO license # (not in repo) and real customer reviews. See `references/threebestrated-field-map.md`. |
| **Write.as** | ⚠️ plain-text only | — | 2026-09-15 | Anonymous POST `/api/posts` returns `slug: null` + a token; the post is live at `https://write.as/{id}` BUT the anonymous body renders as **raw markdown** — `[anchor](url)` is NOT converted to an `<a href>` hyperlink, so it is a text mention, NOT a backlink. Do NOT log Write.as as `built`. (Sep 15: 8 rows corrected to `failed_verify - plain-text URL only`.) |
| **Telegraph** | ✅ working (nofollow) | — | 2026-09-15 | API works consistently. Used extensively for city guide backlinks. **Note:** telegra.ph renders links with `rel="nofollow" target="_blank"` — real hyperlinks but nofollow. |
| **Paste.rs** | ✅ working | — | 2026-07-16 | Simple pastebin-style posting works. |
| **GitHub (repo data files)** | ✅ working | — | 2026-09-15 | Classic PAT with `repo` scope pushes data files with branded links. Runs consistently. **Note:** github.com README viewer adds `rel="nofollow"` to markdown links. **DOFOLLOW path = GitHub Pages** — enable via `POST /repos/{owner}/{repo}/pages {source:{branch:main,path:/}}`, site serves at `https://{owner}.github.io/{repo}/` with plain `<a href>` (no rel) = genuine dofollow. Verified 2026-09-15: `adamsch0100.github.io/northern-colorado-real-estate-areas/` (15 dofollow links). |
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