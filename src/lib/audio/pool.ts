/// <reference types="youtube" />
import { writable, type Readable } from 'svelte/store';
import { loadYouTubeApi } from '../youtube';
import { fadeVolume } from './fade';
import type { Tile } from '../types';

const MUSIC_FADE_MS = 500;
// Overlap window when ping-ponging between the two music players. The standby
// player starts ~this far before the loop boundary and the pair crossfades,
// hiding the seek/re-buffer latency that otherwise reads as silence on mobile.
const LOOP_CROSSFADE_MS = 150;
const POLL_MS = 100;
const MAX_PLAYERS = 10;
const TRIM_END_TOLERANCE = 0.15;

interface Slot {
	id: number;
	player: YT.Player;
	div: HTMLDivElement;
	ready: Promise<void>;
	inUse: boolean;
	onEnded?: () => void;
	onPlaying?: () => void;
}

interface ActiveClip {
	tileId: string;
	tile: Tile;
	// Single slot for SFX (and music when the pool can't spare a second player);
	// two slots for double-buffered music looping.
	slots: Slot[];
	activeIndex: number;
	poll: ReturnType<typeof setInterval>;
	cancelFade?: () => void;
	targetVolume: number;
	doubleBuffered: boolean;
	swapping: boolean;
}

function effectiveVolume(tile: Tile, masterPct: number): number {
	return Math.max(0, Math.min(100, Math.round((tile.volume_pct * masterPct) / 100)));
}

class AudioPool {
	private container: HTMLDivElement | null = null;
	private slots: Slot[] = [];
	private active = new Map<string, ActiveClip>();
	private masterPct = 80;
	private _playing = writable<Set<string>>(new Set());

	get playing(): Readable<Set<string>> {
		return this._playing;
	}

	setMasterVolume(pct: number) {
		this.masterPct = Math.max(0, Math.min(100, pct));
		for (const clip of this.active.values()) {
			const v = effectiveVolume(clip.tile, this.masterPct);
			clip.targetVolume = v;
			try {
				// Only the audible slot tracks the target; the standby stays at 0.
				clip.slots[clip.activeIndex].player.setVolume(v);
			} catch {
				// player not ready or destroyed; ignore
			}
		}
	}

	isPlaying(tileId: string): boolean {
		return this.active.has(tileId);
	}

	async play(tile: Tile): Promise<void> {
		await this.ensureContainer();

		if (this.active.has(tile.id)) {
			this.stop(tile.id);
			return;
		}

		const primary = await this.acquireSlot();
		primary.inUse = true;

		// For music, try to grab a second player so we can double-buffer the loop.
		let standby: Slot | null = null;
		if (tile.lane === 'music') {
			standby = await this.tryAcquireSlot();
			if (standby) standby.inUse = true;
		}

		const targetVolume = effectiveVolume(tile, this.masterPct);
		const initialVolume = tile.lane === 'music' ? 0 : targetVolume;

		try {
			primary.player.setVolume(initialVolume);
			primary.player.loadVideoById({
				videoId: tile.youtube_id,
				startSeconds: tile.start_seconds,
				suggestedQuality: 'small'
			});
			primary.player.playVideo();
		} catch (err) {
			primary.inUse = false;
			if (standby) standby.inUse = false;
			throw err;
		}

		const clip: ActiveClip = {
			tileId: tile.id,
			tile,
			slots: standby ? [primary, standby] : [primary],
			activeIndex: 0,
			targetVolume,
			doubleBuffered: !!standby,
			swapping: false,
			poll: setInterval(() => this.onPoll(tile.id), POLL_MS)
		};

		if (tile.lane === 'music') {
			clip.cancelFade = fadeVolume(primary.player, 0, targetVolume, MUSIC_FADE_MS);
			if (standby) this.primeStandby(standby, tile);
		}

		this.setLoopHandlers(clip);
		this.active.set(tile.id, clip);
		this.emit();
	}

	stop(tileId: string): void {
		const clip = this.active.get(tileId);
		if (!clip) return;

		clearInterval(clip.poll);
		clip.cancelFade?.();

		for (const s of clip.slots) {
			s.onEnded = undefined;
			s.onPlaying = undefined;
		}

		const finalise = () => {
			for (const s of clip.slots) {
				try {
					s.player.stopVideo();
				} catch {
					// ignore
				}
				s.inUse = false;
			}
			this.active.delete(tileId);
			this.emit();
		};

		if (clip.tile.lane === 'music') {
			fadeVolume(clip.slots[clip.activeIndex].player, clip.targetVolume, 0, MUSIC_FADE_MS);
			setTimeout(finalise, MUSIC_FADE_MS + 20);
		} else {
			finalise();
		}
	}

	stopAll(): void {
		for (const id of Array.from(this.active.keys())) this.stop(id);
	}

	/**
	 * Load the standby player muted at the loop start and pause it once it has
	 * started decoding, leaving it primed to resume instantly at the next swap.
	 */
	private primeStandby(slot: Slot, tile: Tile) {
		try {
			slot.player.setVolume(0);
			slot.player.loadVideoById({
				videoId: tile.youtube_id,
				startSeconds: tile.start_seconds,
				suggestedQuality: 'small'
			});
			slot.onPlaying = () => {
				slot.onPlaying = undefined;
				try {
					slot.player.pauseVideo();
					slot.player.seekTo(tile.start_seconds, true);
					slot.player.setVolume(0);
				} catch {
					// ignore
				}
			};
		} catch {
			// ignore
		}
	}

