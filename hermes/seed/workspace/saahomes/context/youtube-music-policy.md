# YouTube background music policy — @SAAHomes

## Allowed

- Tracks in `hermes/assets/music/manifest.json` (downloaded from [audiolibrary.com.co](https://www.audiolibrary.com.co))
- Source playlist: [Happy Music | YouTube Audio Library](https://www.youtube.com/playlist?list=PLzCxunOM5WFLOaTRCzeGrODz8TWaLrbhv)
- Refresh tracks: `python3 /usr/local/bin/download-audiolibrary-tracks.py --count 4`

## Banned

- **freetouse.com** / **Limujii** / any unattributed third-party music sites

## Attribution (required)

These tracks are CC BY 3.0. Each video **must** append the matching `attribution_block` from `manifest.json` to the YouTube description. Hermes upload packs should include it automatically.

## Download flow (how tracks are fetched)

1. YouTube playlist video title → `Artist - Track`
2. Page URL: `https://www.audiolibrary.com.co/{artist-slug}/{track-slug}`
3. Load page (session cookies) → read `data-download-gate`
4. Fetch MP3 from `https://www.audiolibrary.com.co/download/...`

**Note:** `links.al` short links in YouTube descriptions do not resolve reliably server-side. The script uses the audiolibrary.com.co page directly.

## Mix levels

- Background music: ~18% volume under narration (`--music-volume 0.18`)
- Rotate tracks across videos — assign `ambient-1.mp3` … `ambient-4.mp3` per slug in manifest
