export type Lane = 'music' | 'sfx';

export interface Board {
	id: string;
	name: string;
	master_volume_pct: number;
}

export interface Section {
	id: string;
	board_id: string;
	name: string;
	position: number;
}

export interface Tile {
	id: string;
	section_id: string;
	lane: Lane;
	youtube_id: string;
	start_seconds: number;
	end_seconds: number;
	name: string;
	emoji: string;
	tint_color: string | null;
	volume_pct: number;
	position: number;
}

export interface BoardWithContent extends Board {
	sections: Array<Section & { tiles: Tile[] }>;
}

export type TileInput = Omit<Tile, 'id'>;
export type SectionInput = Omit<Section, 'id'>;
