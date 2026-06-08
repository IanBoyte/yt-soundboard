<script lang="ts">
	import type { Section, Tile } from '$lib/types';
	import TileButton from './Tile.svelte';
	import { editMode, editSheet, collapsedSections, toggleCollapsed } from '$lib/stores/ui';
	import { dndzone } from 'svelte-dnd-action';
	import {
		reorderTilesInLane,
		moveSection,
		renameSection,
		deleteSection
	} from '$lib/stores/board';
	import { flip } from 'svelte/animate';

	let {
		section,
		index = 0,
		total = 1,
		variant = 'row'
	}: {
		section: Section & { tiles: Tile[] };
		index?: number;
		total?: number;
		/** 'row' = desktop stacked view (collapsible + full edit controls); 'solo' = mobile single-section view (tabs own nav/edit). */
		variant?: 'row' | 'solo';
	} = $props();

	const collapsed = $derived(variant === 'row' && $collapsedSections.has(section.id));

	async function handleRename() {
		const name = prompt('Rename section', section.name);
		if (!name?.trim() || name === section.name) return;
		await renameSection(section.id, name.trim());
	}

	async function handleDelete() {
		if (!confirm(`Delete section "${section.name}" and all its tiles?`)) return;
		await deleteSection(section.id);
	}

	const music = $derived(
		section.tiles.filter((t) => t.lane === 'music').sort((a, b) => a.position - b.position)
	);
	const sfx = $derived(
		section.tiles.filter((t) => t.lane === 'sfx').sort((a, b) => a.position - b.position)
	);

	function onMusicReorder(e: CustomEvent<{ items: Tile[] }>) {
		const ids = e.detail.items.map((t) => t.id);
		reorderTilesInLane(section.id, 'music', ids).catch((err) => console.error(err));
	}

	function onSfxReorder(e: CustomEvent<{ items: Tile[] }>) {
		const ids = e.detail.items.map((t) => t.id);
		reorderTilesInLane(section.id, 'sfx', ids).catch((err) => console.error(err));
	}

	function openAdd(lane: 'music' | 'sfx') {
		editSheet.set({ mode: 'create', section_id: section.id, lane });
	}

	const dndOpts = $derived({
		dragDisabled: !$editMode,
		flipDurationMs: 200,
		dropTargetStyle: { outline: '2px dashed rgb(16 185 129 / 0.7)' }
	});
</script>

<section class="space-y-4">
	<header class="flex items-center justify-between gap-2">
		<div class="flex min-w-0 items-center gap-2">
			{#if variant === 'row'}
				<button
					type="button"
					onclick={() => toggleCollapsed(section.id)}
					class="rounded p-1 text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800"
					aria-label={collapsed ? 'Expand section' : 'Collapse section'}
					aria-expanded={!collapsed}
				>
					<svg
						viewBox="0 0 24 24"
						class="h-5 w-5 transition-transform {collapsed ? '-rotate-90' : ''}"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M6 9l6 6 6-6" />
					</svg>
				</button>
			{/if}
			<h2 class="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">
				{section.name}
			</h2>
			<span class="shrink-0 text-xs uppercase tracking-wider text-slate-500"
				>{music.length} music · {sfx.length} sfx</span
			>
		</div>

		{#if variant === 'row' && $editMode}
			<div class="flex shrink-0 items-center gap-1">
				<button
					type="button"
					onclick={() => moveSection(section.id, -1)}
					disabled={index === 0}
					class="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800"
					aria-label="Move section up">▲</button
				>
				<button
					type="button"
					onclick={() => moveSection(section.id, 1)}
					disabled={index === total - 1}
					class="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800"
					aria-label="Move section down">▼</button
				>
				<button
					type="button"
					onclick={handleRename}
					class="rounded p-1 text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800"
					aria-label="Rename section">✎</button
				>
				<button
					type="button"
					onclick={handleDelete}
					class="rounded p-1 text-rose-500 hover:bg-rose-500/20 dark:text-rose-400"
					aria-label="Delete section">×</button
				>
			</div>
		{/if}
	</header>

	{#if !collapsed}
	<div>
		<h3 class="mb-2 text-xs uppercase tracking-wider text-sky-600 dark:text-sky-400">Music</h3>
		<div
			class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
			use:dndzone={{ ...dndOpts, items: music, type: `music-${section.id}` }}
			onconsider={onMusicReorder}
			onfinalize={onMusicReorder}
		>
			{#each music as tile (tile.id)}
				<div animate:flip={{ duration: 200 }}>
					<TileButton {tile} />
				</div>
			{/each}
			{#if $editMode}
				<button
					type="button"
					onclick={() => openAdd('music')}
					class="aspect-square w-full rounded-2xl border-2 border-dashed border-sky-500/60 text-3xl text-sky-400/80 transition hover:bg-sky-500/10"
					aria-label="Add music tile"
				>
					+
				</button>
			{/if}
		</div>
	</div>

	<div>
		<h3 class="mb-2 text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400">SFX</h3>
		<div
			class="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8"
			use:dndzone={{ ...dndOpts, items: sfx, type: `sfx-${section.id}` }}
			onconsider={onSfxReorder}
			onfinalize={onSfxReorder}
		>
			{#each sfx as tile (tile.id)}
				<div animate:flip={{ duration: 200 }}>
					<TileButton {tile} />
				</div>
			{/each}
			{#if $editMode}
				<button
					type="button"
					onclick={() => openAdd('sfx')}
					class="aspect-square w-full rounded-2xl border-2 border-dashed border-amber-500/60 text-3xl text-amber-400/80 transition hover:bg-amber-500/10"
					aria-label="Add SFX tile"
				>
					+
				</button>
			{/if}
		</div>
	</div>
	{/if}
</section>
