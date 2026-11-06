<script lang="ts">
	import EmptyState from "#lib/components/EmptyState.svelte";
	import NewTodo from "#lib/components/NewTodo.svelte";
	import TodoFooter from "#lib/components/TodoFooter.svelte";
	import TodoList from "#lib/components/TodoList.svelte";
	import { SIGNED_OUT } from "#lib/shell/views.ts";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();

	// Failures reach `form` only without JavaScript. With it, each form keeps
	// its own failure, so one action's result never clears another's.
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
	let removeFailed = $derived.by(() => {
		if (form?.remove === undefined) {
			return null;
		}
		return form.remove;
	});
	let markAllFailed = $derived.by(() => {
		if (form?.markAll === undefined) {
			return null;
		}
		return form.markAll.message;
	});
	let clearFailed = $derived.by(() => {
		if (form?.clearCompleted === undefined) {
			return null;
		}
		return form.clearCompleted.message;
	});
	// From the counts, which cover every todo: on a filter the list can be
	// empty while todos exist, and the footer and mark all must still show.
	let hasTodos = $derived(data.state === "list" && data.active + data.completed > 0);
	let allDone = $derived(hasTodos && data.state === "list" && data.active === 0);
</script>

<svelte:head>
	<title>Todos</title>
</svelte:head>

<main>
	<h1>Todos</h1>

	<!-- accounts.shell.signed_out: "Create an account" comes in C, with its page. -->
	{#if data.state === "signed_out"}
		<p class="lede">{SIGNED_OUT}</p>
		<p class="actions"><a href="/sign-in" class="primary">Sign in</a></p>
	{:else}
		<NewTodo {failed} {hasTodos} {allDone} {markAllFailed} />

		{#if hasTodos}
			<TodoList todos={data.todos} {toggleFailed} {removeFailed} />
			<TodoFooter filter={data.filter} active={data.active} completed={data.completed} {clearFailed} />
		{:else}
			<EmptyState />
		{/if}
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

	.lede {
		margin: 0;
		font-size: 16px;
		line-height: 1.55;
		color: var(--fg2);
	}

	.actions {
		margin: 28px 0 0;
	}

	.primary {
		display: inline-flex;
		align-items: center;
		height: 48px;
		padding: 0 22px;
		border-radius: 10px;
		background: var(--accent);
		color: var(--on-accent);
		font-size: 16px;
		font-weight: 600;
		text-decoration: none;
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
