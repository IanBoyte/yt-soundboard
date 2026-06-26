import type { Tile } from '../types';
import { clipKey, CLIP_EXT } from '../clip';

/**
 * Offline clip layer. Extracted clips live as static files at /clips/<key>.opus.
 * We manage our own Cache Storage bucket so playback works fully offline and a
 * press never depends on the network — independent of the PWA's Workbox cache.
 */

const CACHE_NAME = 'clips-v1';
const CLIPS_BASE = '/clips';

export function clipUrl(tile: Pick<Tile, 'youtube_id' | 'start_seconds' | 'end_seconds'>): string {
	return `${CLIPS_BASE}/${clipKey(tile)}.${CLIP_EXT}`;
}

const hasCaches = typeof caches !== 'undefined';

/** Fetch a clip, preferring the offline cache and back-filling it on a miss. */
async function getClipResponse(url: string): Promise<Response> {
	if (hasCaches) {
		const cache = await caches.open(CACHE_NAME);
		const hit = await cache.match(url);
		if (hit) return hit;
		const res = await fetch(url);
		if (res.ok) await cache.put(url, res.clone());
		return res;
	}
	return fetch(url);
}

/** Raw bytes for a tile's clip, ready to hand to decodeAudioData. */
export async function getClipBytes(
	tile: Pick<Tile, 'youtube_id' | 'start_seconds' | 'end_seconds'>
): Promise<ArrayBuffer> {
	const res = await getClipResponse(clipUrl(tile));
	if (!res.ok) throw new Error(`Clip not available (${clipKey(tile)}). Run the extraction tool.`);
	return res.arrayBuffer();
}

export interface PrimeResult {
	total: number;
	cached: number;
	failed: number;
}

/**
 * Warm the offline cache with every clip on the board so a session is fully
 * self-contained. Skips clips already cached. Returns a small summary.
 */
export async function primeOffline(
	tiles: Array<Pick<Tile, 'youtube_id' | 'start_seconds' | 'end_seconds'>>
): Promise<PrimeResult> {
	const urls = Array.from(new Set(tiles.map(clipUrl)));
	const result: PrimeResult = { total: urls.length, cached: 0, failed: 0 };
	if (!hasCaches) {
		result.failed = urls.length;
		return result;
	}
	const cache = await caches.open(CACHE_NAME);
	await Promise.all(
		urls.map(async (url) => {
			try {
				if (await cache.match(url)) {
					result.cached++;
					return;
				}
				const res = await fetch(url);
				if (res.ok) {
					await cache.put(url, res.clone());
					result.cached++;
				} else {
					result.failed++;
				}
			} catch {
				result.failed++;
			}
		})
	);
	return result;
}

/**
 * Set of clip keys the extraction tool has produced, read from
 * /clips/index.json. Used only to flag "needs processing" tiles in the UI.
 * If the index is missing (e.g. tool never run), resolves to null so the UI
 * stays quiet rather than nagging on a fresh setup.
 */
let indexPromise: Promise<Set<string> | null> | null = null;

export function loadClipIndex(): Promise<Set<string> | null> {
	if (!indexPromise) {
		indexPromise = (async () => {
			try {
				const res = await fetch(`${CLIPS_BASE}/index.json`, { cache: 'no-cache' });
				if (!res.ok) return null;
				const keys = (await res.json()) as string[];
				return new Set(keys);
			} catch {
				return null;
			}
		})();
	}
	return indexPromise;
}

/** True if the clip is known-ready; null index (no tool run yet) counts as ready. */
export async function isClipReady(
	tile: Pick<Tile, 'youtube_id' | 'start_seconds' | 'end_seconds'>
): Promise<boolean> {
	const index = await loadClipIndex();
	if (!index) return true;
	return index.has(clipKey(tile));
}
