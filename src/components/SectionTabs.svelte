<script lang="ts">
	import type { Section } from '$lib/types';
	import { editMode } from '$lib/stores/ui';
	import { addSection, renameSection, deleteSection } from '$lib/stores/board';

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
</script>

<nav
	class="scrollbar-none flex items-center gap-1 overflow-x-auto border-b border-slate-800 bg-slate-900/80 px-2 pb-1 pt-2 backdrop-blur"
	aria-label="Sections"
>
	{#each sections as section, i (section.id)}
		<div
			class="flex shrink-0 items-center rounded-t-lg transition {currentIndex === i
				? 'border-b-2 border-emerald-400 bg-slate-800'
				: ''}"
		>
			<button
				type="button"
				onclick={() => onChange(i)}
				class="px-3 py-2 text-sm font-medium {currentIndex === i
					? 'text-emerald-300'
					: 'text-slate-400 hover:text-slate-200'}"
			>
				{section.name}
			</button>
			{#if $editMode && currentIndex === i}
				<button
					type="button"
					onclick={() => handleRename(section)}
					class="rounded px-1 py-1 text-[10px] text-slate-300 hover:bg-slate-700"
					aria-label="Rename">✎</button
				>
				<button
					type="button"
					onclick={() => handleDelete(section, i)}
					class="mr-1 rounded px-1 py-1 text-[10px] text-rose-400 hover:bg-rose-500/20"
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
