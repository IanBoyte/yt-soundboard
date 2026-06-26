<script lang="ts">
	import { onMount } from 'svelte';
	import {
		board,
		loading,
		loadError,
		refresh,
		replaceBoard,
		masterVolume,
		setMasterVolume,
		addSection
	} from '$lib/stores/board';
	import { editMode, editSheet, currentSectionIndex } from '$lib/stores/ui';
	import { toast } from '$lib/stores/toast';
	import { engine } from '$lib/audio/engine';
	import {
		exportConfigFile,
		importConfigFile,
		encodeShareLink,
		readShareFragment,
		clearShareFragment,
		decodeSharePayload
	} from '$lib/storage/config';
	import Section from '$components/Section.svelte';
	import SectionTabs from '$components/SectionTabs.svelte';
	import EditSheet from '$components/EditSheet.svelte';
	import OptionsMenu from '$components/OptionsMenu.svelte';

	let viewport = $state<'mobile' | 'desktop'>('mobile');
	let fileInput: HTMLInputElement;

	const playing = engine.playing;
	let playingCount = $derived($playing.size);

	onMount(() => {
		const mq = window.matchMedia('(min-width: 768px)');
		viewport = mq.matches ? 'desktop' : 'mobile';
		const onChange = (e: MediaQueryListEvent) => (viewport = e.matches ? 'desktop' : 'mobile');
		mq.addEventListener('change', onChange);

		(async () => {
			try {
				await refresh();
				await maybeImportShared();
			} catch (err) {
				loading.set(false);
				loadError.set(err instanceof Error ? err.message : String(err));
			}
		})();

		return () => mq.removeEventListener('change', onChange);
	});

	async function maybeImportShared() {
		const payload = readShareFragment();
		if (!payload) return;
		if (confirm('Import the shared board? This replaces your current board.')) {
			try {
				await replaceBoard(await decodeSharePayload(payload));
				currentSectionIndex.set(0);
			} catch (err) {
				alert('Could not read the shared link: ' + (err instanceof Error ? err.message : err));
			}
		}
		clearShareFragment();
	}

	function setIndex(i: number) {
		currentSectionIndex.set(i);
	}

	async function addSectionPrompt() {
		const name = prompt('Section name?');
		if (!name?.trim()) return;
		await addSection(name.trim());
		const b = $board;
		if (b) currentSectionIndex.set(b.sections.length - 1);
	}

	function exportConfig() {
		if ($board) exportConfigFile($board);
	}

	function triggerImport() {
		fileInput?.click();
	}

	async function onImportFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		if (!confirm('Import this config? It replaces your current board.')) return;
		try {
			await replaceBoard(await importConfigFile(file));
			currentSectionIndex.set(0);
		} catch (err) {
			alert('Import failed: ' + (err instanceof Error ? err.message : err));
		}
	}

	async function shareLink() {
		if (!$board) return;
		const url = await encodeShareLink($board);
		// URLs over ~32k get unwieldy across apps/browsers; fall back to file export.
		if (url.length > 32000) {
			alert('This board is too large for a share link — exporting a config file instead.');
			exportConfig();
			return;
		}
		try {
			await navigator.clipboard.writeText(url);
			alert('Share link copied to clipboard.');
		} catch {
			prompt('Copy this share link:', url);
		}
	}

</script>

<div class="flex h-full flex-col overflow-x-clip">
	<header
		class="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90"
	>
		<button
			type="button"
			onclick={() => engine.stopAll()}
			disabled={playingCount === 0}
			class="rounded-lg bg-rose-600 px-3 py-2 text-sm font-bold text-white shadow disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700"
			aria-label="Stop all"
		>
			Stop All
			{#if playingCount > 0}
				<span class="ml-1 rounded bg-rose-800/70 px-1.5 py-0.5 text-xs">{playingCount}</span>
			{/if}
		</button>

		<label class="flex min-w-0 grow items-center gap-2">
			<span class="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-500">Vol</span>
			<input
				type="range"
				min="0"
				max="100"
				value={$masterVolume}
				oninput={(e) => setMasterVolume(parseInt((e.target as HTMLInputElement).value))}
				class="min-w-0 grow accent-emerald-500"
				aria-label="Master volume"
			/>
			<span class="w-9 text-right font-mono text-xs text-slate-500 dark:text-slate-400"
				>{$masterVolume}%</span
			>
		</label>

		<button
			type="button"
			onclick={() => editMode.update((v) => !v)}
			class="rounded-lg px-3 py-2 text-sm font-medium {$editMode
				? 'bg-emerald-600 text-white'
				: 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}"
			aria-pressed={$editMode}
		>
			{$editMode ? 'Done' : 'Edit'}
		</button>

		<OptionsMenu onExport={exportConfig} onImport={triggerImport} onShare={shareLink} />
	</header>

	<input
		bind:this={fileInput}
		type="file"
		accept="application/json,.json"
		class="hidden"
		onchange={onImportFile}
	/>

	{#if $loading}
		<div class="flex grow items-center justify-center text-sm text-slate-500 dark:text-slate-400">
			Loading board…
		</div>
	{:else if $loadError}
		<div
			class="m-4 rounded-lg bg-rose-100 px-4 py-3 text-sm text-rose-700 dark:bg-rose-900/40 dark:text-rose-200"
		>
			{$loadError}
		</div>
	{:else if $board}
		{@const b = $board}
		{#if b.sections.length === 0}
			<div
				class="m-4 rounded-lg border-2 border-dashed border-slate-300 p-8 text-center dark:border-slate-700"
			>
				<p class="mb-3 text-slate-700 dark:text-slate-300">No sections yet.</p>
				<p class="mb-4 text-sm text-slate-500">
					Create a scene (Tavern, Combat, Forest…) to hold your music and SFX tiles.
				</p>
				<button
					type="button"
					onclick={addSectionPrompt}
					class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
				>
					+ Add your first section
				</button>
			</div>
		{:else if viewport === 'mobile'}
			<SectionTabs sections={b.sections} currentIndex={$currentSectionIndex} onChange={setIndex} />
			<main class="grow overflow-y-auto p-3">
				{#if b.sections[$currentSectionIndex]}
					<Section section={b.sections[$currentSectionIndex]} variant="solo" />
				{/if}
			</main>
		{:else}
			<main class="grow space-y-8 overflow-y-auto p-6">
				{#each b.sections as section, i (section.id)}
					<Section {section} variant="row" index={i} total={b.sections.length} />
				{/each}
				{#if $editMode}
					<div class="flex justify-center pt-2">
						<button
							type="button"
							onclick={addSectionPrompt}
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

	{#if $toast}
		<div
			class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
			role="status"
			aria-live="polite"
		>
			<div
				class="pointer-events-auto max-w-md rounded-lg bg-slate-900 px-4 py-2.5 text-center text-sm text-white shadow-lg ring-1 ring-white/10 dark:bg-slate-700"
			>
				{$toast}
			</div>
		</div>
	{/if}
</div>
