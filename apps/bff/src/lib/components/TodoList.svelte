<script lang="ts">
	import type { TodoReply } from "@todo/contract-api";

	type Props = {
		/** At least one todo; with none there is no list. */
		todos: TodoReply[];
	};

	let { todos }: Props = $props();
</script>

<ul>
	{#each todos as todo (todo.id)}
		<li class="row">
			<!-- Holds the place of the check, which comes with slice 3. -->
			<span class="check-slot" aria-hidden="true"></span>
			<span class="title">{todo.title}</span>
		</li>
	{/each}
</ul>

<style>
	ul {
		display: flex;
		flex-direction: column;
		margin: 10px 0 0;
		padding: 0;
		list-style: none;
	}

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

	.check-slot {
		width: 22px;
		height: 22px;
		flex: none;
		margin-top: 2px;
	}

	.title {
		flex: 1;
		min-width: 0;
		color: var(--fg);
		font-size: 17px;
		line-height: 1.5;
		overflow-wrap: anywhere;
		text-wrap: pretty;
	}
</style>
