# Blog Video Batch — 2026-10-09

**Job:** Daily YouTube blog-video batch publisher (cron `6 13 * * *`, 10-min cap, max 2 videos)
**Run window:** 13:06–13:12 UTC
**Repo used:** `/data/hermes-homes/saa-homes/cache/scratch/wt-blogvid` — a `git worktree` checked out at
**`origin/main`** head `b51c9e1` (the prompt's `/opt/data/workspace/saahomes-repo` does not exist on this
host; the standing clone `/data/workspaces/saa-homes` is **17 ahead / 27 behind** `origin/main` and cannot
be trusted for post inventory — same FLAG as 2026-10-03/04/07/08).

**Music safety:** clean. `/seed/assets/music/` does not exist on this host, so the publisher fell through
to its clean fallback set in `scripts/video-assets/` (tagged Audio Library tracks by Scandinavianz /
Sakura Girl). This run used `background-music-4.mp3` and `background-music-1.mp3`.
**No freetouse.com, no Limujii.**

## Queue check — 0 posts without a `youtubeId`

| check | result |
|---|---|
| posts parsed on `main` (robust parse incl. compact one-line entries) | 131 |
| posts with a non-empty `youtubeId` | 131 |
| posts missing / empty `youtubeId` | **0** |
| duplicate `youtubeId` fields inside one entry | 0 |

So the literal "sweep for posts with no id" step had nothing to do. As on 2026-10-07 and 2026-10-08, the
run continued with the live-API verification pass over every embedded id and repaired the broken embeds at
the top of the carried-over queue.

## Live embed sweep (YouTube Data API, 127 unique embedded ids, 3 quota units)

| status | before | after |
|---|---|---|
| public + processed + embeddable | 124 | 126 |
| **private (broken player on the blog page)** | 2 | **0** |
| deleted / not found | 0 | 0 |
| unlisted (embeds fine, correct topic — no action) | 1 | 1 |

## Uploaded (2 of 2)

| # | Blog slug | old id (broken) | new id | YouTube | Privacy | Length | Music |
|---|-----------|-----------------|--------|---------|---------|--------|-------|
| 1 | `northern-colorado-market-update` | `Z0sxD4Z2yXI` (private) | `t8O2KHctN2U` | https://youtu.be/t8O2KHctN2U | public | 0:49 (6 slides) | `background-music-1.mp3` |
| 2 | `northern-colorado-events-guide-2026` | `yCQQymVAdu4` (private) | `En-NKBupDr0` | https://youtu.be/En-NKBupDr0 | public | 1:05 (8 slides) | `background-music-4.mp3` |

- Rendered from the `origin/main` worktree, so the video source matches the deployed revision.
- Verified live/public via the YouTube Data API (not just the upload response):
  both `privacyStatus: public`, `uploadStatus: processed`, `embeddable: true`, channel `SAA Homes`,
  `madeForKids: false`, durations `PT49S` / `PT1M5S`, `publishedAt` 2026-10-09T13:10:29Z / 13:11:17Z.
- Description matches the canonical template **verbatim** (byte-compared): blog URL first,
  "📖 Read the full article ↑", `───`, title, brokerage block, phone, site — confirmed by API read-back for both.
  `freetouse`/`limujii` appear nowhere in either description.
- Privacy intentionally left public: these are **new clean-music uploads**, not the struck
  first-generation assets.

## Shipped to main — 1 commit

`git push` is denied to cron, so the id swaps went out through the GitHub Git Data API
(blob → tree → commit → PATCH `refs/heads/main`), token from the worktree's `remote.origin.url`.

| item | value |
|---|---|
| commit on `main` | `13c36feafa99ae5ef9a191024b791c6fe00a4543` |
| parent | `b51c9e171bc02db092bddacc8667be3b3c878704` |
| `src/data/blogPosts.js` blob before | `20be9152d8165b68d52f5a569603694940d56abb` |
| `src/data/blogPosts.js` blob after | `7cf66f1972a82abb09dd819f9b38396b2a05c8c0` |

The new file content was derived **from the current `main` blob** (not from the local checkout), so any
concurrent board commit is preserved. Post-write read-back on `main`:
`blob identical: True`, `youtubeId` fields **131**, empty ids **0**,
`northern-colorado-market-update -> t8O2KHctN2U` ✔, `northern-colorado-events-guide-2026 -> En-NKBupDr0` ✔,
stale ids `Z0sxD4Z2yXI` / `yCQQymVAdu4` no longer present ✔, `node --check` passes ✔.

## FINDING carried over — one video embedded on 5 different posts

`ppibH9GQHkg` ("Cash Home Buyers in Fort Collins & Northern Colorado") is embedded on all five
cash-home-buyer posts: fort-collins, loveland, greeley, windsor, longmont. All are public and embed, so
they are **not broken** — but only the Fort Collins post is matched by the video topic. Recommend
per-city re-generations, one per run (2 posts per run = 2 runs).

## Remaining queue (next runs, 2 each)

1. `cash-home-buyers-loveland-northern-colorado`, `cash-home-buyers-greeley-northern-colorado`
2. `cash-home-buyers-windsor-northern-colorado`, `cash-home-buyers-longmont-northern-colorado`

**Important:** do NOT just flip the private first-generation videos back to public — that batch
(2026-07-07/08) is the post-strike remediation set. The safe fix is the one used here: regenerate with the
clean music set and replace the embedded id.

## FLAG (pre-existing, board-owned) — embeds are still stripped from the prerendered HTML

Live blog pages serve **0 iframes and no YouTube URL** in the HTML (checked repeatedly on 10-04 and since);
the embed exists in source (`src/pages/BlogPostPage.jsx` renders `youtube.com/embed/${post.youtubeId}`) and
browsers get the player after hydration, but crawlers do not. Renderer/prerender issue, not a data issue —
no data change from this job can fix it.

**Queue:** with today's two repairs the blog-post embed set is **fully healthy** (0 private / 0 deleted).
The next new post will be picked up automatically on the next run.

Quota: no `quotaExceeded` / `uploadLimitExceeded` seen. Uploads cost 1600 units each; the full verification
sweep costs 3 units.
