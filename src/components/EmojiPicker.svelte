<script lang="ts">
	import { onMount } from 'svelte';
	import { theme } from '$lib/stores/theme';

	let {
		value,
		onPick
	}: {
		value: string;
		onPick: (emoji: string) => void;
	} = $props();

	let open = $state(false);
	let loaded = $state(false);

	onMount(async () => {
		await import('emoji-picker-element');
		loaded = true;
	});

	function handleEmojiClick(e: Event) {
		const detail = (e as CustomEvent).detail as { unicode?: string };
		if (detail?.unicode) {
			onPick(detail.unicode);
			open = false;
		}
	}
</script>

<button
	type="button"
	onclick={() => (open = true)}
	class="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-slate-300 bg-white text-2xl hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
	aria-label="Pick emoji"
>
	{value}
</button>

{#if open && loaded}
	<!-- Fixed overlay so the picker is never clipped by the edit-sheet's scroll container. -->
	<div
		class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
		role="presentation"
		onclick={() => (open = false)}
	>
		<div role="presentation" onclick={(e) => e.stopPropagation()}>
			<!-- @ts-expect-error: emoji-picker custom element -->
			<emoji-picker class="{$theme} picker" onemoji-click={handleEmojiClick}></emoji-picker>
		</div>
	</div>
{/if}

<style>
	.picker {
		max-width: 100%;
		width: 22rem;
		height: min(28rem, 70vh);
		border-radius: 0.75rem;
		overflow: hidden;
	}
</style>
