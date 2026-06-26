<script lang="ts">
	import { theme, toggleTheme } from '$lib/stores/theme';

	let {
		onExport,
		onImport,
		onShare
	}: {
		onExport: () => void;
		onImport: () => void;
		onShare: () => void;
	} = $props();

	let open = $state(false);

	function close() {
		open = false;
	}

	function run(fn: () => void) {
		close();
		fn();
	}
</script>

<div class="relative">
	<button
		type="button"
		onclick={() => (open = !open)}
		class="rounded-lg px-2 py-2 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
		aria-label="Options"
		aria-haspopup="menu"
		aria-expanded={open}
	>
		<!-- gear icon -->
		<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="12" cy="12" r="3" />
			<path
				d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
			/>
		</svg>
	</button>

	{#if open}
		<!-- backdrop to catch outside clicks -->
		<div class="fixed inset-0 z-40" role="presentation" onclick={close}></div>

		<div
			class="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800"
			role="menu"
		>
			<button
				type="button"
				role="menuitem"
				onclick={toggleTheme}
				class="flex w-full items-center justify-between px-4 py-3 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
			>
				<span class="flex items-center gap-2">
					{#if $theme === 'dark'}
						<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
						</svg>
						Dark theme
					{:else}
						<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="12" cy="12" r="5" />
							<path
								d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
							/>
						</svg>
						Light theme
					{/if}
				</span>
				<!-- toggle pill -->
				<span
					class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition {$theme ===
					'dark'
						? 'bg-emerald-500'
						: 'bg-slate-300'}"
				>
					<span
						class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition {$theme ===
						'dark'
							? 'translate-x-4'
							: 'translate-x-0.5'}"
					></span>
				</span>
			</button>

			<div class="border-t border-slate-200 dark:border-slate-700"></div>

			<button
				type="button"
				role="menuitem"
				onclick={() => run(onShare)}
				class="flex w-full items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
			>
				<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
					<path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
				</svg>
				Copy share link
			</button>

			<div class="border-t border-slate-200 dark:border-slate-700"></div>

			<button
				type="button"
				role="menuitem"
				onclick={() => run(onExport)}
				class="flex w-full items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
			>
				<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
				</svg>
				Export config
			</button>

			<button
				type="button"
				role="menuitem"
				onclick={() => run(onImport)}
				class="flex w-full items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
			>
				<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
				</svg>
				Import config
			</button>
		</div>
	{/if}
</div>
