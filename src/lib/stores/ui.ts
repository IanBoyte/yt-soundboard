import { writable } from 'svelte/store';

export const editMode = writable(false);

/** Mobile only: which section is currently in view (index into board.sections). */
export const currentSectionIndex = writable(0);

/** When set, opens the edit sheet. `null` = closed. A `tileId` opens for editing; `{ section_id, lane }` opens for adding. */
export type EditSheetTarget =
	| { mode: 'edit'; tile_id: string }
	| { mode: 'create'; section_id: string; lane: 'music' | 'sfx' };

export const editSheet = writable<EditSheetTarget | null>(null);
