<script lang="ts">
	/// <reference types="youtube" />
	import { onMount, onDestroy } from 'svelte';
	import { loadYouTubeApi } from '$lib/youtube';

	let {
		youtubeId,
		startSeconds,
		endSeconds,
		onSetStart,
		onSetEnd
	}: {
		youtubeId: string | null;
		startSeconds: number;
		endSeconds: number;
		onSetStart: (s: number) => void;
		onSetEnd: (s: number) => void;
	} = $props();

	let container: HTMLDivElement;
	let player: YT.Player | null = null;
	let ready = $state(false);
	let currentTime = $state(0);
	let previewing = $state(false);
	let pollHandle: ReturnType<typeof setInterval> | null = null;

	$effect(() => {
		// (re)load the video when youtubeId changes
		if (player && ready && youtubeId) {
			try {
				player.cueVideoById({ videoId: youtubeId, startSeconds });
			} catch {
				// ignore
			}
		}
	});

	onMount(async () => {
		const YT = await loadYouTubeApi();
		player = new YT.Player(container, {
			width: '100%',
			height: '180',
			videoId: youtubeId ?? undefined,
			playerVars: {
				autoplay: 0,
				controls: 1,
				modestbranding: 1,
				rel: 0,
				playsinline: 1,
				start: Math.floor(startSeconds)
			},
			events: {
				onReady: () => {
					ready = true;
				}
			}
		});

		pollHandle = setInterval(() => {
			if (!player) return;
			try {
				currentTime = player.getCurrentTime();
				if (previewing && currentTime >= endSeconds) {
					player.pauseVideo();
					previewing = false;
				}
			} catch {
				// not ready
			}
		}, 150);
	});

	onDestroy(() => {
		if (pollHandle) clearInterval(pollHandle);
		try {
			player?.destroy();
		} catch {
			// ignore
		}
	});

	function setStartFromPlayhead() {
		onSetStart(Math.max(0, Math.round(currentTime * 10) / 10));
	}
	function setEndFromPlayhead() {
		onSetEnd(Math.max(startSeconds + 0.5, Math.round(currentTime * 10) / 10));
	}
	function previewTrim() {
		if (!player) return;
		try {
			player.seekTo(startSeconds, true);
			player.playVideo();
			previewing = true;
		} catch {
			// ignore
		}
	}
</script>

<div class="space-y-2">
	<div bind:this={container} class="aspect-video w-full overflow-hidden rounded-lg bg-black"></div>

	<div class="flex flex-wrap gap-2 text-xs">
		<span class="rounded bg-slate-700/60 px-2 py-1 font-mono">
			Playhead: {currentTime.toFixed(1)}s
		</span>
		<button
			type="button"
			onclick={setStartFromPlayhead}
			disabled={!ready}
			class="rounded bg-sky-600/80 px-2 py-1 font-medium text-white hover:bg-sky-500 disabled:opacity-40"
		>
			Set start = playhead
		</button>
		<button
			type="button"
			onclick={setEndFromPlayhead}
			disabled={!ready}
			class="rounded bg-amber-600/80 px-2 py-1 font-medium text-white hover:bg-amber-500 disabled:opacity-40"
		>
			Set end = playhead
		</button>
		<button
			type="button"
			onclick={previewTrim}
			disabled={!ready}
			class="rounded bg-emerald-600/80 px-2 py-1 font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
		>
			Preview start→end
		</button>
	</div>
</div>
