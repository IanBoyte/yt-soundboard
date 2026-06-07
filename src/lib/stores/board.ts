import { writable, derived, get } from 'svelte/store';
import type { BoardWithContent, Section, Tile, Lane } from '../types';
import {
	loadBoard,
	upsertSection,
	deleteSection as sbDeleteSection,
	upsertTile,
	deleteTile as sbDeleteTile,
	updateMasterVolume
} from '../supabase';
import { audioPool } from '../audio/pool';

export const board = writable<BoardWithContent | null>(null);
export const loading = writable(true);
export const loadError = writable<string | null>(null);

export const masterVolume = derived(board, ($b) => $b?.master_volume_pct ?? 80);

export async function refresh(): Promise<void> {
	loading.set(true);
	loadError.set(null);
	try {
		const b = await loadBoard();
		board.set(b);
		if (b) audioPool.setMasterVolume(b.master_volume_pct);
	} catch (err) {
		loadError.set(err instanceof Error ? err.message : String(err));
	} finally {
		loading.set(false);
	}
}

let masterDebounce: ReturnType<typeof setTimeout> | null = null;
export function setMasterVolume(pct: number): void {
	const clamped = Math.max(0, Math.min(100, Math.round(pct)));
	audioPool.setMasterVolume(clamped);
	board.update((b) => (b ? { ...b, master_volume_pct: clamped } : b));
	if (masterDebounce) clearTimeout(masterDebounce);
	const current = get(board);
	if (!current) return;
	const boardId = current.id;
	masterDebounce = setTimeout(() => {
		updateMasterVolume(boardId, clamped).catch((err) => console.error('persist master', err));
	}, 400);
}

export async function addSection(name: string): Promise<Section | null> {
	const current = get(board);
	if (!current) return null;
	const position = current.sections.length;
	const section = await upsertSection({ board_id: current.id, name, position });
	board.update((b) => (b ? { ...b, sections: [...b.sections, { ...section, tiles: [] }] } : b));
	return section;
}

export async function renameSection(id: string, name: string): Promise<void> {
	const current = get(board);
	if (!current) return;
	const existing = current.sections.find((s) => s.id === id);
	if (!existing) return;
	await upsertSection({ id, board_id: current.id, name, position: existing.position });
	board.update((b) =>
		b ? { ...b, sections: b.sections.map((s) => (s.id === id ? { ...s, name } : s)) } : b
	);
}

export async function deleteSection(id: string): Promise<void> {
	await sbDeleteSection(id);
	for (const tile of get(board)?.sections.find((s) => s.id === id)?.tiles ?? []) {
		audioPool.stop(tile.id);
	}
	board.update((b) =>
		b ? { ...b, sections: b.sections.filter((s) => s.id !== id) } : b
	);
}

export async function reorderSections(ids: string[]): Promise<void> {
	const current = get(board);
	if (!current) return;
	const map = new Map(current.sections.map((s) => [s.id, s]));
	const ordered = ids.map((id, position) => ({ section: map.get(id)!, position }));
	board.update((b) =>
		b
			? {
					...b,
					sections: ordered.map(({ section, position }) => ({ ...section, position }))
				}
			: b
	);
	await Promise.all(
		ordered.map(({ section, position }) =>
			upsertSection({ id: section.id, board_id: current.id, name: section.name, position })
		)
	);
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
	const payload = { ...tile, section_id, lane, position: laneTiles.length } as Omit<Tile, 'id'>;
	const saved = await upsertTile(payload as any);
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
	return saved;
}

export async function updateTile(id: string, patch: Partial<Tile>): Promise<void> {
	const current = get(board);
	if (!current) return;
	let updatedTile: Tile | null = null;
	for (const s of current.sections) {
		const existing = s.tiles.find((t) => t.id === id);
		if (existing) {
			updatedTile = { ...existing, ...patch };
			break;
		}
	}
	if (!updatedTile) return;
	await upsertTile(updatedTile as any);
	board.update((b) =>
		b
			? {
					...b,
					sections: b.sections.map((s) => ({
						...s,
						tiles: s.tiles.map((t) => (t.id === id ? (updatedTile as Tile) : t))
					}))
				}
			: b
	);
}

export async function deleteTile(id: string): Promise<void> {
	audioPool.stop(id);
	await sbDeleteTile(id);
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
	await Promise.all(reordered.map((t) => upsertTile(t as any)));
}
