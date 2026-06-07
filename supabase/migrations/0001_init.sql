-- TTRPG Soundboard schema
-- Run this in Supabase Dashboard → SQL Editor (or via supabase CLI: `supabase db push`).

create extension if not exists "pgcrypto";

-- boards: one per user (v1), parents the whole soundboard
create table if not exists public.boards (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users(id) on delete cascade,
	name text not null default 'My Soundboard',
	master_volume_pct int not null default 80 check (master_volume_pct between 0 and 100),
	created_at timestamptz not null default now()
);
create index if not exists boards_user_id_idx on public.boards(user_id);

-- sections: named scenes within a board (Tavern, Combat, ...)
create table if not exists public.sections (
	id uuid primary key default gen_random_uuid(),
	board_id uuid not null references public.boards(id) on delete cascade,
	name text not null,
	position int not null default 0,
	created_at timestamptz not null default now()
);
create index if not exists sections_board_id_idx on public.sections(board_id);

-- tiles: a single YouTube clip with trim points
create table if not exists public.tiles (
	id uuid primary key default gen_random_uuid(),
	section_id uuid not null references public.sections(id) on delete cascade,
	lane text not null check (lane in ('music', 'sfx')),
	youtube_id text not null,
	start_seconds numeric not null default 0 check (start_seconds >= 0),
	end_seconds numeric not null check (end_seconds > start_seconds),
	name text not null,
	emoji text not null default '🎵',
	tint_color text,
	volume_pct int not null default 70 check (volume_pct between 0 and 100),
	position int not null default 0,
	created_at timestamptz not null default now()
);
create index if not exists tiles_section_id_idx on public.tiles(section_id);

-- Row-Level Security: a user can only see/modify their own data
alter table public.boards enable row level security;
alter table public.sections enable row level security;
alter table public.tiles enable row level security;

drop policy if exists "boards: owner full access" on public.boards;
create policy "boards: owner full access" on public.boards
	for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "sections: via board owner" on public.sections;
create policy "sections: via board owner" on public.sections
	for all using (
		exists (select 1 from public.boards b where b.id = sections.board_id and b.user_id = auth.uid())
	) with check (
		exists (select 1 from public.boards b where b.id = sections.board_id and b.user_id = auth.uid())
	);

drop policy if exists "tiles: via section's board owner" on public.tiles;
create policy "tiles: via section's board owner" on public.tiles
	for all using (
		exists (
			select 1 from public.sections s
			join public.boards b on b.id = s.board_id
			where s.id = tiles.section_id and b.user_id = auth.uid()
		)
	) with check (
		exists (
			select 1 from public.sections s
			join public.boards b on b.id = s.board_id
			where s.id = tiles.section_id and b.user_id = auth.uid()
		)
	);
