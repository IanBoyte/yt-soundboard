/** Format seconds as "m:ss" or "h:mm:ss" — never zero-pad the leading group. */
export function formatTime(seconds: number): string {
	const s = Math.max(0, Math.floor(seconds));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	const pad = (n: number) => n.toString().padStart(2, '0');
	return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Parse "m:ss", "h:mm:ss", "90", "1:30.5" into seconds. Returns NaN if invalid. */
export function parseTime(input: string): number {
	const trimmed = input.trim();
	if (!trimmed) return NaN;
	if (/^\d+(\.\d+)?$/.test(trimmed)) return parseFloat(trimmed);
	const parts = trimmed.split(':').map((p) => parseFloat(p));
	if (parts.some((n) => isNaN(n))) return NaN;
	if (parts.length === 2) return parts[0] * 60 + parts[1];
	if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
	return NaN;
}
