<script lang="ts">
	import type { Section } from '$lib/types';
	import { editMode } from '$lib/stores/ui';
	import { addSection, renameSection, deleteSection, moveSection } from '$lib/stores/board';

	let {
		sections,
		currentIndex,
		onChange
	}: {
		sections: Section[];
		currentIndex: number;
		onChange: (i: number) => void;
	} = $props();

	async function handleAdd() {
		const name = prompt('Section name?');
		if (!name?.trim()) return;
		await addSection(name.trim());
		onChange(sections.length);
	}

	async function handleRename(section: Section) {
		const name = prompt('Rename section', section.name);
		if (!name?.trim() || name === section.name) return;
		await renameSection(section.id, name.trim());
	}

	async function handleDelete(section: Section, index: number) {
		if (!confirm(`Delete section "${section.name}" and all its tiles?`)) return;
		await deleteSection(section.id);
		if (currentIndex >= index && currentIndex > 0) onChange(currentIndex - 1);
	}

	async function handleMove(section: Section, index: number, dir: -1 | 1) {
		const target = index + dir;
		if (target < 0 || target >= sections.length) return;
		await moveSection(section.id, dir);
		onChange(target); // keep the moved section selected
	}
</script>

<nav
	class="scrollbar-none flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white/80 px-2 pb-1 pt-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80"
	aria-label="Sections"
>
	{#each sections as section, i (section.id)}
		<div
			class="flex shrink-0 items-center rounded-t-lg transition {currentIndex === i
				? 'border-b-2 border-emerald-500 bg-slate-200 dark:border-emerald-400 dark:bg-slate-800'
				: ''}"
		>
			<button
				type="button"
				onclick={() => onChange(i)}
				class="px-3 py-2 text-sm font-medium {currentIndex === i
					? 'text-emerald-700 dark:text-emerald-300'
					: 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}"
			>
				{section.name}
			</button>
			{#if $editMode && currentIndex === i}
				<button
					type="button"
					onclick={() => handleMove(section, i, -1)}
					disabled={i === 0}
					class="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded text-base text-slate-600 hover:bg-slate-300 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-700"
					aria-label="Move section left">◀</button
				>
				<button
					type="button"
					onclick={() => handleMove(section, i, 1)}
					disabled={i === sections.length - 1}
					class="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded text-base text-slate-600 hover:bg-slate-300 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-700"
					aria-label="Move section right">▶</button
				>
				<button
					type="button"
					onclick={() => handleRename(section)}
					class="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded text-base text-slate-600 hover:bg-slate-300 dark:text-slate-300 dark:hover:bg-slate-700"
					aria-label="Rename">✎</button
				>
				<button
					type="button"
					onclick={() => handleDelete(section, i)}
					class="mr-1 inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded text-base text-rose-400 hover:bg-rose-500/20"
					aria-label="Delete">×</button
				>
			{/if}
		</div>
	{/each}
	{#if $editMode}
		<button
			type="button"
			onclick={handleAdd}
			class="shrink-0 rounded-t-lg border-2 border-dashed border-emerald-500/60 px-3 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/10"
		>
			+ Section
		</button>
	{/if}
</nav>

<style>
	.scrollbar-none::-webkit-scrollbar {
		display: none;
	}
	.scrollbar-none {
		scrollbar-width: none;
	}
</style>
