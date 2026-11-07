<script lang="ts">
	import { EVERYWHERE_NOTE } from "#lib/profile.ts";
	import { SIGNED_OUT } from "#lib/shell/views.ts";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Profile</title>
</svelte:head>

<main>
	<h1>Profile</h1>

	<!-- Sessions only in B (Q5): Account, Password, Sign-in methods and
	     Delete account are added with the slices that build them. -->
	{#if data.state === "signed_out"}
		<p class="lede">{SIGNED_OUT}</p>
		<p class="actions"><a href="/sign-in" class="primary">Sign in</a></p>
	{:else}
		<section aria-labelledby="sessions">
			<h2 id="sessions">Sessions</h2>
			<p class="sub">{data.line}</p>

			<ul class="rows">
				{#each data.rows as row (row.id)}
					<li class="row">
						<span class="icon" aria-hidden="true">
							{#if row.phone}
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="3" width="10" height="18" rx="2"></rect><path d="M11 17.5h2"></path></svg>
							{:else}
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="10" rx="1.5"></rect><path d="M3 19h18"></path></svg>
							{/if}
						</span>
						<div class="text">
							<p class="label">
								{row.label}
								{#if row.thisDevice}
									<span class="tag">This device</span>
								{/if}
							</p>
							<p class="detail">{row.detail}</p>
						</div>
					</li>
				{/each}
			</ul>

			<!-- A plain POST, never a GET (threats row 2), and a whole-page
			     navigation, as the shell's sign-out. -->
			<form method="POST" action="?/everywhere">
				<button type="submit" class="secondary">Sign out everywhere</button>
			</form>
			<p class="note">{EVERYWHERE_NOTE}</p>
		</section>
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

	h2 {
		margin: 0;
		font-size: 20px;
		font-weight: 600;
		line-height: 1.3;
	}

	.lede {
		margin: 0;
		font-size: 16px;
		line-height: 1.55;
		color: var(--fg2);
	}

	.sub {
		margin: 6px 0 16px;
		font-size: 15px;
		line-height: 1.5;
		color: var(--fg2);
	}

	.rows {
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--line);
	}

	.row {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 0;
		border-bottom: 1px solid var(--line);
	}

	.icon {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 10px;
		background: var(--fill);
		color: var(--fg);
	}

	.text {
		min-width: 0;
	}

	.label {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin: 0;
		font-size: 16px;
		line-height: 1.45;
	}

	.detail {
		margin: 2px 0 0;
		font-size: 14px;
		line-height: 1.45;
		color: var(--fg2);
	}

	.tag {
		font-size: 12px;
		font-weight: 600;
		padding: 3px 8px;
		border-radius: 999px;
		background: var(--fill);
		color: var(--fg2);
	}

	form {
		margin: 16px 0 0;
	}

	.secondary {
		display: inline-flex;
		align-items: center;
		height: 44px;
		padding: 0 18px;
		border: 0;
		border-radius: 10px;
		background: var(--fill);
		color: var(--fg);
		font-size: 15px;
		font-weight: 600;
	}

	.secondary:focus-visible,
	.primary:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.note {
		margin: 10px 0 0;
		font-size: 14px;
		line-height: 1.45;
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
