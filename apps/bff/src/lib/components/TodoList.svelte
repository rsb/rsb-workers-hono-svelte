<script lang="ts">
	import type { TodoReply } from "@todo/contract-api";
	import TodoItem from "./TodoItem.svelte";

	type Props = {
		/** At least one todo; with none there is no list. */
		todos: TodoReply[];
		/** The last failed toggle: which todo, and why. */
		toggleFailed: { id: string; message: string } | null;
	};

	let { todos, toggleFailed }: Props = $props();

	/** The failed toggle's message, for the todo it was about. */
	const errorFor = (todo: TodoReply): string | null => {
		if (toggleFailed === null) {
			return null;
		}
		if (toggleFailed.id !== todo.id) {
			return null;
		}
		return toggleFailed.message;
	};
</script>

<ul>
	{#each todos as todo (todo.id)}
		<TodoItem {todo} error={errorFor(todo)} />
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
