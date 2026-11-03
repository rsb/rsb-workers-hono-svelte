<script lang="ts">
	import EmptyState from "#lib/components/EmptyState.svelte";
	import NewTodo from "#lib/components/NewTodo.svelte";
	import TodoFooter from "#lib/components/TodoFooter.svelte";
	import TodoList from "#lib/components/TodoList.svelte";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();

	// A new object for every failed add, so a repeated message shows again.
	let failed = $derived.by(() => {
		if (form?.message === undefined) {
			return null;
		}
		return { title: form.title, message: form.message };
	});
	let toggleFailed = $derived.by(() => {
		if (form?.toggle === undefined) {
			return null;
		}
		return form.toggle;
	});
	let hasTodos = $derived(data.todos.length > 0);
</script>

<svelte:head>
	<title>Todos</title>
</svelte:head>

<main>
	<h1>Todos</h1>

	<NewTodo {failed} />

	{#if hasTodos}
		<TodoList todos={data.todos} {toggleFailed} />
		<TodoFooter active={data.active} />
	{:else}
		<EmptyState error={data.error} />
	{/if}
</main>

<style>
	main {
		width: 100%;
		max-width: 640px;
		margin: 0 auto;
		padding: 96px 24px 40px;
	}

	h1 {
		margin: 0 0 28px;
		font-size: 34px;
		font-weight: 600;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}

	@media (max-width: 480px) {
		main {
			padding: 56px 20px 28px;
		}

		h1 {
			font-size: 30px;
		}
	}
</style>
