/// <reference types="youtube" />
import { writable, type Readable } from 'svelte/store';
import { loadYouTubeApi } from '../youtube';
import { showToast } from '../stores/toast';
import type { Tile } from '../types';

/**
 * YouTube IFrame playback, tuned for low-end mobile. Versus a naive pool this:
 *   - caps live players at a small number and DESTROYS idle ones to free memory
 *     (each YouTube iframe carries a heavy JS/decode footprint),
 *   - uses ONE adaptive timer per clip to detect the trim boundary instead of
 *     polling every clip at 100ms, and
 *   - drops the double-buffer/crossfade looping hack (one player per clip).
 *
 * Trade-off: looping a trimmed range seeks back to the start, so there is a
 * short gap at the loop point. Pick clips that loop cleanly, or where ambient
 * noise hides the seam.
 */

const MAX_PLAYERS = 4; // simultaneous clips; evicts the oldest beyond this
const KEEP_WARM_IDLE = 1; // idle players to keep ready; destroy the rest
const MUSIC_FADE_MS = 400;
const BOUNDARY_PAD_MS = 120; // let playback actually reach the trim end
const BOUNDARY_TOLERANCE = 0.35; // seconds of slack before we treat end as reached

interface Slot {
	id: number;
	div: HTMLDivElement;
	player: YT.Player;
	ready: Promise<void>;
	inUse: boolean;
}

interface ActiveClip {
	tileId: string;
	tile: Tile;
	slot: Slot;
	seq: number;
	timer: ReturnType<typeof setTimeout> | null;
	cancelFade?: () => void;
	targetVolume: number;
}

function effectiveVolume(tile: Tile, masterPct: number): number {
	return Math.max(0, Math.min(100, Math.round((tile.volume_pct * masterPct) / 100)));
}

class AudioEngine {
	private container: HTMLDivElement | null = null;
	private slots: Slot[] = [];
	private active = new Map<string, ActiveClip>();
	private masterPct = 80;
	private seqCounter = 0;
	private _playing = writable<Set<string>>(new Set());

	get playing(): Readable<Set<string>> {
		return this._playing;
	}

	setMasterVolume(pct: number): void {
		this.masterPct = Math.max(0, Math.min(100, pct));
		for (const clip of this.active.values()) {
			clip.targetVolume = effectiveVolume(clip.tile, this.masterPct);
			try {
				clip.slot.player.setVolume(clip.targetVolume);
			} catch {
				// player not ready / destroyed
			}
		}
	}

	isPlaying(tileId: string): boolean {
		return this.active.has(tileId);
	}

	async play(tile: Tile): Promise<void> {
		// Pressing a playing tile stops it.
		if (this.active.has(tile.id)) {
			this.stop(tile.id);
			return;
		}

		await this.ensureContainer();
		const slot = await this.acquireSlot();
		slot.inUse = true;

		const targetVolume = effectiveVolume(tile, this.masterPct);
		const clip: ActiveClip = {
			tileId: tile.id,
			tile,
			slot,
			seq: ++this.seqCounter,
			timer: null,
			targetVolume
		};

		try {
			slot.player.setVolume(tile.lane === 'music' ? 0 : targetVolume);
			slot.player.loadVideoById({
				videoId: tile.youtube_id,
				startSeconds: tile.start_seconds,
				suggestedQuality: 'small'
			});
			slot.player.playVideo();
		} catch (err) {
			slot.inUse = false;
			throw err;
		}

		if (tile.lane === 'music') {
			clip.cancelFade = this.fade(slot.player, 0, targetVolume, MUSIC_FADE_MS);
		}

		this.active.set(tile.id, clip);
		this.scheduleBoundary(clip);
		this.emit();
	}

	stop(tileId: string): void {
		const clip = this.active.get(tileId);
		if (!clip) return;
		this.active.delete(tileId);
		this.emit();

		if (clip.timer) clearTimeout(clip.timer);
		clip.cancelFade?.();

		if (clip.tile.lane === 'music') {
			this.fade(clip.slot.player, clip.targetVolume, 0, MUSIC_FADE_MS, () =>
				this.finalise(clip.slot)
			);
		} else {
			this.finalise(clip.slot);
		}
	}

	stopAll(): void {
		for (const id of Array.from(this.active.keys())) this.stop(id);
	}

	private finalise(slot: Slot): void {
		try {
			slot.player.stopVideo();
		} catch {
			// ignore
		}
		slot.inUse = false;
		this.pruneIdle();
	}

