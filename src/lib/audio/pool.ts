/// <reference types="youtube" />
import { writable, type Readable } from 'svelte/store';
import { loadYouTubeApi } from '../youtube';
import { fadeVolume } from './fade';
import type { Tile } from '../types';

const MUSIC_FADE_MS = 500;
const POLL_MS = 200;
const MAX_PLAYERS = 10;
const TRIM_END_TOLERANCE = 0.15;

interface Slot {
	id: number;
	player: YT.Player;
	div: HTMLDivElement;
	ready: Promise<void>;
	inUse: boolean;
}

interface ActiveClip {
	tileId: string;
	tile: Tile;
	slot: Slot;
	poll: ReturnType<typeof setInterval>;
	cancelFade?: () => void;
	targetVolume: number;
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
				clip.slot.player.setVolume(v);
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

		const slot = await this.acquireSlot();
		slot.inUse = true;

		const targetVolume = effectiveVolume(tile, this.masterPct);
		const initialVolume = tile.lane === 'music' ? 0 : targetVolume;

		try {
			slot.player.setVolume(initialVolume);
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

		const clip: ActiveClip = {
			tileId: tile.id,
			tile,
			slot,
			targetVolume,
			poll: setInterval(() => this.onPoll(tile.id), POLL_MS)
		};

		if (tile.lane === 'music') {
			clip.cancelFade = fadeVolume(slot.player, 0, targetVolume, MUSIC_FADE_MS);
		}

		this.active.set(tile.id, clip);
		this.emit();
	}

	stop(tileId: string): void {
		const clip = this.active.get(tileId);
		if (!clip) return;

		clearInterval(clip.poll);
		clip.cancelFade?.();

		const finalise = () => {
			try {
				clip.slot.player.stopVideo();
			} catch {
				// ignore
			}
			clip.slot.inUse = false;
			this.active.delete(tileId);
			this.emit();
		};

		if (clip.tile.lane === 'music') {
			fadeVolume(clip.slot.player, clip.targetVolume, 0, MUSIC_FADE_MS);
			setTimeout(finalise, MUSIC_FADE_MS + 20);
		} else {
			finalise();
		}
	}

	stopAll(): void {
		for (const id of Array.from(this.active.keys())) this.stop(id);
	}

	private onPoll(tileId: string) {
		const clip = this.active.get(tileId);
		if (!clip) return;
		let current = 0;
		try {
			current = clip.slot.player.getCurrentTime();
		} catch {
			return;
		}
		if (current >= clip.tile.end_seconds - TRIM_END_TOLERANCE) {
			if (clip.tile.lane === 'music') {
				try {
					clip.slot.player.seekTo(clip.tile.start_seconds, true);
				} catch {
					// ignore
				}
			} else {
				this.stop(tileId);
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
					onReady: () => resolve()
				}
			});
		});

		this.slots.push(slot);
		await slot.ready;
		return slot;
	}
}

export const audioPool = new AudioPool();
