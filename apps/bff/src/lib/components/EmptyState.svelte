<script lang="ts">
	type Props = {
		/** Why the list could not be loaded, or nothing. */
		error: string | null;
	};

	let { error }: Props = $props();
</script>

<div class="empty">
	<svg
		width="28"
		height="28"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.8"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M12 20V5"></path>
		<path d="M6 11l6-6 6 6"></path>
	</svg>
	{#if error}
		<p class="lead">{error}</p>
	{:else}
		<p class="lead">Nothing to do yet.</p>
		<p class="hint">Type a to-do above and press Enter to add it.</p>
	{/if}
</div>

<style>
	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 10px;
		padding: 40px 0 0 36px;
	}

	svg {
		color: var(--fg2);
	}

	p {
		margin: 0;
	}

	.lead {
		font-size: 17px;
		font-weight: 500;
	}

	.hint {
		color: var(--fg2);
		font-size: 15px;
		line-height: 1.5;
	}
</style>
