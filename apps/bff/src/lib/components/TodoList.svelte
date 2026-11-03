<script lang="ts">
	import type { TodoReply } from "@todo/contract-api";
	import TodoItem from "./TodoItem.svelte";

	type Props = {
		/** At least one todo; with none there is no list. */
		todos: TodoReply[];
		/** The last failed toggle without JavaScript: which todo, and why. */
		toggleFailed: { id: string; message: string } | null;
		/** The last failed remove without JavaScript: which todo, and why. */
		removeFailed: { id: string; message: string } | null;
	};

	let { todos, toggleFailed, removeFailed }: Props = $props();

	/** A failure's message, for the todo it was about. */
	const messageFor = (failed: { id: string; message: string } | null, todo: TodoReply): string | null => {
		if (failed === null) {
			return null;
		}
		if (failed.id !== todo.id) {
			return null;
		}
		return failed.message;
	};
</script>

<ul>
	{#each todos as todo (todo.id)}
		<TodoItem {todo} error={messageFor(toggleFailed, todo)} removeError={messageFor(removeFailed, todo)} />
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
</style>
