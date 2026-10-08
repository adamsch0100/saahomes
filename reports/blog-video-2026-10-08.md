# Blog Video Batch — 2026-10-08

**Job:** Daily YouTube blog-video batch publisher (cron, 10-min cap, max 2 videos)
**Run window:** 13:08–13:13 UTC

## Queue check — 0 posts without a `youtubeId`

`src/data/blogPosts.js` on **`origin/main`** (standing clone `/data/workspaces/saa-homes` is
21 behind / 15 ahead of `origin/main` and cannot be trusted for post inventory — same FLAG as
2026-10-04 and 2026-10-07). Truth read from the GitHub contents API at ref `main`.

| check | result |
|---|---|
| posts parsed on `main` head `8f157d4b` | 125 |
| posts with non-empty `youtubeId` | 125 |
| posts missing / empty `youtubeId` | **0** |
| `re`-level malformed id fields | 0 |

So the literal "sweep for posts with no id" step had nothing to do. As on 2026-10-07, the run
continued with the live-API verification pass over every embedded id (3 quota units) and repaired
the broken embeds at the top of the queue.

## Live embed sweep (YouTube Data API, all 127 unique embedded ids)

| status | count |
|---|---|
| public + embeddable + processed | 122 |
| **private (broken player on blog)** | 4 |
| deleted / not found | 0 |
| unlisted (embeds fine, correct topic) | 1 — `northern-colorado-market-update-july-2026` |

Remaining broken embeds after today: **2 private** (below) + 4 topic-mismatched cash-home-buyer posts.

## Uploaded (2)

| # | Blog slug | old id (broken) | new id | YouTube | Privacy | Length | Music |
|---|-----------|-----------------|--------|---------|---------|--------|-------|
| 1 | `buying-a-home-in-greeley` | `-QH0MqSSS7A` (private) | `5MemaJazo5E` | https://youtu.be/5MemaJazo5E | public | 1:05 (8 slides) | `scripts/video-assets/background-music-4.mp3` |
| 2 | `selling-your-home-in-loveland` | `8sR3GlX1Mw4` (private) | `XljDXMkiDso` | https://youtu.be/XljDXMkiDso | public | 1:05 (8 slides) | `scripts/video-assets/background-music-2.mp3` |

- Rendered from a **fresh worktree of `origin/main`** (`cache/scratch/wt-blogvid`, detached at `8f157d4b`), so the on-site deploy and the video source are the same revision.
- `/seed/assets/music/` does not exist on this host → publisher fell through to the clean fallback set (`scripts/video-assets/background-music-{1..4}.mp3`, Audio Library tracks). **No freetouse.com, no Limujii.**
- Verified live/public via the YouTube Data API (not just the upload response): both
  `privacyStatus: public`, `uploadStatus: processed`, `embeddable: true`, `duration: PT1M5S`,
  channel `SAA Homes`, `publishedAt` 2026-10-08T13:10:03Z / 13:10:47Z.
- Description matches the canonical template verbatim (blog URL first, "Read the full article ↑", `───`, title, brokerage block, phone, site) — byte-checked for both.
- Privacy intentionally left public: these are **new** clean-music uploads, not the struck first-generation assets.

## Shipped to main (2 commits)

`git push` is denied to cron, so the id swaps went out through the GitHub Git Data API
(blob → tree → commit → PATCH `refs/heads/main`) with a read-back verify.

| slug | commit on main | `src/data/blogPosts.js` blob |
|---|---|---|
| `buying-a-home-in-greeley` | `d48704f1f5` | `fe2543bd0f` |
| `selling-your-home-in-loveland` | `b89a9b3ae3` | (2nd commit, byte-verified) |

Post-write verification on `main` head `b89a9b3ae3`:
- `buying-a-home-in-greeley -> 5MemaJazo5E` ✔
- `selling-your-home-in-loveland -> XljDXMkiDso` ✔
- stale ids `-QH0MqSSS7A` / `8sR3GlX1Mw4` no longer present ✔
- `youtubeId` fields 131, empty ids **0** ✔
- `node --check` passes ✔

## Remaining queue (next runs, 2 each)

1. `northern-colorado-events-guide-2026` (`yCQQymVAdu4` private), `northern-colorado-market-update` (`Z0sxD4Z2yXI` private)
2. `cash-home-buyers-loveland-northern-colorado`, `cash-home-buyers-greeley-northern-colorado`
3. `cash-home-buyers-windsor-northern-colorado`, `cash-home-buyers-longmont-northern-colorado`

FINDING carried over: `ppibH9GQHkg` ("Cash Home Buyers in Fort Collins & Northern Colorado") is embedded
on all five cash-home-buyer posts; only the Fort Collins post matches the video topic. Fix one per run.

**Important:** do NOT just flip the private first-generation videos back to public — that batch
(2026-07-07/08) is the post-strike remediation set. The safe fix is the one used here: regenerate with
the clean music set and replace the embedded id.

Quota: no `quotaExceeded` / `uploadLimitExceeded` seen. Uploads cost 1600 units each; the full
verification sweep costs 3 units.
