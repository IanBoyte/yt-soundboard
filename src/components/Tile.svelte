<script lang="ts">
	import type { Tile } from '$lib/types';
	import { engine } from '$lib/audio/engine';
	import { editMode, editSheet } from '$lib/stores/ui';
	import { showToast } from '$lib/stores/toast';

	let { tile }: { tile: Tile } = $props();

	const playing = engine.playing;
	let isPlaying = $derived($playing.has(tile.id));

	const laneTint = $derived(
		tile.lane === 'music' ? 'bg-sky-100 dark:bg-sky-700/40' : 'bg-amber-100 dark:bg-amber-700/40'
	);
	const laneBorder = $derived(
		tile.lane === 'music'
			? 'border-sky-400 dark:border-sky-500/60'
			: 'border-amber-400 dark:border-amber-500/60'
	);
	const playingColor = $derived(
		tile.lane === 'music' ? 'text-sky-500 dark:text-sky-400' : 'text-amber-500 dark:text-amber-400'
	);

	function handleClick() {
		if ($editMode) {
			editSheet.set({ mode: 'edit', tile_id: tile.id });
			return;
		}
		if (isPlaying) {
			engine.stop(tile.id);
		} else {
			engine.play(tile).catch((err) => {
				console.error('play failed', err);
				showToast(err instanceof Error ? err.message : 'Could not play this tile.');
			});
		}
	}
</script>

<button
	type="button"
	onclick={handleClick}
	class="group relative flex aspect-square w-full select-none flex-col items-center justify-center gap-1 rounded-2xl border-2 p-2 text-center transition active:scale-95 {laneBorder} {tile.tint_color
		? ''
		: laneTint} {isPlaying ? 'tile-playing ' + playingColor : ''} {$editMode
		? 'ring-2 ring-emerald-400/70'
		: ''}"
	style={tile.tint_color ? `background-color: ${tile.tint_color}55;` : ''}
	aria-pressed={isPlaying}
	aria-label="{isPlaying ? 'Stop' : 'Play'} {tile.name}"
>
	<span class="text-3xl leading-none sm:text-4xl">{tile.emoji}</span>
	<span class="line-clamp-2 text-xs font-medium text-slate-700 dark:text-slate-100/90 sm:text-sm"
		>{tile.name}</span
	>
	{#if $editMode}
		<span
			class="pointer-events-none absolute right-1 top-1 rounded-md bg-emerald-500/80 px-1.5 py-0.5 text-[10px] font-bold uppercase"
			>Edit</span
		>
	{/if}
</button>
