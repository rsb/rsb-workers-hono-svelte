import type { Own, Scope } from "@todo/business/auth/scope.ts";
import { ok } from "@todo/business/result.ts";
import type { Todo } from "@todo/business/todos/todo.ts";
import type { DbStore } from "@todo/data-d1/store.ts";

/** A todo as the fake keeps it: with its owner, as the table does. */
type Owned = { todo: Todo; ownerId: string };

/** Whether a kept todo is in the scope a call is given. */
const inScope = (scope: Scope, kept: Owned) => !("ownerId" in scope) || kept.ownerId === scope.ownerId;

/**
 * A fake `DbStore` that keeps todos in an array, each with its owner. It
 * reports facts as the real one does, and only about the todos in the
 * scope it is given (`todos.scoped`): whether a todo was inserted under the
 * owner's cap, the todos a filter keeps in order, how many are active and
 * completed, a todo as it is after a patch is applied, every todo after
 * all are set, whether a todo was deleted, and the todos left after a
 * clear. A todo outside the scope is reported as absent.
 */
export const fakeDbStore = (): DbStore => {
  const kept: Owned[] = [];
  const scoped = (scope: Scope) => kept.filter((each) => inScope(scope, each)).map((each) => each.todo);
  const find = (scope: Scope, id: string) => kept.findIndex((each) => each.todo.id === id && inScope(scope, each));

  return {
    addTodoUnlessFull: async (scope: Own, todo, limit) => {
      if (scoped(scope).length >= limit) {
        return ok(false);
      }
      kept.push({ todo, ownerId: scope.ownerId });
      return ok(true);
    },
    listTodos: async (scope, filter) => {
      const todos = scoped(scope);
      if (filter.completed === undefined) {
        return ok(todos);
      }
      return ok(todos.filter((todo) => todo.completed === filter.completed));
    },
    countTodos: async (scope) => {
      const todos = scoped(scope);
      const completed = todos.filter((todo) => todo.completed).length;
      return ok({ active: todos.length - completed, completed });
    },
    updateTodo: async (scope, id, patch) => {
      const found = kept[find(scope, id)];
      if (found === undefined) {
        return ok(null);
      }
      found.todo = { ...found.todo, ...patch };
      return ok(found.todo);
    },
    setAllCompleted: async (scope, completed) => {
      for (const each of kept) {
        if (inScope(scope, each)) {
          each.todo = { ...each.todo, completed };
        }
      }
      return ok(scoped(scope));
    },
    deleteTodo: async (scope, id) => {
      const index = find(scope, id);
      if (index === -1) {
        return ok(false);
      }
      kept.splice(index, 1);
      return ok(true);
    },
    deleteCompleted: async (scope) => {
      const left = kept.filter((each) => !inScope(scope, each) || !each.todo.completed);
      kept.splice(0, kept.length, ...left);
      return ok(scoped(scope));
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