	private setLoopHandlers(clip: ActiveClip) {
		for (const slot of clip.slots) {
			slot.onEnded = () => {
				if (!this.active.has(clip.tileId)) return;
				if (clip.tile.lane !== 'music') {
					this.stop(clip.tileId);
					return;
				}
				// Natural end fallback. With double-buffering the poll normally swaps
				// before we get here; if it didn't, swap (or seek) now to keep looping.
				if (clip.doubleBuffered) {
					if (slot === clip.slots[clip.activeIndex]) this.swapLoop(clip);
				} else {
					try {
						slot.player.seekTo(clip.tile.start_seconds, true);
						slot.player.playVideo();
					} catch {
						// ignore
					}
				}
			};
		}
	}

	/** Crossfade from the audible music slot to the pre-buffered standby. */
	private swapLoop(clip: ActiveClip) {
		if (clip.swapping || clip.slots.length < 2) return;
		clip.swapping = true;

		const current = clip.slots[clip.activeIndex];
		const next = clip.slots[1 - clip.activeIndex];

		try {
			next.player.playVideo();
		} catch {
			// ignore
		}

		clip.cancelFade?.();
		fadeVolume(current.player, clip.targetVolume, 0, LOOP_CROSSFADE_MS);
		clip.cancelFade = fadeVolume(next.player, 0, clip.targetVolume, LOOP_CROSSFADE_MS);

		setTimeout(() => {
			// Retire the old slot to standby: paused and re-primed at the loop start.
			try {
				current.player.pauseVideo();
				current.player.seekTo(clip.tile.start_seconds, true);
				current.player.setVolume(0);
			} catch {
				// ignore
			}
			clip.activeIndex = 1 - clip.activeIndex;
			clip.swapping = false;
		}, LOOP_CROSSFADE_MS + 30);
	}

	private onPoll(tileId: string) {
		const clip = this.active.get(tileId);
		if (!clip) return;

		const slot = clip.slots[clip.activeIndex];
		let current = 0;
		try {
			current = slot.player.getCurrentTime();
		} catch {
			return;
		}

		if (clip.tile.lane !== 'music') {
			if (current >= clip.tile.end_seconds - TRIM_END_TOLERANCE) this.stop(tileId);
			return;
		}

		if (clip.doubleBuffered) {
			if (clip.swapping) return;
			// Trigger early enough that the crossfade can finish before the boundary,
			// allowing for poll jitter. Clamp so short loops don't swap immediately.
			const span = clip.tile.end_seconds - clip.tile.start_seconds;
			const lead = Math.min((LOOP_CROSSFADE_MS + POLL_MS) / 1000, Math.max(0, span / 2));
			if (current >= clip.tile.end_seconds - lead) this.swapLoop(clip);
			return;
		}

		// Single-buffer fallback: seek back to the start in place.
		if (current >= clip.tile.end_seconds - TRIM_END_TOLERANCE) {
			try {
				slot.player.seekTo(clip.tile.start_seconds, true);
			} catch {
				// ignore
			}
		}
	}

	private emit() {
		this._playing.set(new Set(this.active.keys()));
	}

	private async ensureContainer() {
		if (this.container) return;
		const c = document.createElement('div');
		c.setAttribute('aria-hidden', 'true');
		c.style.cssText =
			'position:fixed;left:-9999px;top:-9999px;width:320px;height:200px;pointer-events:none;';
		document.body.appendChild(c);
		this.container = c;
	}

	private async acquireSlot(): Promise<Slot> {
		const free = this.slots.find((s) => !s.inUse);
		if (free) {
			await free.ready;
			return free;
		}
		if (this.slots.length >= MAX_PLAYERS) {
			throw new Error('Audio player pool exhausted (max ' + MAX_PLAYERS + ' simultaneous clips).');
		}
		return await this.createSlot();
	}

	/** Like acquireSlot, but returns null instead of throwing when none is free. */
	private async tryAcquireSlot(): Promise<Slot | null> {
		const free = this.slots.find((s) => !s.inUse);
		if (free) {
			await free.ready;
			return free;
		}
		if (this.slots.length >= MAX_PLAYERS) return null;
		return await this.createSlot();
	}

	private async createSlot(): Promise<Slot> {
		const YT = await loadYouTubeApi();
		if (!this.container) await this.ensureContainer();

		const id = this.slots.length;
		const div = document.createElement('div');
		div.id = `yt-slot-${id}`;
		div.style.cssText = 'width:320px;height:200px;';
		this.container!.appendChild(div);

		const slot: Slot = {
			id,
			div,
			inUse: false,
			player: null as unknown as YT.Player,
			ready: Promise.resolve()
		};

		slot.ready = new Promise<void>((resolve) => {
			slot.player = new YT.Player(div, {
				width: '320',
				height: '200',
				playerVars: {
					autoplay: 0,
					controls: 0,
					disablekb: 1,
					modestbranding: 1,
					playsinline: 1,
					rel: 0,
					fs: 0,
					iv_load_policy: 3
				},
				events: {
					onReady: () => resolve(),
					onStateChange: (e: YT.OnStateChangeEvent) => {
						if (e.data === YT.PlayerState.PLAYING) slot.onPlaying?.();
						if (e.data === YT.PlayerState.ENDED) slot.onEnded?.();
					}
				}
			});
		});

		this.slots.push(slot);
		await slot.ready;
		return slot;
	}
}

export const audioPool = new AudioPool();
