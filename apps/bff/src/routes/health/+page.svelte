<script lang="ts">
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Health</title>
</svelte:head>

<h1>Health</h1>
<p>The API is {data.api}.</p>
