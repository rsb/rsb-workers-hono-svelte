<script lang="ts">
	import { enhance } from "$app/forms";
	import type { PageProps } from "./$types";

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>todos</title>
</svelte:head>

<h1>todos</h1>

<form method="POST" action="?/add" use:enhance>
	<!-- Upstream, New todo: "preferably by using the `autofocus` input attribute". -->
	<!-- svelte-ignore a11y_autofocus -->
	<input
		name="title"
		aria-label="New todo"
		placeholder="What needs to be done?"
		autocomplete="off"
		autofocus
		value={form?.title ?? ""}
	/>
</form>

{#if form?.message}
	<p role="alert">{form.message}</p>
{/if}

{#if data.error}
	<p role="alert">{data.error}</p>
{/if}

{#if data.todos.length > 0}
	<ul>
		{#each data.todos as todo (todo.id)}
			<li>{todo.title}</li>
		{/each}
	</ul>
{/if}
