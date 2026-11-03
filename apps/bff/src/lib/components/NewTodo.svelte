<script lang="ts">
	import { type SubmitFunction, enhance } from "$app/forms";
	import { invalidateAll } from "$app/navigation";

	type Failed = { title: string; message: string };

	type Props = {
		/** The last failed add without JavaScript: what was typed and why it failed. */
		failed: Failed | null;
		/** Whether there are todos; mark all is shown only then. */
		hasTodos: boolean;
		/** Whether every todo is completed; mark all is pressed only then. */
		allDone: boolean;
		/** Why the last mark all failed without JavaScript, or nothing. */
		markAllFailed: string | null;
	};

	let { failed, hasTodos, allDone, markAllFailed }: Props = $props();

	// What was typed and the server's message, from the page without
	// JavaScript. With it, `add` sets them from its own result, so another
	// action's result never clears them.
	let title = $derived(failed?.title ?? "");
	let error = $derived(failed?.message ?? "");
	let hasError = $derived(error !== "");

	const clearError = () => {
		error = "";
	};

	const add: SubmitFunction<{ added: string }, Failed> = () => {
		return async ({ result, update }) => {
			// A failure stays with this form, so the page's `form` is left alone.
			if (result.type === "failure" && result.data !== undefined) {
				title = result.data.title;
				error = result.data.message;
				return;
			}

			await update();
			if (result.type === "success") {
				title = "";
				error = "";
			}
		};
	};

	// --- Mark all ---

	// The value every todo takes on a press: completed, unless all already are.
	let markAllValue = $derived(String(!allDone));

	// From the page without JavaScript. With it, `markAll` sets it from its
	// own result, so another action's result never clears it.
	let markAllError = $derived(markAllFailed);

	// It waits for the reply: the rows change only when the list reloads.
	const markAll: SubmitFunction<{ markedAll: boolean }, { markAll: { message: string } }> = () => {
		markAllError = null;

		return async ({ result, update }) => {
			// A failure stays with this form, so the page's `form` is left alone.
			// The reload shows the todos as they really are.
			if (result.type === "failure" && result.data !== undefined) {
				markAllError = result.data.markAll.message;
				await invalidateAll();
				return;
			}

			await update();
		};
	};
</script>

<!-- Its own form, so a press never posts the add form. The button sits in
     the add line and joins this form by its id; it carries the value. -->
<form id="mark-all" method="POST" action="?/markAll" use:enhance={markAll}></form>

<form method="POST" action="?/add" class={["new-form", { "has-error": hasError }]} use:enhance={add}>
	<div class="line">
		<span class="toggle-slot">
			{#if hasTodos}
				<button
					type="submit"
					form="mark-all"
					name="completed"
					value={markAllValue}
					class={["toggle-all", { "is-on": allDone }]}
					aria-pressed={allDone}
					aria-label="Mark all as complete"
				>
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path
							d="M5 12.5l4.5 4.5L19 7.5"
							stroke="currentColor"
							stroke-width="3.2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</button>
			{/if}
		</span>
		<label for="new-todo" class="vh">New to-do</label>
		<!-- Upstream, New todo: "preferably by using the `autofocus` input attribute". -->
		<!-- svelte-ignore a11y_autofocus -->
		<input
			id="new-todo"
			class="new-input"
			name="title"
			type="text"
			placeholder="What needs doing?"
			autocomplete="off"
			autofocus
			value={title}
			oninput={clearError}
			aria-describedby="new-todo-error"
			aria-invalid={hasError}
		/>
	</div>
	<p id="new-todo-error" class={["field-error", { "is-visible": hasError }]} aria-live="polite">
		{error}
	</p>
	{#if markAllError}
		<p id="mark-all-error" class="field-error is-visible" role="alert">{markAllError}</p>
	{/if}
</form>

<style>
	.new-form {
		display: flex;
		flex-direction: column;
		padding: 4px 0 10px;
		border-bottom: 1px solid var(--line);
		transition: border-color 0.2s;
	}

	.new-form.has-error {
		border-bottom-color: var(--error);
	}

	.line {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.toggle-slot {
		width: 22px;
		height: 22px;
		flex: none;
	}

	.toggle-all {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		border: 1.5px solid var(--fg2);
		background: transparent;
		padding: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--fg2);
		transition:
			background 0.2s,
			border-color 0.2s,
			color 0.2s;
	}

	.toggle-all:hover {
		border-color: var(--fg);
		color: var(--fg);
	}

	.toggle-all.is-on {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--on-accent);
	}

	.new-input {
		flex: 1;
		min-width: 0;
		height: 44px;
		padding: 0;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--fg);
		font-size: 19px;
		line-height: 1.3;
	}

	.new-input::placeholder {
		color: var(--fg2);
		opacity: 1;
	}

	.new-input:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 6px;
	}

	.field-error {
		margin: 0;
		padding-left: 36px;
		color: var(--error);
		font-size: 14px;
		line-height: 1.45;
	}

	.field-error.is-visible {
		padding-top: 8px;
	}
</style>
