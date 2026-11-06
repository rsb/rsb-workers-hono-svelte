<script lang="ts">
	import { type SubmitFunction, enhance } from "$app/forms";
	import { NOT_AVAILABLE, WRONG } from "#lib/sign-in.ts";
	import type { PageProps } from "./$types";

	let { form }: PageProps = $props();

	// `accounts.sign_in.pending`: from the press until the reply, with
	// JavaScript. Without it the browser shows its own loading.
	let pending = $state(false);

	// "Not available yet." for the methods E builds, once one is pressed.
	let unavailable = $state(false);

	let emailError = $derived(form?.fields.email ?? "");
	let passwordError = $derived(form?.fields.password ?? "");

	const submit: SubmitFunction = ({ formElement }) => {
		pending = true;
		return async ({ result, update }) => {
			// A failure keeps the email as typed and empties the password, as
			// the page without JavaScript does: the password is never sent back.
			await update({ reset: false });
			pending = false;
			const password = formElement.elements.namedItem("password");
			if (result.type === "failure" && password instanceof HTMLInputElement) {
				password.value = "";
			}
		};
	};
</script>

<svelte:head>
	<title>Sign in</title>
</svelte:head>

<main>
	<h1>Sign in</h1>
	<p class="lede">Pick up your list where you left it.</p>

	<!-- The rules are the page's, worded by the BFF, so the browser's own checks are off. -->
	<form method="POST" novalidate use:enhance={submit}>
		{#if form?.wrong}
			<div class="banner" role="alert">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v5M12 16h.01"></path></svg>
				<p>{WRONG}</p>
			</div>
		{/if}

		<div class="field">
			<label for="email">Email</label>
			<!-- The board draws the page with the email focused. -->
			<!-- svelte-ignore a11y_autofocus -->
			<input
				id="email"
				name="email"
				type="email"
				autocomplete="username"
				autofocus
				value={form?.email ?? ""}
				class={{ "has-error": emailError !== "" }}
				aria-invalid={emailError !== ""}
				aria-describedby={emailError !== "" ? "email-error" : undefined}
			/>
			{#if emailError !== ""}
				<p id="email-error" class="field-error">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v5M12 16h.01"></path></svg>
					{emailError}
				</p>
			{/if}
		</div>

		<div class="field">
			<!-- "Forgot password?" is added with its page. -->
			<label for="password">Password</label>
			<input
				id="password"
				name="password"
				type="password"
				autocomplete="current-password"
				class={{ "has-error": passwordError !== "" }}
				aria-invalid={passwordError !== ""}
				aria-describedby={passwordError !== "" ? "password-error" : undefined}
			/>
			{#if passwordError !== ""}
				<p id="password-error" class="field-error">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v5M12 16h.01"></path></svg>
					{passwordError}
				</p>
			{/if}
		</div>

		<button type="submit" class="primary" disabled={pending}>
			{#if pending}
				<span class="spinner" aria-hidden="true"></span>
				Signing in…
			{:else}
				Sign in
			{/if}
		</button>
	</form>

	<div class="or" aria-hidden="true"><span>or</span></div>

	<!-- The other ways to sign in are drawn as coming (E): pressed, they say
	     so. Not disabled: "Coming" is in each one's name, and a press answers. -->
	<div class="methods">
		<button type="button" class="method" onclick={() => (unavailable = true)}>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"></path></svg>
			Continue with Google
			<span class="tag">Coming</span>
		</button>
		<button type="button" class="method" onclick={() => (unavailable = true)}>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="7.5" cy="16.5" r="3.5"></circle><path d="M10 14l9-9M16 8l2 2M18 6l2 2"></path></svg>
			Use a passkey
			<span class="tag">Coming</span>
		</button>
		<p class="note" aria-live="polite">{unavailable ? NOT_AVAILABLE : ""}</p>
	</div>

	<!-- "New here? Create an account" is added in C, with its page. -->
</main>

<style>
	main {
		width: 100%;
		max-width: 480px;
		margin: 0 auto;
		padding: 96px 24px 40px;
	}

	h1 {
		margin: 0;
		font-size: 34px;
		font-weight: 600;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}

	.lede {
		margin: 12px 0 28px;
		font-size: 16px;
		line-height: 1.55;
		color: var(--fg2);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.banner {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		padding: 14px 16px;
		border: 1px solid var(--error);
		border-radius: 10px;
		background: var(--fill);
		color: var(--error);
	}

	.banner p {
		margin: 0;
		color: var(--fg);
		font-size: 16px;
		line-height: 1.45;
	}

	.banner svg {
		flex: none;
		margin-top: 2px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	label {
		font-size: 15px;
		font-weight: 500;
	}

	input {
		height: 48px;
		padding: 0 14px;
		border: 1px solid transparent;
		border-radius: 10px;
		background: var(--fill);
		color: var(--fg);
		font-size: 16px;
	}

	input:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	input.has-error {
		border-color: var(--error);
	}

	.field-error {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		color: var(--error);
		font-size: 14px;
		line-height: 1.45;
	}

	.field-error svg {
		flex: none;
	}

	.primary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		height: 48px;
		border: 0;
		border-radius: 10px;
		background: var(--accent);
		color: var(--on-accent);
		font-size: 16px;
		font-weight: 600;
	}

	.primary:disabled {
		cursor: progress;
	}

	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.or {
		display: flex;
		align-items: center;
		gap: 14px;
		margin: 28px 0;
		color: var(--fg2);
		font-size: 14px;
	}

	.or::before,
	.or::after {
		content: "";
		flex: 1;
		border-top: 1px solid var(--line);
	}

	.methods {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.method {
		display: flex;
		align-items: center;
		gap: 12px;
		height: 48px;
		padding: 0 10px 0 16px;
		border: 1px dashed var(--line);
		border-radius: 10px;
		background: none;
		color: var(--fg2);
		font-size: 16px;
		text-align: left;
	}

	.tag {
		margin-left: auto;
		font-size: 12px;
		font-weight: 600;
		padding: 3px 8px;
		border-radius: 999px;
		background: var(--fill);
		color: var(--fg2);
	}

	.note {
		margin: 0;
		min-height: 1.45em;
		color: var(--fg2);
		font-size: 14px;
		line-height: 1.45;
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
