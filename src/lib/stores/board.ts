import { writable, derived, get } from 'svelte/store';
import type { BoardWithContent, Section, Tile, Lane } from '../types';
import { loadBoardDoc, saveBoardDoc } from '../storage/db';
import { engine } from '../audio/engine';

export const board = writable<BoardWithContent | null>(null);
export const loading = writable(true);
export const loadError = writable<string | null>(null);

export const masterVolume = derived(board, ($b) => $b?.master_volume_pct ?? 80);

function emptyBoard(): BoardWithContent {
	return {
		id: crypto.randomUUID(),
		name: 'My Soundboard',
		master_volume_pct: 80,
		sections: []
	};
}

/** Persist the current in-memory board document to IndexedDB (fire-and-forget). */
function persist(): void {
	const current = get(board);
	if (current) saveBoardDoc(current).catch((err) => console.error('persist board', err));
}

export async function refresh(): Promise<void> {
	loading.set(true);
	loadError.set(null);
	try {
		let doc = await loadBoardDoc();
		if (!doc) {
			doc = emptyBoard();
			await saveBoardDoc(doc);
		}
		board.set(doc);
		engine.setMasterVolume(doc.master_volume_pct);
	} catch (err) {
		loadError.set(err instanceof Error ? err.message : String(err));
	} finally {
		loading.set(false);
	}
}

/** Replace the entire board (used by config import / share-link import). */
export async function replaceBoard(next: BoardWithContent): Promise<void> {
	engine.stopAll();
	board.set(next);
	engine.setMasterVolume(next.master_volume_pct);
	await saveBoardDoc(next);
}

export function setMasterVolume(pct: number): void {
	const clamped = Math.max(0, Math.min(100, Math.round(pct)));
	engine.setMasterVolume(clamped);
	board.update((b) => (b ? { ...b, master_volume_pct: clamped } : b));
	persist();
}

export async function addSection(name: string): Promise<Section | null> {
	const current = get(board);
	if (!current) return null;
	const section: Section = {
		id: crypto.randomUUID(),
		board_id: current.id,
		name,
		position: current.sections.length
	};
	board.update((b) => (b ? { ...b, sections: [...b.sections, { ...section, tiles: [] }] } : b));
	persist();
	return section;
}

export async function renameSection(id: string, name: string): Promise<void> {
	board.update((b) =>
		b ? { ...b, sections: b.sections.map((s) => (s.id === id ? { ...s, name } : s)) } : b
	);
	persist();
}

export async function deleteSection(id: string): Promise<void> {
	for (const tile of get(board)?.sections.find((s) => s.id === id)?.tiles ?? []) {
		engine.stop(tile.id);
	}
	board.update((b) => (b ? { ...b, sections: b.sections.filter((s) => s.id !== id) } : b));
	persist();
}

export async function reorderSections(ids: string[]): Promise<void> {
	const current = get(board);
	if (!current) return;
	const map = new Map(current.sections.map((s) => [s.id, s]));
	board.update((b) =>
		b
			? {
					...b,
					sections: ids
						.map((id, position) => {
							const s = map.get(id);
							return s ? { ...s, position } : null;
						})
						.filter((s): s is Section & { tiles: Tile[] } => s !== null)
				}
			: b
	);
	persist();
}

/** Move a section one slot earlier (dir -1) or later (dir +1). No-op at the ends. */
export async function moveSection(id: string, dir: -1 | 1): Promise<void> {
	const current = get(board);
	if (!current) return;
	const ids = current.sections.map((s) => s.id);
	const idx = ids.indexOf(id);
	const target = idx + dir;
	if (idx < 0 || target < 0 || target >= ids.length) return;
	[ids[idx], ids[target]] = [ids[target], ids[idx]];
	await reorderSections(ids);
}

export async function addTile(
	section_id: string,
	lane: Lane,
	tile: Omit<Tile, 'id' | 'section_id' | 'lane' | 'position'>
): Promise<Tile | null> {
	const current = get(board);
	if (!current) return null;
	const section = current.sections.find((s) => s.id === section_id);
	if (!section) return null;
	const laneTiles = section.tiles.filter((t) => t.lane === lane);
	const saved: Tile = {
		...tile,
		id: crypto.randomUUID(),
		section_id,
		lane,
		position: laneTiles.length
	};
	board.update((b) =>
		b
			? {
					...b,
					sections: b.sections.map((s) =>
						s.id === section_id ? { ...s, tiles: [...s.tiles, saved] } : s
					)
				}
			: b
	);
	persist();
	return saved;
}

export async function updateTile(id: string, patch: Partial<Tile>): Promise<void> {
	board.update((b) =>
		b
			? {
					...b,
					sections: b.sections.map((s) => ({
						...s,
						tiles: s.tiles.map((t) => (t.id === id ? { ...t, ...patch } : t))
					}))
				}
			: b
	);
	persist();
}

export async function deleteTile(id: string): Promise<void> {
	engine.stop(id);
	board.update((b) =>
		b
			? {
					...b,
					sections: b.sections.map((s) => ({
						...s,
						tiles: s.tiles.filter((t) => t.id !== id)
					}))
				}
			: b
	);
	persist();
}

export async function reorderTilesInLane(
	section_id: string,
	lane: Lane,
	tileIds: string[]
): Promise<void> {
	const current = get(board);
	if (!current) return;
	const section = current.sections.find((s) => s.id === section_id);
	if (!section) return;
	const map = new Map(section.tiles.filter((t) => t.lane === lane).map((t) => [t.id, t]));
	const reordered = tileIds.map((id, position) => ({ ...(map.get(id) as Tile), position }));
	const others = section.tiles.filter((t) => t.lane !== lane);
	board.update((b) =>
		b
			? {
					...b,
					sections: b.sections.map((s) =>
						s.id === section_id ? { ...s, tiles: [...others, ...reordered] } : s
					)
				}
			: b
	);
	persist();
}
