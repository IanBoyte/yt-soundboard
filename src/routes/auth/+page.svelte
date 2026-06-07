<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { getSession, sendMagicLink } from '$lib/supabase';

	let email = $state('');
	let sending = $state(false);
	let sent = $state(false);
	let error = $state<string | null>(null);

	onMount(async () => {
		const session = await getSession();
		if (session) goto('/');
	});

	async function submit(e: Event) {
		e.preventDefault();
		error = null;
		sending = true;
		try {
			await sendMagicLink(email.trim());
			sent = true;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			sending = false;
		}
	}
</script>

<main class="flex min-h-screen items-center justify-center p-6">
	<div class="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
		<h1 class="mb-1 text-xl font-semibold">TTRPG Soundboard</h1>
		<p class="mb-6 text-sm text-slate-400">Sign in with a magic link — no password.</p>

		{#if sent}
			<p class="rounded-lg bg-emerald-900/40 px-3 py-2 text-sm text-emerald-200">
				Magic link sent. Check your email and tap the link to sign in.
			</p>
		{:else}
			<form onsubmit={submit} class="space-y-3">
				<label class="block">
					<span class="mb-1 block text-sm font-medium text-slate-300">Email</span>
					<input
						type="email"
						required
						bind:value={email}
						placeholder="you@example.com"
						class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
					/>
				</label>
				{#if error}
					<p class="text-sm text-rose-300">{error}</p>
				{/if}
				<button
					type="submit"
					disabled={sending}
					class="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
				>
					{sending ? 'Sending…' : 'Send magic link'}
				</button>
			</form>
		{/if}
	</div>
</main>
