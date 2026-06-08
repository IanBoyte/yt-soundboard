import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig(() => {
	const tsHost = process.env.TS_HOST; // e.g. cid.tail229344.ts.net — set by `npm run dev:ts`

	return {
	server: tsHost
		? {
				// Bind IPv4 loopback so `tailscale serve` (which dials 127.0.0.1) can reach us;
				// Vite defaults to IPv6 [::1] only, which makes Serve return 502.
				host: '127.0.0.1',
				allowedHosts: [tsHost],
				hmr: { host: tsHost, clientPort: 443, protocol: 'wss' as const }
			}
		: undefined,
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			manifest: {
				name: 'TTRPG Soundboard',
				short_name: 'Soundboard',
				description: 'YouTube-powered soundboard for TTRPG sessions',
				theme_color: '#0f172a',
				background_color: '#0f172a',
				display: 'standalone',
				orientation: 'any',
				start_url: '/',
				icons: [
					{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
					{ src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' }
				]
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}']
			}
		})
	]
	};
});
