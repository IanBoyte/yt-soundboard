#!/usr/bin/env node
// Local clip extraction tool. Reads a soundboard config (exported from the app),
// downloads + trims each tile's audio with yt-dlp + ffmpeg, and writes the
// results to static/clips/<key>.opus plus an index.json the app reads to flag
// which tiles still need processing.
//
// Usage:
//   node scripts/extract-clips.mjs [path/to/soundboard-config.json]
//
// Requires `yt-dlp` and `ffmpeg` on your PATH.
//
// NOTE: extracting audio from YouTube may conflict with YouTube's Terms of
// Service. This is intended for personal use with content you have the right to.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLIPS_DIR = join(ROOT, 'static', 'clips');
const CONFIG_PATH = process.argv[2] || join(ROOT, 'soundboard-config.json');

// Keep in sync with src/lib/clip.ts
const clipKey = (t) => `${t.youtube_id}_${t.start_seconds}-${t.end_seconds}`;

function requireBinary(name) {
	const probe = spawnSync(name, ['--version'], { stdio: 'ignore' });
	if (probe.error) {
		console.error(`Missing required binary: ${name}. Install it and ensure it's on your PATH.`);
		process.exit(1);
	}
}

function loadTiles() {
	if (!existsSync(CONFIG_PATH)) {
		console.error(`Config not found: ${CONFIG_PATH}\nExport one from the app (Options → Export config).`);
		process.exit(1);
	}
	const parsed = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
	const board = parsed.board ?? parsed;
	const tiles = [];
	for (const section of board.sections ?? []) {
		for (const tile of section.tiles ?? []) {
			if (tile.youtube_id) tiles.push(tile);
		}
	}
	return tiles;
}

function downloadSource(youtubeId, tmp) {
	// Download bestaudio once per video (no re-encode here); ffmpeg trims/encodes.
	const out = join(tmp, `${youtubeId}.src`);
	if (existsSync(out)) return out;
	execFileSync(
		'yt-dlp',
		['-f', 'bestaudio', '--no-playlist', '-o', out, `https://www.youtube.com/watch?v=${youtubeId}`],
		{ stdio: 'inherit' }
	);
	return out;
}

function encodeClip(src, start, end, outPath) {
	// -ss/-to after -i for sample-accurate trim; re-encode to Opus for the web.
	execFileSync(
		'ffmpeg',
		[
			'-y', '-i', src,
			'-ss', String(start), '-to', String(end),
			'-vn', '-c:a', 'libopus', '-b:a', '96k',
			outPath
		],
		{ stdio: 'inherit' }
	);
}

function main() {
	requireBinary('yt-dlp');
	requireBinary('ffmpeg');
	mkdirSync(CLIPS_DIR, { recursive: true });

	const tiles = loadTiles();
	// Unique clips, grouped so we download each video at most once.
	const byKey = new Map();
	for (const t of tiles) byKey.set(clipKey(t), t);

	const tmp = mkdtempSync(join(tmpdir(), 'yt-clips-'));
	let made = 0;
	let skipped = 0;
	let failed = 0;

	try {
		for (const [key, tile] of byKey) {
			const outPath = join(CLIPS_DIR, `${key}.opus`);
			if (existsSync(outPath)) {
				skipped++;
				continue;
			}
			try {
				console.log(`\n→ ${key}`);
				const src = downloadSource(tile.youtube_id, tmp);
				encodeClip(src, tile.start_seconds, tile.end_seconds, outPath);
				made++;
			} catch (err) {
				failed++;
				console.error(`  failed: ${err.message ?? err}`);
			}
		}
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}

	// Index = every clip currently present, so the app can flag missing ones.
	const keys = readdirSync(CLIPS_DIR)
		.filter((f) => f.endsWith('.opus'))
		.map((f) => f.replace(/\.opus$/, ''));
	writeFileSync(join(CLIPS_DIR, 'index.json'), JSON.stringify(keys, null, 0));

	console.log(`\nDone. ${made} created, ${skipped} already present, ${failed} failed. ${keys.length} clips total.`);
}

main();
