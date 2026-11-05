import { ok } from "@todo/business/result.ts";
import type { Todo } from "@todo/business/todos/todo.ts";
import type { DbStore } from "@todo/data-d1/store.ts";

/**
 * A fake `DbStore` that keeps todos in an array. It reports facts as the
 * real one does: whether a todo was inserted, the todos a filter keeps in
 * order, how many are active and completed, a
 * todo as it is after a patch is applied, every todo after all are set,
 * whether a todo was deleted, and the todos left after a clear.
 */
export const fakeDbStore = (): DbStore => {
  const todos: Todo[] = [];
  return {
    addTodoUnlessFull: async (todo, limit) => {
      if (todos.length >= limit) {
        return ok(false);
      }
      todos.push(todo);
      return ok(true);
    },
    listTodos: async (filter) => {
      if (filter.completed === undefined) {
        return ok([...todos]);
      }
      const kept = todos.filter((todo) => todo.completed === filter.completed);
      return ok(kept);
    },
    countTodos: async () => {
      const completed = todos.filter((todo) => todo.completed).length;
      const active = todos.length - completed;
      return ok({ active, completed });
    },
    updateTodo: async (id, patch) => {
      const index = todos.findIndex((todo) => todo.id === id);
      const found = todos[index];
      if (found === undefined) {
        return ok(null);
      }
      const updated = { ...found, ...patch };
      todos[index] = updated;
      return ok(updated);
    },
    setAllCompleted: async (completed) => {
      for (const [index, todo] of todos.entries()) {
        todos[index] = { ...todo, completed };
      }
      return ok([...todos]);
    },
    deleteTodo: async (id) => {
      const index = todos.findIndex((todo) => todo.id === id);
      if (index === -1) {
        return ok(false);
      }
      todos.splice(index, 1);
      return ok(true);
    },
    deleteCompleted: async () => {
      const left = todos.filter((todo) => !todo.completed);
      todos.splice(0, todos.length, ...left);
      return ok([...todos]);
    },
  };
};

/**
 * Wraps a store so that each method call is recorded by name, then passed
 * to the store unchanged. The api's budgets count these: one call is one
 * call through an operation's port.
 */
export const countingDbStore = (store: DbStore) => {
  const calls: (keyof DbStore)[] = [];
  const counted = { ...store };
  for (const name of Object.keys(store) as (keyof DbStore)[]) {
    const method = store[name] as (...args: unknown[]) => unknown;
    (counted as Record<keyof DbStore, unknown>)[name] = (...args: unknown[]) => {
      calls.push(name);
      return method(...args);
    };
  }
  return { store: counted, calls };
};
