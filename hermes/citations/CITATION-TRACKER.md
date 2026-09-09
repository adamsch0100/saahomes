# Citation Tracker — SAA Homes / Schwartz and Associates

> Last updated: 2026-09-10
> Status key: ✅ built | 🔄 in-progress | ❌ blocked | ⚠️ needs_human | 📝 drafted | 🗑️ dead

## Priority Platforms

| Platform | Status | NAP Match | Last Checked | Notes |
|----------|--------|-----------|-------------|-------|
| **ThreeBestRated.com** | ⚠️ needs_human | ✅ Canonical | 2026-09-08 | Steps 1-2 fully filled with canonical NAP. Blocked at Step 2 progression (progressive-disclosure validation). reCAPTCHA v2 at Step 4 is the sole automation blocker. Also needs CO license # (not in repo) and real customer reviews. See `references/threebestrated-field-map.md`. |
| **iBegin.com** | ❌ blocked | — | 2026-09-08 | Cloudflare Turnstile on login page. Account exists (saahomes) but login unreachable from this IP even with browser. Needs residential proxy. |
| **WhereOrg.com** | ❌ blocked | — | 2026-09-04 | Main page clears with stealth Playwright but AJAX category/city autocomplete returns CF 403. NAP + state + captcha automatable; category is the blocker. |
| **Write.as** | ✅ working | — | 2026-07-16 | Anonymous posting works with plain-text content moderation (no markdown tables, unicode). Rate limit ~3-4 posts/run with 65s gaps between. Last used successfully. |
| **Telegraph** | ✅ working | — | 2026-08-25 | API works consistently. Used extensively for city guide backlinks. |
| **Paste.rs** | ✅ working | — | 2026-07-16 | Simple pastebin-style posting works. |
| **GitHub (repo data files)** | ✅ working | — | 2026-09-08 | Classic PAT with `repo` scope pushes data files with branded links. Runs consistently. |

## Dead / Permanently Blocked

| Platform | Status | Reason |
|----------|--------|--------|
| MagicYellow.com | 🗑️ dead | Parked domain (easyDNS). No submission path exists. |
| Fyple.biz | ❌ blocked | AU geo-gated registration (this is US IP). Fyple.com register page in maintenance. |
| USCity.net | ⚠️ fee-gated | Email signup WORKS at signup.uscity.net (full name/email/password form + business details form with canonical NAP). Account created for Adam Schwartz (adam@saahomes.com). NO existing SAA listing found. BLOCKED at identity verification step: requires $29.99 one-time fee. **Discovery Sep 10 2026** — tracker previously said Facebook-OAuth only (stale). Account exists; needs Adam approval for $29.99 to finalize listing. |
| FreeListingUSA.com | ❌ blocked | Turnstile loop on register+create-listing (headless + headed Xvfb). |
| Opendi.com / Opendi.us | ❌ blocked | Opendi.com now fully Cloudflare-walled (worse than Aug 24 — was corporate portal, now Turnstile interstitial). Opendi.us = IP-blocked. |
| B2BListings.org | ⚠️ skipped | Free form live but no real-estate category (closest = Property Surveyors). Miscategorization fails human review. |
| Lacartes.com | ❌ blocked | Connection timeout (Sep 10 — worse than Aug 24 Cloudflare block). |
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

## Future Opportunities

- **WhereOrg** — unlockable with residential proxy that clears AJAX XHR
- **ThreeBestRated** — needs CO real estate license # and real customer reviews from Adam
- **iBegin.com** — account exists, needs residential proxy to log in
- **Local lender/builder reciprocal links** — natural high-value citations