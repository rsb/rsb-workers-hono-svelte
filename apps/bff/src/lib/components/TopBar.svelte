<script lang="ts">
	import type { Account } from "#lib/shell/account.ts";

	type Props = {
		/** Who the frame is drawn for. */
		account: Account;
		/** Whether the page is the list, which marks "Todos" as current. */
		onTodos: boolean;
		/** Whether the page is the sign-in page, which has no "Sign in" link to itself. */
		onSignIn: boolean;
	};

	let { account, onTodos, onSignIn }: Props = $props();

	let open = $state(false);
	let button: HTMLButtonElement | undefined = $state();
	let wrap: HTMLDivElement | undefined = $state();

	/** Closes the menu; from the keyboard, focus goes back to its button. */
	const close = (refocus: boolean) => {
		open = false;
		if (refocus) {
			button?.focus();
		}
	};

	const onkeydown = (event: KeyboardEvent) => {
		if (event.key === "Escape" && open) {
			event.preventDefault();
			close(true);
		}
	};

	/** A click anywhere outside the menu and its button closes it. */
	const onclick = (event: MouseEvent) => {
		if (open && wrap !== undefined && !wrap.contains(event.target as Node)) {
			close(false);
		}
	};
</script>

<svelte:window {onkeydown} {onclick} />

<header class="topbar">
	<div class="topbar-in">
		<a href="/" class="brand">
			<span class="brand-mark" aria-hidden="true">
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>
			</span>
			Todo
		</a>

		<!-- A link only for a page that exists: "Users" is added in D. -->
		{#if account.state === "anonymous" && !onSignIn}
			<a href="/sign-in" class="sign-in">Sign in</a>
		{/if}

		{#if account.state === "signed_in"}
			{@const person = account.person}
			<nav aria-label="Main" class="nav-main">
				<a href="/" class={["nav-link", { "is-current": onTodos }]} aria-current={onTodos ? "page" : undefined}>Todos</a>
			</nav>

			<div class="acct-wrap" bind:this={wrap}>
				<button
					type="button"
					class="acct"
					bind:this={button}
					aria-expanded={open}
					aria-controls="account-menu"
					aria-label="Account: {person.name}"
					onclick={() => (open = !open)}
				>
					<span class="avatar" aria-hidden="true">{person.initials}</span>
					<span class="acct-name" aria-hidden="true">{person.name}</span>
					<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>
				</button>

				<!-- Users is added in D, Profile when its page exists. -->
				{#if open}
					<div id="account-menu" class="menu">
						<div class="menu-head">
							<p class="menu-name">{person.name}</p>
							<p class="menu-email">{person.email}</p>
							{#if person.admin}
								<span class="tag">Admin</span>
							{/if}
						</div>
						<ul class="menu-list menu-mobile" aria-label="Main">
							<li>
								<a href="/" class={["menu-item", { "is-current": onTodos }]} aria-current={onTodos ? "page" : undefined} onclick={() => close(false)}>
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"></path><path d="M4 6h.01M4 12h.01M4 18h.01"></path></svg>
									Todos
								</a>
							</li>
						</ul>
						<!-- A plain POST, never a GET (threats row 2), and a whole-page
						     navigation: what the page held in memory goes with the session. -->
						<form method="POST" action="/sign-out">
							<button type="submit" class="menu-item">
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"></path><path d="M9 8l-4 4 4 4M5 12h10"></path></svg>
								Sign out
							</button>
						</form>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</header>

<style>
	.topbar {
		border-bottom: 1px solid var(--line);
		background: var(--bg);
		position: relative;
		z-index: 5;
	}

	.topbar-in {
		max-width: 1120px;
		margin: 0 auto;
		padding: 0 24px;
		height: 64px;
		display: flex;
		align-items: center;
		gap: 24px;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-weight: 600;
		font-size: 17px;
		letter-spacing: -0.01em;
		color: var(--fg);
		text-decoration: none;
		border-radius: 8px;
		padding: 6px 4px;
		margin-left: -4px;
	}

	.brand-mark {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--accent);
		color: var(--on-accent);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
	}

	.sign-in {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		height: 44px;
		padding: 0 16px;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--fill);
		color: var(--fg);
		font-weight: 600;
		font-size: 15px;
		text-decoration: none;
	}

	.nav-main {
		display: flex;
		gap: 2px;
		flex: 1;
	}

	.nav-link {
		color: var(--fg2);
		text-decoration: none;
		font-weight: 500;
		font-size: 15px;
		padding: 8px 12px;
		border-radius: 8px;
		line-height: 1.2;
	}

	.nav-link:hover,
	.nav-link.is-current {
		color: var(--fg);
	}

	.nav-link.is-current {
		background: var(--fill);
	}

	.acct-wrap {
		position: relative;
		margin-left: auto;
		display: flex;
		align-items: center;
	}

	.acct {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		height: 44px;
		padding: 0 10px 0 6px;
		border: 0;
		border-radius: 10px;
		background: none;
		font-weight: 500;
		font-size: 15px;
	}

	.acct:hover,
	.acct[aria-expanded="true"] {
		background: var(--fill);
	}

	.avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--fill);
		border: 1px solid var(--line);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 13px;
		font-weight: 600;
		flex: none;
		letter-spacing: 0.02em;
	}

	.acct:hover .avatar,
	.acct[aria-expanded="true"] .avatar {
		background: var(--bg);
	}

	.chev {
		color: var(--fg2);
		transition: transform 0.15s;
	}

	.acct[aria-expanded="true"] .chev {
		transform: rotate(180deg);
	}

	.menu {
		position: absolute;
		right: 0;
		top: calc(100% + 8px);
		width: 256px;
		background: var(--bg);
		border: 1px solid var(--line);
		border-radius: 12px;
		box-shadow: var(--shadow);
		padding: 6px;
		z-index: 10;
	}

	.menu-head {
		padding: 10px 10px 12px;
	}

	.menu-name {
		margin: 0;
		font-weight: 600;
		font-size: 15px;
	}

	.menu-email {
		margin: 2px 0 0;
		font-size: 14px;
		color: var(--fg2);
		overflow-wrap: anywhere;
	}

	.tag {
		display: inline-block;
		margin-top: 8px;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.02em;
		padding: 3px 8px;
		border-radius: 999px;
		background: var(--fill);
		color: var(--fg2);
		line-height: 1.2;
	}

	.menu-list {
		list-style: none;
		margin: 0;
		padding: 0;
		flex-direction: column;
		gap: 2px;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 44px;
		padding: 0 10px;
		border-radius: 8px;
		color: var(--fg);
		text-decoration: none;
		font-size: 15px;
		font-weight: 500;
	}

	button.menu-item {
		width: 100%;
		border: 0;
		background: none;
		text-align: left;
	}

	.menu-item:hover,
	.menu-item.is-current {
		background: var(--fill);
	}

	.menu-item svg {
		color: var(--fg2);
		flex: none;
	}

	/* On a desktop the top bar has the links; the menu has them on a phone. */
	.menu-mobile {
		display: none;
	}

	@media (max-width: 640px) {
		.topbar-in {
			padding: 0 16px;
			gap: 12px;
		}

		.nav-main,
		.acct-name,
		.chev {
			display: none;
		}

		.acct {
			padding: 0;
			width: 44px;
			justify-content: center;
		}

		.menu {
			right: -4px;
			width: min(300px, calc(100vw - 24px));
		}

		.menu-head {
			border-bottom: 1px solid var(--line);
			margin: 0 0 6px;
		}

		.menu-mobile {
			display: flex;
		}
	}
</style>
