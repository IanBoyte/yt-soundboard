/// <reference types="youtube" />

let apiReadyPromise: Promise<typeof YT> | null = null;

/**
 * Loads the YouTube IFrame Player API exactly once and resolves with the
 * global `YT` namespace once it's ready to construct players.
 */
export function loadYouTubeApi(): Promise<typeof YT> {
	if (apiReadyPromise) return apiReadyPromise;

	apiReadyPromise = new Promise((resolve) => {
		if (typeof window === 'undefined') return;

		if ((window as any).YT?.Player) {
			resolve((window as any).YT);
			return;
		}

		const prev = (window as any).onYouTubeIframeAPIReady;
		(window as any).onYouTubeIframeAPIReady = () => {
			prev?.();
			resolve((window as any).YT);
		};

		const tag = document.createElement('script');
		tag.src = 'https://www.youtube.com/iframe_api';
		tag.async = true;
		document.head.appendChild(tag);
	});

	return apiReadyPromise;
}

/**
 * Extract the YouTube video id from any common URL form:
 *   - https://www.youtube.com/watch?v=ID
 *   - https://youtu.be/ID
 *   - https://www.youtube.com/embed/ID
 *   - https://www.youtube.com/shorts/ID
 * Returns null if the string doesn't look like a YouTube URL we recognise.
 */
export function parseYouTubeId(input: string): string | null {
	const trimmed = input.trim();
	if (!trimmed) return null;

	if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;

	try {
		const url = new URL(trimmed);
		const host = url.hostname.replace(/^www\./, '');

		if (host === 'youtu.be') {
			return url.pathname.slice(1).split('/')[0] || null;
		}

		if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
			const v = url.searchParams.get('v');
			if (v) return v;
			const parts = url.pathname.split('/').filter(Boolean);
			if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'v') {
				return parts[1] ?? null;
			}
		}
	} catch {
		return null;
	}
	return null;
}

/**
 * Parse a `?t=`, `&start=`, or `#t=` start-time hint from a YouTube URL.
 * Supports `90`, `90s`, `1m30s`, `1h2m3s`. Returns seconds, or null.
 */
export function parseStartSeconds(input: string): number | null {
	try {
		const url = new URL(input.trim());
		const raw =
			url.searchParams.get('t') ??
			url.searchParams.get('start') ??
			(url.hash.startsWith('#t=') ? url.hash.slice(3) : null);
		if (!raw) return null;
		if (/^\d+$/.test(raw)) return parseInt(raw, 10);
		const m = raw.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?/);
		if (!m) return null;
		const [, h, mm, s] = m;
		return (parseInt(h ?? '0') || 0) * 3600 + (parseInt(mm ?? '0') || 0) * 60 + (parseInt(s ?? '0') || 0);
	} catch {
		return null;
	}
}

export interface NoEmbedMeta {
	title: string;
	thumbnail_url?: string;
	author_name?: string;
}

/**
 * Fetch video metadata (title, thumbnail) without needing an API key.
 * Falls back to a generic title if noembed.com is unreachable.
 */
export async function fetchVideoMeta(youtubeId: string): Promise<NoEmbedMeta> {
	try {
		const res = await fetch(
			`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}`
		);
		if (!res.ok) throw new Error(`noembed ${res.status}`);
		const json = await res.json();
		return {
			title: json.title ?? 'Untitled',
			thumbnail_url: json.thumbnail_url,
			author_name: json.author_name
		};
	} catch {
		return { title: 'Untitled' };
	}
}
