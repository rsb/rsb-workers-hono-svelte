<script lang="ts">
	type Props = {
		/** How many todos are not completed. */
		active: number;
	};

	let { active }: Props = $props();

	// Upstream, Counter: `0 items`, `1 item`, `2 items`.
	let noun = $derived.by(() => {
		if (active === 1) {
			return "item";
		}
		return "items";
	});
</script>

<!-- The filters come with slice 8 and Clear completed with slice 7. -->
<footer class="footer">
	<p class="count"><strong>{active}</strong> {noun} left</p>
</footer>

<style>
	.footer {
		position: sticky;
		bottom: 0;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 16px;
		margin-top: 20px;
		padding: 14px 0 10px;
		border-top: 1px solid var(--line);
		background: var(--bg);
		font-size: 14px;
	}

	.count {
		margin: 0;
		color: var(--fg2);
	}

	strong {
		color: var(--fg);
		font-size: 15px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
</style>
