# TTRPG Soundboard

A phone-first YouTube soundboard for TTRPG sessions. Looping music/ambience beds in one lane, one-shot SFX in another, organized into scene-based sections (Tavern, Combat, Forest, Boss…). Build the board on your laptop; play from your phone at the table. Syncs across devices via Supabase.

## Stack

- **SvelteKit** (static export — no server functions)
- **Tailwind v4** for styling
- **Supabase** for auth + sync (free tier is plenty)
- **YouTube IFrame Player API** for playback (no API key needed)
- **PWA** installable on phone home screen
- **Cloudflare Pages** for hosting

## Local setup

```sh
npm install
cp .env.example .env
# Edit .env with your Supabase project URL + anon key (see below)
npm run dev
```

### Create your Supabase project

1. Sign up at <https://supabase.com> (free tier).
2. Create a new project. Note the **Project URL** and **anon public key** (Settings → API).
3. Paste them into `.env`:

	```
	PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
	PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
	```

4. Run the schema migration once: open the Supabase dashboard → **SQL Editor** → paste the contents of `supabase/migrations/0001_init.sql` → Run.
5. Make sure email magic links are enabled: Authentication → Providers → Email → "Enable Email provider" + "Enable Magic Link". Add your local URL (`http://localhost:5173`) and your production URL to **Site URL** / **Redirect URLs** under Authentication → URL Configuration.

### Sign in

Open `http://localhost:5173`, enter your email, tap the magic link in your inbox. You're in.

## Using the soundboard

- **Edit mode (pencil icon, top-right):** Add/rename/delete sections; add tiles; reorder by drag; tweak per-tile name, emoji, tint color, lane, volume, start/end timestamps.
- **Add a tile:** Paste a YouTube URL → title auto-fetches; if the URL has `?t=34s` it pre-fills the start. The embedded preview player lets you scrub and tap **Set start = playhead** / **Set end = playhead** for accurate trim points.
- **Play mode (default):** Tap a tile to play, tap again to stop. Music tiles loop between start↔end with a 0.5s fade. SFX tiles fire once and stop hard. Multiple tiles can play simultaneously.
- **Stop All:** Big red button in the header. Halts every playing clip.
- **Master volume:** Slider in the header. Scales per-tile volumes.

## Casting to room speakers

There is no in-app Cast button. Use the OS instead:

- **Android (preferred):** Open the soundboard in Chrome → use the system media-output picker (Android 10+) → route audio to your Chromecast / Nest / Google TV speaker.
- **Chrome "Cast tab":** Browser menu → Cast → choose your TV/speaker.
- **Bluetooth:** Pair the phone with any Bluetooth speaker — simplest of all.

## Deploy to Cloudflare Pages

```sh
npm run build
# Output is in `build/` (static files only).
```

Two options:

1. **Connect to GitHub.** Push the repo, then in Cloudflare Pages: Create a Project → Connect Git → pick the repo. Build settings: `npm run build`, output dir `build`. Add the two `PUBLIC_SUPABASE_*` env vars in Settings → Environment variables.

2. **Manual deploy.** `npx wrangler pages deploy build --project-name=ttrpg-soundboard`

After deploying, add your production URL to Supabase Auth → URL Configuration (Site URL + Redirect URLs).

## Known v1 limitations

- **Loop seam gap:** YouTube's seek-on-end leaves a ~200–800ms gap when a music tile loops. Acceptable for ambience tracks; pick clips designed to loop or where ambient noise hides the seam.
- **iOS PWA + screen lock:** iOS pauses web audio when the screen locks. Same constraint as Safari itself. Keep the screen on (or use Android, where the OS-level cast keeps audio rolling).
- **Single board per user.** Multiple campaigns share one board. Use sections to separate them, or revisit when this hurts.
- **No in-app Cast button.** See "Casting to room speakers" above.
- **No realtime cross-device sync of *playing* state.** Each device controls its own playback; the *library* syncs, the live state doesn't.
