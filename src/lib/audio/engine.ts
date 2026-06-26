import { writable, type Readable } from 'svelte/store';
import type { Tile } from '../types';
import { clipKey } from '../clip';
import { getClipBytes } from './cache';

/**
 * Web Audio playback engine. Each tile's pre-extracted clip is decoded once into
 * an AudioBuffer and played from memory — no iframes, no polling, no network on
 * press. Music tiles loop sample-accurately via the native loop; SFX are
 * one-shots that clean themselves up on end.
 *
 * Graph: source -> per-tile gain (tile volume) -> master gain -> destination.
 * Master volume scales every active clip by adjusting one node.
 */

const MUSIC_FADE_S = 0.4; // fade music in/out to avoid clicks and abrupt stops
const SFX_ATTACK_S = 0.005; // tiny ramp to avoid a click on one-shots

interface ActiveClip {
	tile: Tile;
	source: AudioBufferSourceNode;
	gain: GainNode;
}

function clampPct(pct: number): number {
	return Math.max(0, Math.min(100, pct));
}

class AudioEngine {
	private ctx: AudioContext | null = null;
	private master: GainNode | null = null;
	private masterPct = 80;
	private buffers = new Map<string, AudioBuffer>();
	private active = new Map<string, ActiveClip>();
	private loading = new Set<string>();
	private _playing = writable<Set<string>>(new Set());

	get playing(): Readable<Set<string>> {
		return this._playing;
	}

	/** Lazily create the context on the first user gesture (mobile autoplay policy). */
	private ensureContext(): AudioContext {
		if (!this.ctx) {
			const Ctor: typeof AudioContext =
				(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
				window.AudioContext;
			this.ctx = new Ctor();
			this.master = this.ctx.createGain();
			this.master.gain.value = this.masterPct / 100;
			this.master.connect(this.ctx.destination);
		}
		if (this.ctx.state === 'suspended') void this.ctx.resume();
		return this.ctx;
	}

	setMasterVolume(pct: number): void {
		this.masterPct = clampPct(pct);
		if (this.master && this.ctx) {
			this.master.gain.setTargetAtTime(this.masterPct / 100, this.ctx.currentTime, 0.01);
		}
	}

	isPlaying(tileId: string): boolean {
		return this.active.has(tileId);
	}

	async play(tile: Tile): Promise<void> {
		// Pressing a playing (or still-loading) tile stops it — toggle semantics.
		if (this.active.has(tile.id)) {
			this.stop(tile.id);
			return;
		}
		if (this.loading.has(tile.id)) return;

		const ctx = this.ensureContext();
		this.loading.add(tile.id);
		let buffer: AudioBuffer;
		try {
			buffer = await this.getBuffer(tile);
		} finally {
			this.loading.delete(tile.id);
		}
		// The user may have pressed again (or stop-all'd) while the clip loaded.
		if (this.active.has(tile.id)) return;

		const source = ctx.createBufferSource();
		source.buffer = buffer;
		const gain = ctx.createGain();
		source.connect(gain).connect(this.master!);

		const target = clampPct(tile.volume_pct) / 100;
		const now = ctx.currentTime;

		if (tile.lane === 'music') {
			source.loop = true;
			source.loopStart = 0;
			source.loopEnd = buffer.duration;
			gain.gain.setValueAtTime(0, now);
			gain.gain.linearRampToValueAtTime(target, now + MUSIC_FADE_S);
		} else {
			gain.gain.setValueAtTime(0, now);
			gain.gain.linearRampToValueAtTime(target, now + SFX_ATTACK_S);
			source.onended = () => {
				if (this.active.get(tile.id)?.source === source) {
					this.active.delete(tile.id);
					this.emit();
				}
				this.disconnect(source, gain);
			};
		}

		source.start();
		this.active.set(tile.id, { tile, source, gain });
		this.emit();
	}

	stop(tileId: string): void {
		const clip = this.active.get(tileId);
		if (!clip || !this.ctx) return;
		this.active.delete(tileId);
		this.emit();

		const { source, gain, tile } = clip;
		const now = this.ctx.currentTime;

		if (tile.lane === 'music') {
			gain.gain.cancelScheduledValues(now);
			gain.gain.setValueAtTime(gain.gain.value, now);
			gain.gain.linearRampToValueAtTime(0, now + MUSIC_FADE_S);
			source.onended = () => this.disconnect(source, gain);
			try {
				source.stop(now + MUSIC_FADE_S + 0.02);
			} catch {
				// already stopped
			}
		} else {
			source.onended = null;
			try {
				source.stop();
			} catch {
				// already stopped
			}
			this.disconnect(source, gain);
		}
	}

	stopAll(): void {
		for (const id of Array.from(this.active.keys())) this.stop(id);
	}

	private async getBuffer(tile: Tile): Promise<AudioBuffer> {
		const key = clipKey(tile);
		const cached = this.buffers.get(key);
		if (cached) return cached;
		const bytes = await getClipBytes(tile);
		// decodeAudioData detaches the ArrayBuffer; bytes are a fresh copy each call.
		const buffer = await this.ctx!.decodeAudioData(bytes);
		this.buffers.set(key, buffer);
		return buffer;
	}

	private disconnect(source: AudioBufferSourceNode, gain: GainNode): void {
		try {
			source.disconnect();
		} catch {
			// ignore
		}
		try {
			gain.disconnect();
		} catch {
			// ignore
		}
	}

	private emit(): void {
		this._playing.set(new Set(this.active.keys()));
	}
}

export const engine = new AudioEngine();
