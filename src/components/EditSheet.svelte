<script lang="ts">
	import { editSheet, type EditSheetTarget } from '$lib/stores/ui';
	import { board, addTile, updateTile, deleteTile } from '$lib/stores/board';
	import type { Lane, Tile } from '$lib/types';
	import { parseYouTubeId, parseStartSeconds, fetchVideoMeta } from '$lib/youtube';
	import { formatTime, parseTime } from '$lib/time';
	import EmojiPicker from './EmojiPicker.svelte';
	import PreviewPlayer from './PreviewPlayer.svelte';

	let { target }: { target: EditSheetTarget } = $props();

	const currentBoard = $derived($board);
	const existing: Tile | null = $derived.by(() => {
		if (target.mode !== 'edit') return null;
		if (!currentBoard) return null;
		for (const s of currentBoard.sections) {
			const t = s.tiles.find((x) => x.id === target.tile_id);
			if (t) return t;
		}
		return null;
	});

	let url = $state('');
	let name = $state('');
	let emoji = $state('🎵');
	let lane = $state<Lane>('music');
	let sectionId = $state('');
	let startStr = $state('0:00');
	let endStr = $state('');
	let volume = $state(70);
	let tintColor = $state<string | null>(null);
	let youtubeId = $state<string | null>(null);
	let saving = $state(false);
	let error = $state<string | null>(null);
	let metaLoading = $state(false);
	let videoDuration = $state(0);
	let endTouched = $state(false);

	$effect(() => {
		// initialise once on mount based on target / existing
		if (existing) {
			url = `https://youtu.be/${existing.youtube_id}`;
			youtubeId = existing.youtube_id;
			name = existing.name;
			emoji = existing.emoji;
			lane = existing.lane;
			sectionId = existing.section_id;
			startStr = formatTime(existing.start_seconds);
			endStr = formatTime(existing.end_seconds);
			endTouched = true;
			volume = existing.volume_pct;
			tintColor = existing.tint_color;
		} else if (target.mode === 'create') {
			lane = target.lane;
			sectionId = target.section_id;
			emoji = target.lane === 'music' ? '🎵' : '⚡';
		}
	});

	function onDurationKnown(seconds: number) {
		videoDuration = seconds;
		// Default the end to the full video length unless the user set it themselves.
		if (!endTouched) endStr = formatTime(seconds);
	}

	async function onUrlChanged() {
		error = null;
		const id = parseYouTubeId(url);
		if (!id) {
			youtubeId = null;
			return;
		}
		const changed = id !== youtubeId;
		youtubeId = id;
		if (changed) {
			// New video → re-default the end to its length once known.
			videoDuration = 0;
			endTouched = false;
			endStr = '';
		}
		const start = parseStartSeconds(url);
		if (start != null) startStr = formatTime(start);
		if (!name) {
			metaLoading = true;
			try {
				const meta = await fetchVideoMeta(id);
				if (!name) name = meta.title;
			} finally {
				metaLoading = false;
			}
		}
	}

	function close() {
		editSheet.set(null);
	}

	async function save() {
		error = null;
		const startSec = parseTime(startStr);
		// Blank end = play to the end of the video.
		const endSec = endStr.trim() === '' ? videoDuration : parseTime(endStr);
		if (!youtubeId) {
			error = 'Paste a valid YouTube URL.';
			return;
		}
		if (!name.trim()) {
			error = 'Give the tile a name.';
			return;
		}
		if (isNaN(startSec)) {
			error = 'Start time is invalid.';
			return;
		}
		if (endStr.trim() === '' && !(videoDuration > 0)) {
			error = 'Still loading the video length — give it a second, then save.';
			return;
		}
		if (isNaN(endSec) || endSec <= startSec) {
			error = 'End time must be after start time.';
			return;
		}
		saving = true;
		try {
			const base = {
				youtube_id: youtubeId,
				name: name.trim(),
				emoji,
				volume_pct: volume,
				tint_color: tintColor,
				start_seconds: startSec,
				end_seconds: endSec
			};

			if (existing) {
				const sectionChanged = sectionId !== existing.section_id;
				const laneChanged = lane !== existing.lane;
				let position = existing.position;
				if (sectionChanged || laneChanged) {
					const newSection = $board?.sections.find((s) => s.id === sectionId);
					position = newSection?.tiles.filter((t) => t.lane === lane).length ?? 0;
				}
				await updateTile(existing.id, {
					...base,
					lane,
					section_id: sectionId,
					position
				});
			} else {
				await addTile(sectionId, lane, base);
			}
			close();
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			saving = false;
		}
	}

	async function remove() {
		if (!existing) return;
		if (!confirm(`Delete "${existing.name}"?`)) return;
		saving = true;
		try {
			await deleteTile(existing.id);
			close();
		} finally {
			saving = false;
		}
	}
