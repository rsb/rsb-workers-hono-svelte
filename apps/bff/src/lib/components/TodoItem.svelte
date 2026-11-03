<script lang="ts">
	import { type SubmitFunction, enhance } from "$app/forms";
	import { invalidateAll } from "$app/navigation";
	import type { TodoReply } from "@todo/contract-api";

	type Props = {
		todo: TodoReply;
		/** Why the last toggle of this todo failed, or nothing. */
		error: string | null;
	};

	let { todo, error }: Props = $props();

	let titleId = $derived(`todo-title-${todo.id}`);
	let errorId = $derived(`todo-error-${todo.id}`);

	// The value a toggle in flight asks for, shown until the list reloads.
	let pending: boolean | null = $state(null);
	let checked = $derived.by(() => {
		if (pending === null) {
			return todo.completed;
		}
		return pending;
	});

	// Set only by a click that completes the todo, so the check pops once
	// then and never when the page loads.
	let justDone = $state(false);

	const toggle: SubmitFunction = () => {
		const next = !checked;
		pending = next;
		justDone = next;

		return async ({ result, update }) => {
			await update();
			// A failure does not reload the list on its own; the reload shows
			// the todo as it really is, or drops it if it is gone.
			if (result.type === "failure") {
				await invalidateAll();
			}
			pending = null;
		};
	};
</script>

<li class={["row", { done: checked }]}>
	<form method="POST" action="?/toggle" class="check-box" use:enhance={toggle}>
		<input type="hidden" name="id" value={todo.id} />
		<input type="hidden" name="completed" value={String(!checked)} />
		<!-- A submit button, so the toggle works without JavaScript. -->
		<button
			type="submit"
			class={["check", { "just-done": justDone }]}
			role="checkbox"
			aria-checked={checked}
			aria-labelledby={titleId}
			aria-describedby={error ? errorId : undefined}
		></button>
		<svg class="tick" viewBox="0 0 24 24" aria-hidden="true">
			<path d="M6.5 12.5l3.5 3.5 7.5-8"></path>
		</svg>
	</form>
	<div class="body">
		<span id={titleId} class="title">{todo.title}</span>
		{#if error}
			<p id={errorId} class="row-error" role="alert">{error}</p>
		{/if}
	</div>
</li>

<style>
	.row {
		display: flex;
		align-items: flex-start;
		gap: 14px;
		margin: 0 -8px;
		padding: 11px 8px;
		border-radius: 10px;
		transition: background 0.15s;
	}

	.row:hover {
		background: var(--fill);
	}

	.check-box {
		position: relative;
		width: 22px;
		height: 22px;
		flex: none;
		margin: 2px 0 0;
	}

	.check {
		position: absolute;
		inset: 0;
		width: 22px;
		height: 22px;
		padding: 0;
		border: 1.5px solid var(--fg2);
		border-radius: 50%;
		background: transparent;
		transition:
			background 0.18s ease,
			border-color 0.18s ease;
	}

	.check:hover {
		border-color: var(--fg);
	}

	.check[aria-checked="true"] {
		background: var(--accent);
		border-color: var(--accent);
	}

	.check.just-done[aria-checked="true"] {
		animation: pop 0.34s cubic-bezier(0.2, 0.8, 0.3, 1.25);
	}

	.tick {
		position: absolute;
		inset: 0;
		width: 22px;
		height: 22px;
		pointer-events: none;
		color: var(--on-accent);
		stroke: currentColor;
		fill: none;
		stroke-width: 2.2;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-dasharray: 20;
		stroke-dashoffset: 20;
		transition: stroke-dashoffset 0.24s ease-out 0.08s;
	}

	.check[aria-checked="true"] + .tick {
		stroke-dashoffset: 0;
	}

	@keyframes pop {
		0% {
			transform: scale(1);
		}
		40% {
			transform: scale(1.15);
		}
		100% {
			transform: scale(1);
		}
	}

	.body {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
	}

	/* Completed is shown by the check, the strike-through and the dimmed title, never by colour alone. */
	.title {
		color: var(--fg);
		font-size: 17px;
		line-height: 1.5;
		text-decoration-line: line-through;
		text-decoration-color: transparent;
		text-decoration-thickness: 1.5px;
		overflow-wrap: anywhere;
		text-wrap: pretty;
		transition:
			color 0.25s ease,
			text-decoration-color 0.3s ease 0.06s;
	}

	.row.done .title {
		color: var(--fg2);
		text-decoration-color: var(--fg2);
	}

	.row-error {
		margin: 4px 0 0;
		color: var(--error);
		font-size: 14px;
		line-height: 1.45;
	}
</style>
