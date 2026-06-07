<script lang="ts">
	import type { Section, Tile } from '$lib/types';
	import TileButton from './Tile.svelte';
	import { editMode, editSheet } from '$lib/stores/ui';
	import { dndzone } from 'svelte-dnd-action';
	import { reorderTilesInLane } from '$lib/stores/board';
	import { flip } from 'svelte/animate';

	let { section }: { section: Section & { tiles: Tile[] } } = $props();

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
	<header class="flex items-baseline justify-between">
		<h2 class="text-lg font-semibold text-slate-100">{section.name}</h2>
		<span class="text-xs uppercase tracking-wider text-slate-500"
			>{music.length} music · {sfx.length} sfx</span
		>
	</header>

	<div>
		<h3 class="mb-2 text-xs uppercase tracking-wider text-sky-400">Music</h3>
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
		<h3 class="mb-2 text-xs uppercase tracking-wider text-amber-400">SFX</h3>
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
</section>
