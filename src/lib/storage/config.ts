import type { BoardWithContent, Lane, Section, Tile } from '../types';

/**
 * Config serialisation: JSON file export/import and compact URL share links.
 * A config carries only structure (sections + tiles), not audio — clips are
 * referenced by their content key and shipped/extracted separately.
 */

const CONFIG_VERSION = 1;

interface ConfigDoc {
	version: number;
	board: BoardWithContent;
}

// --- validation -----------------------------------------------------------

function asLane(v: unknown): Lane {
	return v === 'sfx' ? 'sfx' : 'music';
}

function num(v: unknown, fallback = 0): number {
	return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback = ''): string {
	return typeof v === 'string' ? v : fallback;
}

function parseBoard(raw: unknown): BoardWithContent {
	if (!raw || typeof raw !== 'object') throw new Error('Not a soundboard config.');
	const b = raw as Record<string, unknown>;
	const sectionsRaw = Array.isArray(b.sections) ? b.sections : [];

	const sections = sectionsRaw.map((sRaw, si): Section & { tiles: Tile[] } => {
		const s = (sRaw ?? {}) as Record<string, unknown>;
		const sectionId = str(s.id) || crypto.randomUUID();
		const tilesRaw = Array.isArray(s.tiles) ? s.tiles : [];
		const tiles = tilesRaw.map((tRaw, ti): Tile => {
			const t = (tRaw ?? {}) as Record<string, unknown>;
			return {
				id: str(t.id) || crypto.randomUUID(),
				section_id: sectionId,
				lane: asLane(t.lane),
				youtube_id: str(t.youtube_id),
				start_seconds: num(t.start_seconds),
				end_seconds: num(t.end_seconds),
				name: str(t.name, 'Untitled'),
				emoji: str(t.emoji, '🎵'),
				tint_color: typeof t.tint_color === 'string' ? t.tint_color : null,
				volume_pct: num(t.volume_pct, 70),
				position: num(t.position, ti)
			};
		});
		return {
			id: sectionId,
			board_id: str(b.id),
			name: str(s.name, 'Section'),
			position: num(s.position, si),
			tiles
		};
	});

	return {
		id: str(b.id) || crypto.randomUUID(),
		name: str(b.name, 'My Soundboard'),
		master_volume_pct: num(b.master_volume_pct, 80),
		sections
	};
}

function parseConfig(text: string): BoardWithContent {
	const json = JSON.parse(text) as ConfigDoc | BoardWithContent;
	// Accept both the wrapped {version, board} form and a bare board document.
	const board = 'board' in json && json.board ? json.board : (json as BoardWithContent);
	return parseBoard(board);
}

// --- file export / import --------------------------------------------------

export function serializeConfig(board: BoardWithContent): string {
	const doc: ConfigDoc = { version: CONFIG_VERSION, board };
	return JSON.stringify(doc, null, 2);
}

export function exportConfigFile(board: BoardWithContent): void {
	const blob = new Blob([serializeConfig(board)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'soundboard-config.json';
	a.click();
	URL.revokeObjectURL(url);
}

export async function importConfigFile(file: File): Promise<BoardWithContent> {
	return parseConfig(await file.text());
}

// --- share link (gzip + base64url in the URL fragment) ---------------------

const SHARE_PARAM = 'cfg';

function toBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
	const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

const canCompress = typeof CompressionStream !== 'undefined';

async function gzip(text: string): Promise<Uint8Array> {
	const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Uint8Array): Promise<string> {
	const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
	return new Response(stream).text();
}

/**
 * Encode a board into a shareable URL. Prefix `g` = gzipped, `r` = raw, so the
 * decoder knows how to read it even if the two ends differ on CompressionStream.
 */
export async function encodeShareLink(board: BoardWithContent): Promise<string> {
	const json = JSON.stringify({ version: CONFIG_VERSION, board });
	let payload: string;
	if (canCompress) {
		payload = 'g' + toBase64Url(await gzip(json));
	} else {
		payload = 'r' + toBase64Url(new TextEncoder().encode(json));
	}
	const base = `${location.origin}${location.pathname}`;
	return `${base}#${SHARE_PARAM}=${payload}`;
}

/** Read a `#cfg=` payload from the current URL, if present. */
export function readShareFragment(): string | null {
	const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
	const params = new URLSearchParams(hash);
	return params.get(SHARE_PARAM);
}

export function clearShareFragment(): void {
	history.replaceState(null, '', `${location.origin}${location.pathname}${location.search}`);
}

export async function decodeSharePayload(payload: string): Promise<BoardWithContent> {
	const tag = payload[0];
	const body = payload.slice(1);
	const bytes = fromBase64Url(body);
	const text = tag === 'g' ? await gunzip(bytes) : new TextDecoder().decode(bytes);
	return parseConfig(text);
}
