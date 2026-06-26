# TTRPG Soundboard

A phone-first soundboard for TTRPG sessions. Looping music/ambience beds in one lane, one-shot SFX in another, organized into scene-based sections (Tavern, Combat, Forest, Boss…). Build the board on your laptop, extract the clips once, and play from your phone at the table — fully offline.

Audio is **pre-extracted** from YouTube into small Opus clips and played through the **Web Audio API**. There are no YouTube iframes at runtime, so playback is instant, gapless, and light enough for a low-end Android player. The board is **local-first** (IndexedDB) — no login, no server — and shareable via config files or links.

## Stack

- **SvelteKit** (static export — no server functions)
- **Tailwind v4** for styling
- **Web Audio API** for playback (pre-extracted Opus clips, gapless native looping)
- **IndexedDB** for the board; **Cache Storage** for offline clips
- **PWA** installable on phone home screen
- **Cloudflare Pages** (or any static host) for hosting

## Local setup

```sh
npm install
npm run dev
```

That's it — no environment variables, no account. The app opens to an empty board you can start filling.

## Building your board

1. **Edit mode (pencil icon, top-right):** add/rename/delete sections; add tiles; reorder by drag; tweak per-tile name, emoji, tint, lane, volume, and start/end timestamps.
2. **Add a tile:** paste a YouTube URL → the title auto-fetches; `?t=34s` pre-fills the start. The embedded preview player lets you scrub and tap **Set start = playhead** / **Set end = playhead** for accurate trim points. (Preview is the only place a YouTube iframe is still used.)
3. New tiles show a ⏳ badge until their audio has been extracted (next step).

## Extracting clips (one-time per new/changed tile)

Playback uses local audio files, not live YouTube. Generate them with the bundled tool on your computer.

**Requirements:** [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) and `ffmpeg` on your PATH.

```sh
# 1. In the app: Options (gear) → Export config  → saves soundboard-config.json
# 2. Move that file to the project root, then:
node scripts/extract-clips.mjs            # reads ./soundboard-config.json
#    (or: node scripts/extract-clips.mjs path/to/soundboard-config.json)
```

This downloads + trims each tile to `static/clips/<key>.opus` (skipping ones already done) and writes `static/clips/index.json`. Reload the app and the ⏳ badges clear.

> Extracting YouTube audio may conflict with YouTube's Terms of Service. Intended for personal use with content you have the right to use.

## Offline use at the table

Open **Options → Save for offline** to warm the clip cache, then the board plays with no network at all (after the page itself has loaded once as a PWA). Music loops sample-accurately; SFX fire once.

## Sharing a board

- **Export / Import config:** Options → Export config writes `soundboard-config.json`; Import replaces your board from one. This file is also the input to the extraction tool.
- **Copy share link:** Options → Copy share link puts the whole board (config only) into a `#cfg=…` URL on the clipboard. Opening it offers to import. Large boards fall back to a file export. A link shares the *config*, not the audio — the recipient gets sound only on a deployment that already hosts those clips, or after running the extraction tool themselves.

## Casting to room speakers

No in-app Cast button — use the OS:

- **Android (preferred):** open in Chrome → system media-output picker → route to Chromecast / Nest / Google TV.
- **Chrome "Cast tab":** browser menu → Cast.
- **Bluetooth:** pair the phone with any speaker.

## Deploy to Cloudflare Pages

```sh
npm run build      # static output in build/
```

1. **Git:** push the repo, then Cloudflare Pages → Create Project → Connect Git → build `npm run build`, output dir `build`. No env vars needed. Commit `static/clips/` so the clips deploy with the site.
2. **Manual:** `npx wrangler pages deploy build --project-name=ttrpg-soundboard`

## Migrating from the old Supabase version

If you have an existing cloud board, pull it down once into local config:

```sh
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-from-supabase.mjs
node scripts/extract-clips.mjs
```

Then delete `scripts/migrate-from-supabase.mjs` and the legacy `supabase/` folder.

## Notes / limitations

- **iOS PWA + screen lock:** iOS suspends web audio when the screen locks (a Safari constraint). Keep the screen on, or use Android.
- **New tiles need a processing pass:** a tile added on the phone won't play until you run the extraction tool and redeploy/reload — the ⏳ badge marks these.
- **Gapless loops:** Web Audio loops are sample-accurate; if a particular Opus clip shows a faint seam, re-trim its start/end to a cleaner boundary.
