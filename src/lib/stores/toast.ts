import { writable } from 'svelte/store';

/** Transient status message shown at the bottom of the screen. */
export const toast = writable<string | null>(null);

let token = 0;

export function showToast(message: string, ms = 4000): void {
	const id = ++token;
	toast.set(message);
	setTimeout(() => {
		// Only clear if no newer toast replaced this one.
		if (id === token) toast.set(null);
	}, ms);
}
