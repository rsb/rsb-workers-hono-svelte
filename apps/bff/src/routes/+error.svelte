<script lang="ts">
	import { page } from "$app/state";
	import ErrorView from "#lib/components/ErrorView.svelte";
	import { FAILED } from "#lib/shell/views.ts";

	// Drawn inside the root layout, so in the frame (`accounts.error`).
	// `handleError` chose the view (`shellError`); this only draws it.
	let view = $derived(page.error?.view ?? FAILED);
</script>

<svelte:head>
	<title>{view.title}</title>
</svelte:head>

<ErrorView {view} />
