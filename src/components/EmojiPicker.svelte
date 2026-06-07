<script lang="ts">
	import { onMount } from 'svelte';

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

<div class="relative inline-block">
	<button
		type="button"
		onclick={() => (open = !open)}
		class="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-slate-700 bg-slate-800 text-2xl hover:border-slate-600"
		aria-label="Pick emoji"
	>
		{value}
	</button>
	{#if open && loaded}
		<div class="absolute left-0 top-full z-50 mt-2">
			<!-- @ts-expect-error: emoji-picker custom element -->
			<emoji-picker class="dark" onemoji-click={handleEmojiClick}></emoji-picker>
		</div>
	{/if}
</div>
