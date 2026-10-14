import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import { type OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { type Specification } from "@/globals/application/ddd/specification.ts";
import { TodoNotFound } from "@/modules/todos/domain/todo/todo.errors.ts";
import { type TodoId } from "@/modules/todos/domain/todo/todo.id.ts";
import { type TodoRoot } from "@/modules/todos/domain/todo/todo.root.ts";
import { TodosRepository } from "@/modules/todos/domain/todo/todos.repository.ts";

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

    const findInOrganization = (organizationId: OrganizationId, id: TodoId) =>
      Effect.map(Ref.get(store), (m) =>
        HashMap.get(m, id).pipe(Option.filter((found) => found.organizationId === organizationId)),
      );

    const updateOne = (todo: TodoRoot): Effect.Effect<void, TodoNotFound> =>
      findInOrganization(todo.organizationId, todo.id).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.fail(new TodoNotFound({ todoId: todo.id })),
            onSome: () => Ref.update(store, HashMap.set(todo.id, todo)),
          }),
        ),
      );

    const deleteOne = (
      organizationId: OrganizationId,
      id: TodoId,
    ): Effect.Effect<void, TodoNotFound> =>
      findInOrganization(organizationId, id).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.fail(new TodoNotFound({ todoId: id })),
            onSome: () => Ref.update(store, HashMap.remove(id)),
          }),
        ),
      );

    // The spec IS the in-memory predicate — the same object the live repo
    // compiles to SQL — so fake and live agree by construction. Org scoping is
    // just another term in the spec (`forOrganization`), so a wrong-org read
    // finds nothing and returns None, mirroring the live `WHERE`.
    const findOne = (spec: Specification<TodoRoot>): Effect.Effect<Option.Option<TodoRoot>> =>
      Effect.map(Ref.get(store), (m) =>
        Option.fromUndefinedOr(Array.from(HashMap.values(m)).find(spec)),
      );

    return TodosRepository.of({ insertOne, updateOne, deleteOne, findOne });
  }),
);
