#!/usr/bin/env node
// One-time migration: pull an existing board out of the old Supabase deployment
// into a local soundboard-config.json that the (now local-first) app and the
// extraction tool can consume. Delete this script once you've migrated.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-from-supabase.mjs
//   (or put them in .env and run with `node --env-file=.env scripts/migrate-from-supabase.mjs`)

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const URL_BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_BASE || !KEY) {
	console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).');
	process.exit(1);
}

async function rest(path) {
	const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
		headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
	});
	if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
	return res.json();
}

const boards = await rest('boards?select=*&limit=1');
if (!boards.length) {
	console.error('No board found.');
	process.exit(1);
}
const board = boards[0];
const sections = await rest(`sections?board_id=eq.${board.id}&select=*&order=position`);
const tiles = sections.length
	? await rest(`tiles?section_id=in.(${sections.map((s) => s.id).join(',')})&select=*&order=position`)
	: [];

const doc = {
	version: 1,
	board: {
		id: board.id,
		name: board.name,
		master_volume_pct: board.master_volume_pct,
		sections: sections.map((s) => ({
			id: s.id,
			board_id: board.id,
			name: s.name,
			position: s.position,
			tiles: tiles.filter((t) => t.section_id === s.id)
		}))
	}
};

const out = join(ROOT, 'soundboard-config.json');
writeFileSync(out, JSON.stringify(doc, null, 2));
console.log(`Wrote ${out} (${sections.length} sections, ${tiles.length} tiles).`);
console.log('Next: node scripts/extract-clips.mjs');
