# HANDOFF canonical-form-drift-20261017

TASK: SEO FIX fix-06521-53 — template: [crawl-canonical-form-drift] use one URL
form everywhere: internal links, canonicals and sitemap all on the trailing-slash
rule the pages already canonicalise to, so no internal link lands on a 301
(sitewide). Expected: the site audit no longer reports it. Site:
https://saahomes.com.

STATUS: complete — **no code change**. The site already meets the rule; the
audit warning is caused by the rule's handling of the root canonical. Nothing
pushed, published, paid, deployed or deleted. No file edited.

OUTPUT:
RESULT — SEO FIX fix-06521-53. Engine: OpenCode. No change was made: internal
links, canonicals and the sitemap already use the trailing-slash form. The one
canonical the audit counts as "no-trailing-slash" is the homepage
(`https://saahomes.com/`), because SEOmator's rule counts a path as trailing-slash
only when `pathname.length > 1` — "/" fails that test. That is a rule artifact,
not site drift.

What the audit actually says (live, 2026-10-17):
- Only `crawl-canonical-form-drift` warns. Every adjacent check passes:
  `crawl-canonical-redirect` = "Canonical is self-referencing and does not
  redirect"; `links-redirect-chains` = "All 20 sampled internal link(s) resolve
  directly"; `crawl-sitemap-non-canonical` = "No sitemap URLs canonicalise to a
  different URL (25 checked)"; all `core-canonical-*` pass.

Proof:
- 25-page SEOmator crawl (same seed/flags as the board: `https://saahomes.com/`
  `--crawl -m 25`): 25 canonicals. 24 end in `/`; the only non-slash form is the
  homepage `https://saahomes.com/`. The rule's `formOf()` computes
  `slash = url.pathname.length > 1 && url.pathname.endsWith("/")`
  (`@seomator/seo-audit` 5.1.0, `dist/index.js`; same code in 7.0.0), so `/`
  scores `false` while `/northern-colorado-areas/.../` scores `true` → the set
  has two forms → warn.
- Live sitemap: 692 URLs, 0 without a trailing slash.
- Source scan of every `to=`/`href=` internal route in `src/`: 0 without a
  trailing slash (the one exception is `/admin`, an app-console link that is not
  a crawlable page and is not in any sitemap).
- Live: `https://saahomes.com/for-sellers` → 301 → `/for-sellers/`; no internal
  link points at the non-slash form.

Why no edit: every way to silence the rule on the site is worse than the warn:
1. Drop the homepage canonical → introduces `core-canonical-present` (weight 10).
2. Reverse the sitewide convention to no-trailing-slash canonicals → the indexed
   URLs (GSC: `/northern-colorado-areas/greeley/pine-ridge-estates/`, etc.) would
   move, and a no-slash canonical points at a URL that 301s, so
   `crawl-canonical-redirect` (weight 15) would fire instead.
3. A malformed `https://saahomes.com//` canonical would parse as trailing-slash
   but points the homepage at a duplicate URL.
All three trade a weight-6 false positive for a real problem or a sitewide
ranking risk.

The correct fix is to the rule: count `/` as trailing-slash, e.g.
`slash: url.pathname === "/" || url.pathname.endsWith("/")` in
`@seomator/seo-audit` `src/rules/crawl/canonical-form-drift.ts`. That file is
outside this repo and is not ours to ship.

How a reader notices: nothing changes — because nothing on the site was wrong.
The board should stop attributing this warning to URL-form drift.

VERIFY: pending — no diff to verify; evidence above is live + source. After the
board's next audit this rule is expected to remain until the rule engine treats
the root path as trailing-slash.
PROOF: `/tmp/opencode/audit25.json` (25-page crawl, 2026-10-17) — 25 canonicals,
24 trailing-slash, root `/` the only exception; live sitemap 692/692
trailing-slash; `src/` internal-link scan 0 non-slash route links.

DECISION NEEDED (Adam / ottoBOSS): dismiss fix-06521-53 as a false positive
(recommended), or explicitly authorize reversing the site's trailing-slash URL
convention. The site's own convention should not be reversed for a weight-6
rule artifact.

SOURCES: task text fix-06521-53 (`seo/queue.json`); live https://saahomes.com
(curl + 25-page SEOmator crawl, 2026-10-17); `@seomator/seo-audit` 5.1.0
(`/usr/local/lib/node_modules/@seomator/seo-audit/dist/index.js`,
`canonical-form-drift` `formOf`, and the passing adjacent rules);
`/app/openbot/seoaudit.py` (board audit invocation) and
`/data/org/projects/saa-homes/seo/audit.json` (2026-10-17).
DECISIONS: do not reverse the site's indexed trailing-slash URL convention for
a rule artifact; do not add a malformed canonical; do not delete the homepage
canonical. No price, claim or legal line touched.
UNCERTAINTIES: the board runs SEOmator 5.1.0 (confirmed), so the root artifact
will recur on the next audit. If the board later upgrades to a version that
counts `/` as trailing-slash, the warning clears with no site change.
NEXT OWNER: ottoBOSS / operator — Accept this finding (no diff) and dismiss
fix-06521-53 as a false positive, or send back a decision to change the site's
URL convention.
DO NOT ASSUME: that the pre-existing dirty working tree belongs to this job (it
does not); that reversing trailing slashes would be harmless.
SEAT: saa-homes
ENGINE: OpenCode
AT: 2026-10-17T00:00:00Z
