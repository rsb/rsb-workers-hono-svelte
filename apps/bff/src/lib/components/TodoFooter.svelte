<script lang="ts">
	import { type SubmitFunction, enhance } from "$app/forms";
	import { invalidateAll } from "$app/navigation";
	import type { Filter } from "#lib/filter.ts";

	type Props = {
		/** The filter the page lists by; its link is marked as current. */
		filter: Filter;
		/** How many todos are not completed. */
		active: number;
		/** How many todos are completed; Clear completed is shown only when it is not 0. */
		completed: number;
		/** Why the last clear failed without JavaScript, or nothing. */
		clearFailed: string | null;
	};

	let { filter, active, completed, clearFailed }: Props = $props();

	// Real paths (deviation 4), so each filter can be linked to and reloaded.
	const links: { filter: Filter; href: string; label: string }[] = [
		{ filter: "all", href: "/", label: "All" },
		{ filter: "active", href: "/active", label: "Active" },
		{ filter: "completed", href: "/completed", label: "Completed" },
	];

	/** `page` on the current filter's link, absent on the others. */
	const currentFor = (linkFilter: Filter): "page" | undefined => {
		if (linkFilter === filter) {
			return "page";
		}
		return undefined;
	};

	// Upstream, Counter: `0 items`, `1 item`, `2 items`.
	let noun = $derived.by(() => {
		if (active === 1) {
			return "item";
		}
		return "items";
	});

	// Upstream, Clear completed: "Should be hidden when there are no completed todos."
	let anyCompleted = $derived(completed > 0);

	// From the page without JavaScript. With it, `clearCompleted` sets it from
	// its own result, so another action's result never clears it.
	let clearError = $derived(clearFailed);

	// It waits for the reply: the rows go only when the list reloads. The
	// button goes with them, so focus that was on it moves to the new-todo
	// input, as it does when the last row is removed.
	const clearCompleted: SubmitFunction<{ cleared: boolean }, { clearCompleted: { message: string } }> = ({
		submitter,
	}) => {
		clearError = null;
		const hadFocus = submitter !== null && document.activeElement === submitter;

		return async ({ result, update }) => {
			// A failure stays with this form, so the page's `form` is left alone.
			// The reload shows the todos as they really are.
			if (result.type === "failure" && result.data !== undefined) {
				clearError = result.data.clearCompleted.message;
				await invalidateAll();
				return;
			}

			await update();
			if (result.type === "success" && hadFocus) {
				document.getElementById("new-todo")?.focus();
			}
		};
	};
</script>

<footer class="footer">
	<p class="count"><strong>{active}</strong> {noun} left</p>
	<!-- The same page with another filter: focus stays on the link and the page does not scroll. -->
	<nav aria-label="Filter to-dos" class="filters" data-sveltekit-reset="false">
		{#each links as link (link.filter)}
			<a
				href={link.href}
				class={["filter", { "is-current": link.filter === filter }]}
				aria-current={currentFor(link.filter)}>{link.label}</a
			>
		{/each}
	</nav>
	{#if anyCompleted}
		<form method="POST" action="?/clearCompleted" class="clear-form" use:enhance={clearCompleted}>
			<button type="submit" class="clear">Clear completed</button>
		</form>
	{/if}
	{#if clearError}
		<p id="clear-completed-error" class="clear-error" role="alert">{clearError}</p>
	{/if}
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

	.filters {
		grid-column: 2;
		display: flex;
		gap: 2px;
	}

	.filter {
		color: var(--fg2);
		text-decoration: none;
		font-weight: 500;
		padding: 6px 10px;
		border-radius: 8px;
		line-height: 1.2;
	}

	.filter:hover {
		color: var(--fg);
	}

	.filter.is-current {
		color: var(--fg);
		background: var(--fill);
	}

	.clear-form {
		grid-column: 3;
		justify-self: end;
		margin: 0 -10px 0 0;
	}

	.clear {
		background: none;
		border: 0;
		padding: 6px 10px;
		border-radius: 8px;
		color: var(--fg2);
		font-weight: 500;
		line-height: 1.2;
	}

	.clear:hover {
		color: var(--fg);
	}

	/* Across all three columns, under the counter and the button. */
	.clear-error {
		grid-column: 1 / -1;
		margin: 0;
		color: var(--error);
		font-size: 14px;
		line-height: 1.45;
	}
</style>
