---
name: article-youtube-video
description: Remux article videos with one unique audiolibrary.com.co track per video and auto-upload to @SAAHomes via YouTube Data API.
---

# Article YouTube Video — Remux + Auto-Upload

## CRITICAL RULES

- **Article videos channel:** `UCCgkJ1fymEPI5hdBH2SNvrg` (Adam Schwartz) — NOT the @SAAHomes listing-tour channel
- **One unique music track per video slug** — never reuse the same playlist track across videos
- **Music source:** [Happy Music playlist](https://www.youtube.com/playlist?list=PLzCxunOM5WFLOaTRCzeGrODz8TWaLrbhv) → [audiolibrary.com.co](https://www.audiolibrary.com.co)
- **Never** use freetouse.com, Limujii, or music outside `assets/music/manifest.json`
- **Attribution:** Append each track's `attribution_block` to the YouTube description (CC BY 3.0)
- **Upload:** `upload-youtube-video.py` (YouTube Data API) — NOT Browserbase
- **OAuth:** `/opt/data/credentials/youtube-oauth.json` or `YOUTUBE_*` env vars
- Telegram Adam each new `watch?v=` URL

---

## Music assignment (one track per video)

Each article/video slug gets **its own** MP3: `assets/music/{slug}.mp3`

### Assign music for all inventory videos

```bash
python3 /usr/local/bin/download-audiolibrary-tracks.py \
  --assign-inventory /opt/data/workspace/saahomes/context/video-inventory.json
```

This picks a **different** playlist track for each slug, downloads from audiolibrary.com.co, updates `manifest.json`, and sets `music_file` on each inventory entry.

### Assign music for one new article video

When a new blog video is created:

```bash
python3 /usr/local/bin/download-audiolibrary-tracks.py --slug {blog-slug}
```

Automatically picks the next unused playlist index. Optional: `--playlist-index 42` to force a specific track.

### Browse playlist (pick manually)

```bash
python3 /usr/local/bin/download-audiolibrary-tracks.py --list 20
```

---

## When to run

- **Copyright emergency:** unlist all at-risk live videos immediately (see Step 0)
- **Music remediation:** all entries in `video-inventory.json`
- **New article video:** `--slug` then remux + upload
- **Copyright claim:** re-assign with a new `--playlist-index`

---

## Step 0 — Emergency unlist (copyright risk)

If Free To Use / Limujii music may be live, **set all article videos private** until remuxed copies upload:

```bash
python3 /usr/local/bin/set-youtube-privacy.py \
  --inventory context/video-inventory.json \
  --urgent-only --privacy private

# Dry run first:
python3 /usr/local/bin/set-youtube-privacy.py \
  --inventory context/video-inventory.json --urgent-only --dry-run
```

After fixed uploads go public, re-run with `--privacy public` for remediated slugs only.

Delete duplicate uploads (e.g. second CHFA DPA copy):

```bash
python3 /usr/local/bin/set-youtube-privacy.py \
  --inventory context/video-inventory.json --delete-duplicates
```

---

## Step 1 — Audit channel + volume

Refresh inventory from YouTube (public uploads):

```bash
python3 /usr/local/bin/audit-youtube-channel.py --merge-inventory context/video-inventory.json
```

Scan Railway volume for project folders:

```bash
python3 /usr/local/bin/audit-video-volume.py
```

Update `video-inventory.json`: `youtube_id`, `project_path`, `title`, `description`, `tags`, `audit_required: false`.

---

## Step 2 — Assign unique music + verify OAuth

```bash
python3 /usr/local/bin/download-audiolibrary-tracks.py \
  --assign-inventory context/video-inventory.json

ls -la assets/music/*.mp3
python3 /usr/local/bin/upload-youtube-video.py videos/pending-upload/test.json --dry-run
```

---

## Step 3 — Remux + upload batch

```bash
python3 /usr/local/bin/run-video-music-remediation.py \
  --inventory context/video-inventory.json
```

**Per video:**
- `taken_down` (CHFA): remux → upload new (do not delete old ID)
- `live`: remux → upload new → delete old `youtube_id`

Dry run first:

```bash
python3 /usr/local/bin/run-video-music-remediation.py --dry-run
python3 /usr/local/bin/run-video-music-remediation.py --remux-only
```

---

## Step 4 — Notify + log

Telegram:

```
✅ YouTube music remediation complete
• {title} → https://youtube.com/watch?v={new_id}
  music: {artist} - {track}
```

Update `MEMORY.md`. Update `social-post-pack` youtube blocks with new URLs.

---

## New article video workflow (end-to-end)

1. Create video project under `videos/projects/{slug}/`
2. `download-audiolibrary-tracks.py --slug {slug}` — unique music
3. `remux-video-music.py --project-dir ... --slug {slug}` — uses `{slug}.mp3`
4. Build upload pack with description + `attribution_block` from manifest
5. `upload-youtube-video.py` pack.json --inventory context/video-inventory.json
6. Append to `video-inventory.json`

---

## Project folder layout

```
videos/projects/{slug}/
  video.mp4 | output.mp4 | final.mp4
  narration.wav | voiceover.mp3   (preferred)
assets/music/
  {slug}.mp3                      (one per video)
  manifest.json                   (assignments + attribution)
```

---

## Single video upload pack JSON

```json
{
  "slug": "chfa-schools-to-home-colorado-teachers",
  "file": "/opt/data/workspace/saahomes/videos/output/chfa-schools-to-home-colorado-teachers-remuxed.mp4",
  "title": "CHFA Schools To Home: Down Payment Help for Colorado Teachers & Educators",
  "description": "...\n\nhttps://saahomes.com/blog/chfa-schools-to-home-colorado-teachers/\n\nMusic: Fun by Alex-Productions ...",
  "tags": ["CHFA", "Colorado teachers", "SAA Homes"],
  "category_id": "22",
  "privacy_status": "public",
  "delete_youtube_id": null
}
```
