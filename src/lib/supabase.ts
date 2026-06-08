import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';
import type { Board, BoardWithContent, Section, Tile } from './types';

const SUPABASE_URL = env.PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let _client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
	if (!_client) {
		if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
			throw new Error(
				'Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env and fill in your Supabase project values.'
			);
		}
		_client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
			auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
		});
	}
	return _client;
}

export async function sendMagicLink(email: string): Promise<void> {
	const { error } = await supabase().auth.signInWithOtp({
		email,
		options: { emailRedirectTo: window.location.origin }
	});
	if (error) throw error;
}

export async function signOut(): Promise<void> {
	await supabase().auth.signOut();
}

export async function getSession() {
	const { data } = await supabase().auth.getSession();
	return data.session;
}

export async function loadBoard(): Promise<BoardWithContent | null> {
	const session = await getSession();
	if (!session) return null;

	const userId = session.user.id;
	const sb = supabase();

	let { data: boards } = await sb.from('boards').select('*').eq('user_id', userId).limit(1);
	let board = boards?.[0] as Board | undefined;

	if (!board) {
		const { data, error } = await sb
			.from('boards')
			.insert({ user_id: userId, name: 'My Soundboard', master_volume_pct: 80 })
			.select()
			.single();
		if (error) throw error;
		board = data as Board;
	}

	const { data: sections } = await sb
		.from('sections')
		.select('*')
		.eq('board_id', board.id)
		.order('position', { ascending: true });

	const sectionIds = (sections ?? []).map((s) => s.id);
	const { data: tiles } = sectionIds.length
		? await sb
				.from('tiles')
				.select('*')
				.in('section_id', sectionIds)
				.order('position', { ascending: true })
		: { data: [] as Tile[] };

	return {
		...board,
		sections: (sections ?? []).map((s: Section) => ({
			...s,
			tiles: (tiles ?? []).filter((t: Tile) => t.section_id === s.id)
		}))
	};
}

export async function upsertSection(section: Partial<Section> & { board_id: string; name: string; position: number }) {
	const { data, error } = await supabase().from('sections').upsert(section).select().single();
	if (error) throw error;
	return data as Section;
}

export async function deleteSection(id: string) {
	const { error } = await supabase().from('sections').delete().eq('id', id);
	if (error) throw error;
}

export async function upsertTile(tile: Partial<Tile> & Omit<Tile, 'id'>) {
	const payload = 'id' in tile && tile.id ? tile : { ...tile, id: undefined };
	const { data, error } = await supabase().from('tiles').upsert(payload).select().single();
	if (error) throw error;
	return data as Tile;
}

export async function deleteTile(id: string) {
	const { error } = await supabase().from('tiles').delete().eq('id', id);
	if (error) throw error;
}

export async function updateMasterVolume(boardId: string, master_volume_pct: number) {
	const { error } = await supabase()
		.from('boards')
		.update({ master_volume_pct })
		.eq('id', boardId);
	if (error) throw error;
}
