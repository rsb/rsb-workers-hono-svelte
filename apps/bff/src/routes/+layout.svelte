<script lang="ts">
	// The font is served by the BFF, never from a third-party host (PRD, Design).
	import "@fontsource-variable/instrument-sans/wght.css";
	import "../app.css";
	import { page } from "$app/state";
	import ErrorView from "#lib/components/ErrorView.svelte";
	import TopBar from "#lib/components/TopBar.svelte";
	import { FAILED } from "#lib/shell/views.ts";
	import type { LayoutProps } from "./$types";

	let { data, children }: LayoutProps = $props();

	// "Todos" is current on the list, under any filter, and not on an error.
	let onTodos = $derived(page.route.id === "/[[filter=filter]]" && page.error === null);
</script>

<svelte:head>
	{#if !data.probe && data.account.state === "failed"}
		<title>{FAILED.title}</title>
	{/if}
</svelte:head>

<!-- The probe is not a page of the app, so it has no frame (deviation 13). -->
{#if data.probe}
	{@render children()}
{:else}
	<TopBar account={data.account} {onTodos} />
	<!-- The actor is a read every page needs: if it failed, so did the page. -->
	{#if data.account.state === "failed"}
		<ErrorView view={FAILED} />
	{:else}
		{@render children()}
	{/if}
{/if}
