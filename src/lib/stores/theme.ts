import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

function initialTheme(): Theme {
	if (!browser) return 'dark';
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'light' || stored === 'dark') return stored;
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const theme = writable<Theme>(initialTheme());

if (browser) {
	theme.subscribe((t) => {
		document.documentElement.classList.toggle('dark', t === 'dark');
		try {
			localStorage.setItem(STORAGE_KEY, t);
		} catch {
			// storage unavailable (private mode); theme still applies for this session
		}
	});
}

export function toggleTheme(): void {
	theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
}
