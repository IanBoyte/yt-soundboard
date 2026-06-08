import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export const editMode = writable(false);

const COLLAPSE_KEY = 'collapsed-sections';

function loadCollapsed(): Set<string> {
	if (!browser) return new Set();
	try {
		const raw = localStorage.getItem(COLLAPSE_KEY);
		if (raw) return new Set(JSON.parse(raw) as string[]);
	} catch {
		// ignore malformed storage
	}
	return new Set();
}

/** Section ids the user has collapsed (persisted across reloads). */
export const collapsedSections = writable<Set<string>>(loadCollapsed());

if (browser) {
	collapsedSections.subscribe((s) => {
		try {
			localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...s]));
		} catch {
			// storage unavailable; collapse state stays in-memory for the session
		}
	});
}

export function toggleCollapsed(id: string): void {
	collapsedSections.update((s) => {
		const next = new Set(s);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		return next;
	});
}

/** Mobile only: which section is currently in view (index into board.sections). */
export const currentSectionIndex = writable(0);

/** When set, opens the edit sheet. `null` = closed. A `tileId` opens for editing; `{ section_id, lane }` opens for adding. */
export type EditSheetTarget =
	| { mode: 'edit'; tile_id: string }
	| { mode: 'create'; section_id: string; lane: 'music' | 'sfx' };

export const editSheet = writable<EditSheetTarget | null>(null);
