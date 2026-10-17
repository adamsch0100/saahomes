# HANDOFF opencode-seo-fix-10385-55-indexnow-key-20261017

TASK: SEO FIX fix-10385-55 — add a public text file served at the site root as
`/19479462f9d59e0ca2ffb09f8b944c3f.txt` whose whole content is
`19479462f9d59e0ca2ffb09f8b944c3f` (the IndexNow ownership key; no other change).
Expected: Bing and the other IndexNow engines re-read shipped pages within hours,
not weeks. Site: https://saahomes.com.

STATUS: complete — **one new file, local diff only**. Not pushed, published,
paid, deployed or deleted. Awaiting operator Accept/Reject.

OUTPUT:
RESULT — SEO FIX fix-10385-55. Engine: OpenCode. Added one static file at the
site root: `public/19479462f9d59e0ca2ffb09f8b944c3f.txt`, content
`19479462f9d59e0ca2ffb09f8b944c3f` (32-byte key + trailing newline = 33 bytes,
matching the existing `public/dcb3e94b2a7bfa9d81019c0e5e6268c4.txt` key file).

Files changed:
- `public/19479462f9d59e0ca2ffb09f8b944c3f.txt` — new file (33 bytes). Newline
  only, no other content. IndexNow trims whitespace before comparing.

Why this path: `public/` is the static-site root. `npm run build` runs
`vite build`, which copies `public/*` verbatim into `dist/`, and the backend
serves `dist/` with `express.static(distPath, ...)`
(`backend/src/server.js:534`). So `public/<key>.txt` is served at
`https://saahomes.com/<key>.txt`. `dist/dcb3e94b...txt` shows the same file
already lands at the root from `public/`.

How a reader notices: after deploy, `https://saahomes.com/19479462f9d59e0ca2ffb09f8b944c3f.txt`
returns HTTP 200 with the key as its only content. Nothing else changes; no
existing page, link, table, heading, schema block, image or section was touched.

VERIFY: pending — needs the deploy, then `curl -s https://saahomes.com/19479462f9d59e0ca2ffb09f8b944c3f.txt`
should print the key and exit 200.
PROOF: `public/19479462f9d59e0ca2ffb09f8b944c3f.txt` (33 bytes) content equals the
key; sibling key file `public/dcb3e94b2a7bfa9d81019c0e5e6268c4.txt` (33 bytes)
served at root is the precedent.

SOURCES: task text fix-10385-55; `public/dcb3e94b2a7bfa9d81019c0e5e6268c4.txt`
(committed IndexNow key file); `package.json` build → `vite build`;
`vite.config.js`; `backend/src/server.js:237,534` (`distPath`, express.static);
`scripts/submit-indexnow.mjs:42` (key location convention `<SITE_URL>/<key>.txt`).
DECISIONS: only the requested file is added. The existing `INDEXNOW_KEY` in
`scripts/submit-indexnow.mjs` still names the old key; the task says "no other
change", so it is left untouched. No price, claim or legal line touched.
UNCERTAINTIES: this adds a second valid ownership key file; IndexNow accepts a
host with multiple key files, each self-verifying. Submitting under the new key
is out of scope for this fix.

NEXT OWNER: operator (Accept/Reject the diff), then board deploys and runs the
IndexNow submit.
DO NOT ASSUME: do not deploy, push or submit to IndexNow from this seat.
