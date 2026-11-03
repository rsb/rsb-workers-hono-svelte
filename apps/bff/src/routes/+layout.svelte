<script lang="ts">
	// The font is served by the BFF, never from a third-party host (PRD, Design).
	import "@fontsource-variable/instrument-sans/wght.css";
	import "../app.css";

	let { children } = $props();
</script>

{@render children()}
