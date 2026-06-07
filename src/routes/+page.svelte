<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getSession, signOut } from '$lib/supabase';
	import { board, loading, loadError, refresh, masterVolume, setMasterVolume } from '$lib/stores/board';
	import { editMode, editSheet, currentSectionIndex } from '$lib/stores/ui';
	import { audioPool } from '$lib/audio/pool';
	import Section from '$components/Section.svelte';
	import SectionTabs from '$components/SectionTabs.svelte';
	import EditSheet from '$components/EditSheet.svelte';

	let viewport = $state<'mobile' | 'desktop'>('mobile');

	const playing = audioPool.playing;
	let playingCount = $derived($playing.size);

	onMount(() => {
		const mq = window.matchMedia('(min-width: 768px)');
		viewport = mq.matches ? 'desktop' : 'mobile';
		const onChange = (e: MediaQueryListEvent) => (viewport = e.matches ? 'desktop' : 'mobile');
		mq.addEventListener('change', onChange);

		(async () => {
			const session = await getSession();
			if (!session) {
				goto('/auth');
				return;
			}
			await refresh();
		})();

		return () => mq.removeEventListener('change', onChange);
	});

	function setIndex(i: number) {
		currentSectionIndex.set(i);
	}

	async function logout() {
		audioPool.stopAll();
		await signOut();
		goto('/auth');
	}
</script>

<div class="flex h-full flex-col">
	<header
		class="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-800 bg-slate-900/90 px-3 py-2 backdrop-blur"
	>
		<button
			type="button"
			onclick={() => audioPool.stopAll()}
			disabled={playingCount === 0}
			class="rounded-lg bg-rose-600 px-3 py-2 text-sm font-bold text-white shadow disabled:bg-slate-700 disabled:text-slate-500"
			aria-label="Stop all"
		>
			Stop All
			{#if playingCount > 0}
				<span class="ml-1 rounded bg-rose-800/70 px-1.5 py-0.5 text-xs">{playingCount}</span>
			{/if}
		</button>

		<label class="flex grow items-center gap-2">
			<span class="text-xs uppercase tracking-wider text-slate-500">Vol</span>
			<input
				type="range"
				min="0"
				max="100"
				value={$masterVolume}
				oninput={(e) => setMasterVolume(parseInt((e.target as HTMLInputElement).value))}
				class="grow accent-emerald-500"
				aria-label="Master volume"
			/>
			<span class="w-9 text-right font-mono text-xs text-slate-400">{$masterVolume}%</span>
		</label>

		<button
			type="button"
			onclick={() => editMode.update((v) => !v)}
			class="rounded-lg px-3 py-2 text-sm font-medium {$editMode
				? 'bg-emerald-600 text-white'
				: 'bg-slate-800 text-slate-200 hover:bg-slate-700'}"
			aria-pressed={$editMode}
		>
			{$editMode ? 'Done' : 'Edit'}
		</button>

		<button
			type="button"
			onclick={logout}
			class="rounded-lg px-2 py-2 text-xs text-slate-500 hover:bg-slate-800 hover:text-slate-300"
			title="Sign out"
		>
			↪
		</button>
	</header>

	{#if $loading}
		<div class="flex grow items-center justify-center text-sm text-slate-400">Loading board…</div>
	{:else if $loadError}
		<div class="m-4 rounded-lg bg-rose-900/40 px-4 py-3 text-sm text-rose-200">
			{$loadError}
		</div>
	{:else if $board}
		{@const b = $board}
		{#if b.sections.length === 0}
			<div class="m-4 rounded-lg border-2 border-dashed border-slate-700 p-8 text-center">
				<p class="mb-3 text-slate-300">No sections yet.</p>
				<p class="mb-3 text-sm text-slate-500">
					Hit <span class="font-semibold">Edit</span> above, then add a section to get started.
				</p>
			</div>
		{:else if viewport === 'mobile'}
			<SectionTabs sections={b.sections} currentIndex={$currentSectionIndex} onChange={setIndex} />
			<main class="grow overflow-y-auto p-3">
				{#if b.sections[$currentSectionIndex]}
					<Section section={b.sections[$currentSectionIndex]} />
				{/if}
			</main>
		{:else}
			<main class="grow space-y-8 overflow-y-auto p-6">
				{#each b.sections as section (section.id)}
					<Section {section} />
				{/each}
				{#if $editMode}
					<div class="flex justify-center pt-2">
						<button
							type="button"
							onclick={async () => {
								const name = prompt('Section name?');
								if (!name?.trim()) return;
								const { addSection } = await import('$lib/stores/board');
								await addSection(name.trim());
							}}
							class="rounded-lg border-2 border-dashed border-emerald-500/60 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/10"
						>
							+ Add Section
						</button>
					</div>
				{/if}
			</main>
		{/if}
	{/if}

	{#if $editSheet}
		<EditSheet target={$editSheet} />
	{/if}
</div>
