<script lang="ts">
	import { type SubmitFunction, enhance } from "$app/forms";

	type Failed = { title: string; message: string };

	type Props = {
		/** The last failed add without JavaScript: what was typed and why it failed. */
		failed: Failed | null;
	};

	let { failed }: Props = $props();

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
</script>

<form method="POST" action="?/add" class={["new-form", { "has-error": hasError }]} use:enhance={add}>
	<div class="line">
		<!-- Holds the place of the mark-all toggle, which comes with slice 6. -->
		<span class="toggle-slot" aria-hidden="true"></span>
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
