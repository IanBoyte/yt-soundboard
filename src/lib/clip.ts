import type { Tile } from './types';

/**
 * Stable, content-addressed key for a tile's trimmed audio clip.
 * Derived only from the inputs that determine the audio (video + trim range),
 * so two tiles pointing at the same span share one extracted file.
 *
 * Keep this in sync with the matching helper in scripts/extract-clips.mjs.
 */
export function clipKey(tile: Pick<Tile, 'youtube_id' | 'start_seconds' | 'end_seconds'>): string {
	return `${tile.youtube_id}_${tile.start_seconds}-${tile.end_seconds}`;
}

/** File extension produced by the extraction tool. */
export const CLIP_EXT = 'opus';
