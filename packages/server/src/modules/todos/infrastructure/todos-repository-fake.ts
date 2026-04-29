import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import { TodoNotFound } from "../domain/todo-errors.js";
import { type TodoId } from "../domain/todo-id.js";
import { TodosRepository } from "../domain/todo-repository.js";
import { type Todo } from "../domain/todo.js";

export const TodosRepositoryFake = Layer.effect(
  TodosRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<TodoId, Todo>());

    const insert = (todo: Todo): Effect.Effect<void> =>
      Ref.update(store, HashMap.set(todo.id, todo));

    const update = (todo: Todo): Effect.Effect<void, TodoNotFound> =>
      Effect.flatMap(Ref.get(store), (m) =>
        HashMap.has(m, todo.id)
          ? Ref.update(store, HashMap.set(todo.id, todo))
          : Effect.fail(new TodoNotFound({ todoId: todo.id })),
      );

    const remove = (id: TodoId): Effect.Effect<void, TodoNotFound> =>
      Effect.flatMap(Ref.get(store), (m) =>
        HashMap.has(m, id)
          ? Ref.update(store, HashMap.remove(id))
          : Effect.fail(new TodoNotFound({ todoId: id })),
      );

    const findById = (id: TodoId): Effect.Effect<Todo, TodoNotFound> =>
      Effect.flatMap(Ref.get(store), (m) =>
        Option.match(HashMap.get(m, id), {
          onNone: () => Effect.fail(new TodoNotFound({ todoId: id })),
          onSome: Effect.succeed,
        }),
      );

    return TodosRepository.of({ insert, update, remove, findById });
  }),
);