</script>

<div
	class="fixed inset-0 z-40 flex items-end justify-center bg-black/70 sm:items-center"
	role="dialog"
	aria-modal="true"
>
	<div
		class="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-y-auto overscroll-contain rounded-t-2xl bg-white px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-slate-100 sm:rounded-2xl sm:pb-5"
	>
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-semibold">
				{existing ? 'Edit tile' : 'Add tile'}
			</h2>
			<button
				type="button"
				onclick={close}
				class="rounded p-1 text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800"
				aria-label="Close">✕</button
			>
		</div>

		<div class="space-y-4">
			<label class="block">
				<span class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">YouTube URL</span>
				<input
					type="url"
					bind:value={url}
					onblur={onUrlChanged}
					onpaste={() => setTimeout(onUrlChanged, 0)}
					placeholder="https://youtu.be/..."
					class="w-full rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
				/>
				{#if metaLoading}
					<span class="text-xs text-slate-500">Fetching title…</span>
				{/if}
			</label>

			{#if youtubeId}
				<PreviewPlayer
					{youtubeId}
					startSeconds={parseTime(startStr) || 0}
					endSeconds={parseTime(endStr) || videoDuration || 0}
					onSetStart={(s) => (startStr = formatTime(s))}
					onSetEnd={(s) => {
						endTouched = true;
						endStr = formatTime(s);
					}}
					onDuration={onDurationKnown}
				/>
			{/if}

			<div class="flex gap-3">
				<div class="grow space-y-1">
					<span class="text-sm font-medium text-slate-700 dark:text-slate-300">Name</span>
					<input
						type="text"
						bind:value={name}
						class="w-full rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
					/>
				</div>
				<div class="space-y-1">
					<span class="text-sm font-medium text-slate-700 dark:text-slate-300">Emoji</span>
					<EmojiPicker value={emoji} onPick={(e) => (emoji = e)} />
				</div>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<label class="block">
					<span class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Start</span>
					<input
						type="text"
						bind:value={startStr}
						placeholder="0:00"
						class="w-full rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800 px-3 py-2 font-mono text-sm"
					/>
				</label>
				<label class="block">
					<span class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
						End
						<span class="font-normal text-slate-500">(blank = end of video)</span>
					</span>
					<input
						type="text"
						bind:value={endStr}
						oninput={() => (endTouched = true)}
						placeholder={videoDuration > 0 ? formatTime(videoDuration) : 'end of video'}
						class="w-full rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800 px-3 py-2 font-mono text-sm"
					/>
				</label>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<label class="block">
					<span class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Lane</span>
					<select
						bind:value={lane}
						class="w-full rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
					>
						<option value="music">Music (loops)</option>
						<option value="sfx">SFX (one-shot)</option>
					</select>
				</label>
				<label class="block">
					<span class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Section</span>
					<select
						bind:value={sectionId}
						class="w-full rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm"
					>
						{#each $board?.sections ?? [] as s (s.id)}
							<option value={s.id}>{s.name}</option>
						{/each}
					</select>
				</label>
			</div>

			<label class="block">
				<span class="mb-1 flex justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
					<span>Volume</span>
					<span class="font-mono text-slate-400">{volume}%</span>
				</span>
				<input
					type="range"
					min="0"
					max="100"
					bind:value={volume}
					class="w-full accent-emerald-500"
				/>
			</label>

			<div class="flex items-center gap-3">
				<span class="text-sm font-medium text-slate-700 dark:text-slate-300">Tint</span>
				<input
					type="color"
					value={tintColor ?? '#475569'}
					oninput={(e) => (tintColor = (e.target as HTMLInputElement).value)}
					class="h-9 w-12 rounded border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800"
				/>
				{#if tintColor}
					<button
						type="button"
						onclick={() => (tintColor = null)}
						class="text-xs text-slate-400 hover:text-slate-200">Clear tint</button
					>
				{/if}
			</div>

			{#if error}
				<p
					class="rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/40 dark:text-rose-200"
				>
					{error}
				</p>
			{/if}

			<div class="flex justify-between pt-2">
				{#if existing}
					<button
						type="button"
						onclick={remove}
						disabled={saving}
						class="rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-50"
					>
						Delete
					</button>
				{:else}
					<span></span>
				{/if}
				<div class="flex gap-2">
					<button
						type="button"
						onclick={close}
						class="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={save}
						disabled={saving}
						class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
					>
						{saving ? 'Saving…' : 'Save'}
					</button>
				</div>
			</div>
		</div>
	</div>
</div>
