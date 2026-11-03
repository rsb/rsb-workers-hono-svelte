<script lang="ts">
	import { enhance } from "$app/forms";

	type Props = {
		/** The last failed add: what was typed and why it failed. A new object each time. */
		failed: { title: string; message: string } | null;
	};

	let { failed }: Props = $props();

	let title = $derived(failed?.title ?? "");
	// The server's message, until the person starts typing again. It is set
	// again by every new failure, even one with the same message.
	let error = $derived(failed?.message ?? "");
	let hasError = $derived(error !== "");

	const clearError = () => {
		error = "";
	};
</script>

<form method="POST" action="?/add" class={["new-form", { "has-error": hasError }]} use:enhance>
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