	/**
	 * One self-correcting timer per clip. Fires near the trim end; if playback
	 * lagged (buffering) it reschedules, otherwise it loops (music) or stops (sfx).
	 */
	private scheduleBoundary(clip: ActiveClip): void {
		if (clip.timer) clearTimeout(clip.timer);
		let current = clip.tile.start_seconds;
		try {
			const t = clip.slot.player.getCurrentTime();
			if (Number.isFinite(t) && t > 0) current = t;
		} catch {
			// not ready yet; assume start
		}
		const remainMs = Math.max(0, (clip.tile.end_seconds - current) * 1000) + BOUNDARY_PAD_MS;
		clip.timer = setTimeout(() => this.onBoundary(clip), remainMs);
	}

	private onBoundary(clip: ActiveClip): void {
		if (!this.active.has(clip.tileId)) return;
		let current = clip.tile.end_seconds;
		try {
			current = clip.slot.player.getCurrentTime();
		} catch {
			// ignore
		}
		// Playback hasn't reached the end yet (buffering/stall) — wait some more.
		if (current < clip.tile.end_seconds - BOUNDARY_TOLERANCE) {
			this.scheduleBoundary(clip);
			return;
		}
		if (clip.tile.lane === 'music') {
			try {
				clip.slot.player.seekTo(clip.tile.start_seconds, true);
			} catch {
				// ignore
			}
			this.scheduleBoundary(clip);
		} else {
			this.stop(clip.tileId);
		}
	}

	/** Short stepped volume ramp; returns a cancel fn. Self-clears when done. */
	private fade(
		player: YT.Player,
		from: number,
		to: number,
		ms: number,
		onDone?: () => void
	): () => void {
		const steps = Math.max(1, Math.round(ms / 50));
		let i = 0;
		try {
			player.setVolume(from);
		} catch {
			// ignore
		}
		const iv = setInterval(() => {
			i++;
			const v = Math.round(from + (to - from) * (i / steps));
			try {
				player.setVolume(v);
			} catch {
				// ignore
			}
			if (i >= steps) {
				clearInterval(iv);
				onDone?.();
			}
		}, 50);
		return () => clearInterval(iv);
	}

	private emit(): void {
		this._playing.set(new Set(this.active.keys()));
	}

	private async ensureContainer(): Promise<void> {
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
		if (this.slots.length < MAX_PLAYERS) {
			return this.createSlot();
		}
		// At capacity: evict the oldest-started clip and reuse its slot.
		let oldest: ActiveClip | null = null;
		for (const clip of this.active.values()) {
			if (!oldest || clip.seq < oldest.seq) oldest = clip;
		}
		if (oldest) {
			const slot = oldest.slot;
			if (oldest.timer) clearTimeout(oldest.timer);
			oldest.cancelFade?.();
			this.active.delete(oldest.tileId);
			this.emit();
			try {
				slot.player.stopVideo();
			} catch {
				// ignore
			}
			slot.inUse = false;
			return slot;
		}
		// Shouldn't happen, but fall back to a fresh slot.
		return this.createSlot();
	}

	/** Destroy idle players beyond the warm-keep count to release memory. */
	private pruneIdle(): void {
		const idle = this.slots.filter((s) => !s.inUse);
		for (const slot of idle.slice(KEEP_WARM_IDLE)) {
			try {
				slot.player.destroy();
			} catch {
				// ignore
			}
			slot.div.remove();
			this.slots = this.slots.filter((s) => s !== slot);
		}
	}

	private async createSlot(): Promise<Slot> {
		const YT = await loadYouTubeApi();
		await this.ensureContainer();

		const div = document.createElement('div');
		this.container!.appendChild(div);

		const slot: Slot = {
			id: ++this.seqCounter,
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
					onStateChange: (e: YT.OnStateChangeEvent) => this.onStateChange(slot, e),
					onError: () => this.onError(slot)
				}
			});
		});

		this.slots.push(slot);
		await slot.ready;
		return slot;
	}

	private clipForSlot(slot: Slot): ActiveClip | null {
		for (const clip of this.active.values()) if (clip.slot === slot) return clip;
		return null;
	}

	private onStateChange(slot: Slot, e: YT.OnStateChangeEvent): void {
		if (e.data !== YT.PlayerState.ENDED) return;
		// Video hit its natural end before our trim timer (end >= duration).
		const clip = this.clipForSlot(slot);
		if (!clip) return;
		if (clip.tile.lane === 'music') {
			try {
				slot.player.seekTo(clip.tile.start_seconds, true);
				slot.player.playVideo();
			} catch {
				// ignore
			}
			this.scheduleBoundary(clip);
		} else {
			this.stop(clip.tileId);
		}
	}

	private onError(slot: Slot): void {
		const clip = this.clipForSlot(slot);
		const name = clip ? `"${clip.tile.name}"` : 'A tile';
		showToast(`${name} can't play — the video may be unavailable or block embedding.`);
		if (clip) this.stop(clip.tileId);
	}
}

export const engine = new AudioEngine();
