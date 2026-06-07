/// <reference types="youtube" />

const STEP_MS = 50;

/**
 * Ramps a YouTube player's volume from `from` → `to` over `durationMs`.
 * Returns a cancel function. Volumes are 0–100 to match YT.Player.setVolume.
 */
export function fadeVolume(
	player: YT.Player,
	from: number,
	to: number,
	durationMs: number
): () => void {
	if (durationMs <= 0) {
		try {
			player.setVolume(to);
		} catch {
			// player may have been destroyed mid-flight
		}
		return () => {};
	}

	const steps = Math.max(1, Math.round(durationMs / STEP_MS));
	const delta = (to - from) / steps;
	let i = 0;
	let cancelled = false;

	try {
		player.setVolume(from);
	} catch {
		return () => {};
	}

	const handle = setInterval(() => {
		if (cancelled) return;
		i++;
		const next = i >= steps ? to : from + delta * i;
		try {
			player.setVolume(next);
		} catch {
			clearInterval(handle);
			return;
		}
		if (i >= steps) clearInterval(handle);
	}, STEP_MS);

	return () => {
		cancelled = true;
		clearInterval(handle);
	};
}
