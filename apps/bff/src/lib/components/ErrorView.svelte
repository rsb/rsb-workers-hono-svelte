<script lang="ts">
	import { page } from "$app/state";
	import { type ErrorView, HOME, RETRY } from "#lib/shell/views.ts";

	type Props = {
		/** The words of the view (`accounts.error`). */
		view: ErrorView;
	};

	let { view }: Props = $props();

	// "Try again" asks for this page again, as a full load, so every read runs.
	let here = $derived(`${page.url.pathname}${page.url.search}`);
</script>

<main class="center">
	<p class="code">{view.code}</p>
	<h1>{view.title}</h1>
	<p class="lede">{view.body}</p>
	<div class="actions">
		{#if view.retry}
			<a href={here} class="btn btn-primary" data-sveltekit-reload>{RETRY}</a>
			<a href="/" class="btn btn-secondary">{HOME}</a>
		{:else}
			<a href="/" class="btn btn-primary">{HOME}</a>
		{/if}
	</div>
</main>

<style>
	.center {
		width: 100%;
		max-width: 480px;
		margin: 0 auto;
		padding: 120px 24px 72px;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 16px;
	}

	.code {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--fg2);
		letter-spacing: 0.06em;
		font-variant-numeric: tabular-nums;
	}

	h1 {
		margin: 0;
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
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
		margin-top: 8px;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 44px;
		padding: 0 18px;
		border-radius: 10px;
		border: 1px solid transparent;
		font-size: 15px;
		font-weight: 600;
		line-height: 1;
		text-decoration: none;
		white-space: nowrap;
		transition:
			background 0.15s,
			border-color 0.15s;
	}

	.btn-primary {
		background: var(--accent);
		color: var(--on-accent);
	}

	.btn-primary:hover {
		background: color-mix(in srgb, var(--accent) 86%, var(--fg));
		color: var(--on-accent);
	}

	.btn-secondary {
		background: var(--fill);
		color: var(--fg);
		border-color: var(--line);
	}

	.btn-secondary:hover {
		border-color: var(--fg2);
		color: var(--fg);
	}

	@media (max-width: 640px) {
		.center {
			padding: 72px 16px 56px;
		}

		h1 {
			font-size: 30px;
		}
	}
</style>
