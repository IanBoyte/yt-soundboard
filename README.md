# TTRPG Soundboard

A phone-first soundboard for TTRPG sessions. Looping music/ambience beds in one lane, one-shot SFX in another, organized into scene-based sections (Tavern, Combat, Forest, Boss…). Build the board on your laptop, play from your phone at the table.

Playback uses the **YouTube IFrame Player API** — paste a URL and it plays, nothing to download or process. The player engine is tuned for low-end mobile (small capped pool of players, idle players destroyed to free memory, no per-clip polling). The board is **local-first** (IndexedDB) — no login, no server — and shareable via config files or links.

## Stack

- **SvelteKit** (static export — no server functions)
- **Tailwind v4** for styling
- **YouTube IFrame Player API** for playback (no API key needed)
- **IndexedDB** for the board (local-first)
- **PWA** installable on phone home screen
- **Cloudflare Pages** (or any static host) for hosting

## Local setup

```sh
npm install
npm run dev
```

No environment variables, no account. The app opens to an empty board you can start filling.

## Building your board

1. **Edit mode (pencil icon, top-right):** add/rename/delete sections; add tiles; reorder by drag; tweak per-tile name, emoji, tint, lane, volume, and start/end timestamps.
2. **Add a tile:** paste a YouTube URL → the title auto-fetches; `?t=34s` pre-fills the start. The embedded preview player lets you scrub and tap **Set start = playhead** / **Set end = playhead** for accurate trim points.
3. **Play mode (default):** tap a tile to play, tap again to stop. Music tiles loop between start↔end; SFX fire once and stop. Several tiles can play at once.
4. **Stop All** halts everything; the **master volume** slider scales all tiles.

## Example board

`soundboard-config.json` in the repo is a ready-made Dolmenwood (faerie-forest) board — six scenes of ambience, tavern, witch, goblin, and battle tracks. Import it via **Options → Import config** to try the app with real content.

## Performance notes

The engine keeps at most a few YouTube players alive at once and destroys idle ones, so memory stays low on weak devices. Looping a *trimmed* range seeks back to the start at the loop point, which leaves a short gap — pick clips that loop cleanly, or where ambient noise hides the seam. (Untrimmed tiles that play to the video's natural end loop without that seek.)

## Sharing a board

- **Export / Import config:** Options → Export config writes `soundboard-config.json`; Import replaces your board from one.
- **Copy share link:** Options → Copy share link puts the whole board into a `#cfg=…` URL on the clipboard (config is gzipped into the link, never sent to a server). Opening it offers to import. Very large boards fall back to a file export.

## Casting to room speakers

No in-app Cast button — use the OS:

- **Android (preferred):** open in Chrome → system media-output picker → route to Chromecast / Nest / Google TV.
- **Chrome "Cast tab":** browser menu → Cast.
- **Bluetooth:** pair the phone with any speaker.

## Deploy to Cloudflare Pages

```sh
npm run build      # static output in build/
```

1. **Git:** push the repo, then Cloudflare Pages → Create Project → Connect Git → build `npm run build`, output dir `build`. No env vars needed.
2. **Manual:** `npx wrangler pages deploy build --project-name=ttrpg-soundboard`

## Migrating from the old Supabase version

If you have an existing cloud board from an earlier version, pull it into local config once:

```sh
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-from-supabase.mjs
```

Then import the generated `soundboard-config.json` and delete `scripts/migrate-from-supabase.mjs`.

## Notes / limitations

- **No offline playback.** Playback streams from YouTube, so a connection is required at the table.
- **iOS PWA + screen lock:** iOS suspends web audio when the screen locks (a Safari constraint). Keep the screen on, or use Android.
- **Loop seam:** see Performance notes above.
