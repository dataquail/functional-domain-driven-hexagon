import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import { TodosRepository } from "@/modules/todos/domain/ports/repositories/todo.repository.js";
import { TodoNotFound } from "@/modules/todos/domain/todo.errors.js";
import { type TodoId } from "@/modules/todos/domain/todo.id.js";
import { type TodoRoot } from "@/modules/todos/domain/todo.root.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

// Keyed by TodoId; org scoping is enforced by guarding on the stored
// todo's organizationId — a read/mutate for the wrong org behaves like
// a missing row (TodoNotFound), mirroring the live repo's
// `WHERE id AND organization_id` filter.
export const TodosRepositoryFake = Layer.effect(
  TodosRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<TodoId, TodoRoot>());

    const insertOne = (todo: TodoRoot): Effect.Effect<void> =>
      Ref.update(store, HashMap.set(todo.id, todo));

    const updateOne = (todo: TodoRoot): Effect.Effect<void, TodoNotFound> =>
      Effect.flatMap(Ref.get(store), (m) => {
        const found = HashMap.get(m, todo.id);
        return found._tag === "Some" && found.value.organizationId === todo.organizationId
          ? Ref.update(store, HashMap.set(todo.id, todo))
          : Effect.fail(new TodoNotFound({ todoId: todo.id }));
      });

    const deleteOne = (
      organizationId: OrganizationId,
      id: TodoId,
    ): Effect.Effect<void, TodoNotFound> =>
      Effect.flatMap(Ref.get(store), (m) => {
        const found = HashMap.get(m, id);
        return found._tag === "Some" && found.value.organizationId === organizationId
          ? Ref.update(store, HashMap.remove(id))
          : Effect.fail(new TodoNotFound({ todoId: id }));
      });

    const findOneById = (
      organizationId: OrganizationId,
      id: TodoId,
    ): Effect.Effect<TodoRoot, TodoNotFound> =>
      Effect.flatMap(Ref.get(store), (m) =>
        Option.match(HashMap.get(m, id), {
          onNone: () => Effect.fail(new TodoNotFound({ todoId: id })),
          onSome: (todo) =>
            todo.organizationId === organizationId
              ? Effect.succeed(todo)
              : Effect.fail(new TodoNotFound({ todoId: id })),
        }),
      );

    return TodosRepository.of({ insertOne, updateOne, deleteOne, findOneById });
  }),
);
