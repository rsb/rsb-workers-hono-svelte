<script lang="ts">
	import { type SubmitFunction, enhance } from "$app/forms";
	import { invalidateAll } from "$app/navigation";
	import type { TodoReply } from "@todo/contract-api";

	type Props = {
		todo: TodoReply;
		/** Why the last toggle of this todo failed without JavaScript, or nothing. */
		error: string | null;
	};

	let { todo, error }: Props = $props();

	let titleId = $derived(`todo-title-${todo.id}`);
	let errorId = $derived(`todo-error-${todo.id}`);
	let editId = $derived(`todo-edit-${todo.id}`);
	let editErrorId = $derived(`todo-edit-error-${todo.id}`);

	// --- Toggle ---

	// From the page without JavaScript. With it, `toggle` sets it from its
	// own result, so another action's result never clears it.
	let toggleError = $derived(error);

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

	const toggle: SubmitFunction<{ toggled: string }, { toggle: { id: string; message: string } }> = () => {
		const next = !checked;
		pending = next;
		justDone = next;
		toggleError = null;

		return async ({ result, update }) => {
			// A failure stays with this row, so the page's `form` is left alone.
			// The reload shows the todo as it really is, or drops it if it is gone.
			if (result.type === "failure" && result.data !== undefined) {
				toggleError = result.data.toggle.message;
				await invalidateAll();
			} else {
				await update();
			}
			pending = null;
		};
	};

	// --- Edit (JavaScript only) ---

	let editing = $state(false);
	let draft = $state("");
	let editError = $state("");
	let hasEditError = $derived(editError !== "");

	// The check is named by the title. While editing, the title is not shown,
	// so the check takes the saved title as its own label.
	let checkLabelledBy = $derived.by(() => {
		if (editing) {
			return undefined;
		}
		return titleId;
	});
	let checkLabel = $derived.by(() => {
		if (editing) {
			return todo.title;
		}
		return undefined;
	});

	// Set once a save or a cancel has begun, so the blur that follows does
	// not save again. A failed save clears it, as the input stays open.
	let closing = false;

	// Set when editing ends from the keyboard, so focus goes back to the title.
	let focusTitle = false;

	const focusInput = (input: HTMLInputElement) => {
		input.focus();
	};

	const focusTitleIfAsked = (button: HTMLButtonElement) => {
		if (focusTitle) {
			focusTitle = false;
			button.focus();
		}
	};

	const startEditing = () => {
		draft = todo.title;
		editError = "";
		closing = false;
		editing = true;
	};

	/** Ends editing. When it was ended from the keyboard, focus goes back to the title. */
	const stopEditing = (returnFocus: boolean) => {
		focusTitle = returnFocus;
		editing = false;
	};

	const onTitleDoubleClick = () => {
		startEditing();
	};

	// A click from the keyboard (Enter or Space) has no mouse clicks, so its
	// `detail` is 0. A mouse click does nothing; a double-click edits.
	const onTitleClick = (event: MouseEvent) => {
		const fromKeyboard = event.detail === 0;
		if (fromKeyboard) {
			startEditing();
		}
	};

	const onEditKeydown = (event: KeyboardEvent) => {
		// Enter submits the form on its own.
		if (event.key === "Escape") {
			event.preventDefault();
			closing = true;
			stopEditing(true);
		}
	};

	const onEditInput = () => {
		editError = "";
	};

	// Leaving the input saves, unless a save or a cancel already began.
	const onEditBlur = (event: FocusEvent & { currentTarget: HTMLInputElement }) => {
		if (closing) {
			return;
		}
		event.currentTarget.form?.requestSubmit();
	};

	const edit: SubmitFunction<{ edited: string }, { edit: { id: string; title: string; message: string } }> = ({
		cancel,
	}) => {
		closing = true;
		const returnFocus = document.activeElement !== null && document.activeElement.id === editId;

		// An unchanged title needs no request.
		const unchanged = draft.trim() === todo.title;
		if (unchanged) {
			cancel();
			stopEditing(returnFocus);
			return;
		}

		return async ({ result, update }) => {
			// A failure keeps the input open with what was typed and why.
			if (result.type === "failure" && result.data !== undefined) {
				draft = result.data.edit.title;
				editError = result.data.edit.message;
				closing = false;
				return;
			}

			await update({ reset: false });
			stopEditing(returnFocus);
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
			aria-labelledby={checkLabelledBy}
			aria-label={checkLabel}
			aria-describedby={toggleError ? errorId : undefined}
		></button>
		<svg class="tick" viewBox="0 0 24 24" aria-hidden="true">
			<path d="M6.5 12.5l3.5 3.5 7.5-8"></path>
		</svg>
	</form>
	<div class="body">
		{#if editing}
			<form method="POST" action="?/edit" class="edit-form" use:enhance={edit}>
				<input type="hidden" name="id" value={todo.id} />
				<label for={editId} class="vh">Edit to-do</label>
				<input
					id={editId}
					class="edit"
					name="title"
					type="text"
					autocomplete="off"
					bind:value={draft}
					onkeydown={onEditKeydown}
					oninput={onEditInput}
					onblur={onEditBlur}
					aria-describedby={editErrorId}
					aria-invalid={hasEditError}
					{@attach focusInput}
				/>
				<p id={editErrorId} class={["field-error", { "is-visible": hasEditError }]} aria-live="polite">
					{editError}
				</p>
			</form>
		{:else}
			<button
				type="button"
				class="title"
				ondblclick={onTitleDoubleClick}
				onclick={onTitleClick}
				{@attach focusTitleIfAsked}
			>
				<span id={titleId}>{todo.title}</span><span class="vh">, press Enter to edit</span>
			</button>
		{/if}
		{#if toggleError}
			<p id={errorId} class="row-error" role="alert">{toggleError}</p>
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
		align-self: flex-start;
		max-width: 100%;
		padding: 0;
		border: 0;
		background: none;
		color: var(--fg);
		font-size: 17px;
		line-height: 1.5;
		text-align: left;
		text-decoration-line: line-through;
		text-decoration-color: transparent;
		text-decoration-thickness: 1.5px;
		overflow-wrap: anywhere;
		text-wrap: pretty;
		cursor: text;
		transition:
			color 0.25s ease,
			text-decoration-color 0.3s ease 0.06s;
	}

	.row.done .title {
		color: var(--fg2);
		text-decoration-color: var(--fg2);
	}

	.edit-form {
		display: flex;
		flex-direction: column;
	}

	.edit {
		min-width: 0;
		margin: -4px 0 -4px -8px;
		padding: 4px 8px;
		border: 0;
		border-radius: 6px;
		background: var(--fill);
		color: var(--fg);
		font-size: 17px;
		line-height: 1.5;
	}

	.edit:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.field-error {
		margin: 0;
		color: var(--error);
		font-size: 14px;
		line-height: 1.45;
	}

	.field-error.is-visible {
		padding-top: 8px;
	}

	.row-error {
		margin: 4px 0 0;
		color: var(--error);
		font-size: 14px;
		line-height: 1.45;
	}
</style>
