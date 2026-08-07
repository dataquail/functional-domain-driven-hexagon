import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { PersistenceUnavailable, QueryBus, type QueryBusShape } from "@org/cqrs";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import { type TodoOrganizationView } from "@/modules/todos/queries/find-todo-organization.query.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

import { TodoResolverEntry, TodoResolverEntryLive } from "./todo.resource-resolvers.js";

const organizationId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const todoId = TodoId.make("33333333-3333-3333-3333-333333333333");

// The resolver's only dependency is the query it dispatches, so the bus is faked
// down to that one answer. `as never` erases the per-message generic the real
// `execute` resolves from its definition argument.
const busAnswering = (
  answer: Effect.Effect<TodoOrganizationView | null, PersistenceUnavailable>,
): QueryBusShape => ({
  execute: () => answer as never,
  tags: new Set(["FindTodoOrganizationQuery"]),
});

const resolverOver = (answer: Effect.Effect<TodoOrganizationView | null, PersistenceUnavailable>) =>
  TodoResolverEntryLive.pipe(Layer.provide(Layer.succeed(QueryBus, busAnswering(answer))));

describe("TodoResolverEntry", () => {
  it.effect("resolves the todo's organization context", () =>
    Effect.gen(function* () {
      const resolve = yield* TodoResolverEntry;
      deepStrictEqual(yield* resolve({ organizationId, todoId }), { organizationId });
    }).pipe(Effect.provide(resolverOver(Effect.succeed({ organizationId })))),
  );

  it.effect("reports absence as NotFound", () =>
    Effect.gen(function* () {
      const resolve = yield* TodoResolverEntry;
      const exit = yield* Effect.exit(resolve({ organizationId, todoId }));

      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow);
        deepStrictEqual(error instanceof CustomHttpApiError.NotFound, true);
      }
    }).pipe(Effect.provide(resolverOver(Effect.succeed(null)))),
  );

  // A transient store outage during resolution is the same outage as one during
  // the use case, so it has to reach the endpoint as a failure to become the same
  // 503. Dying here would report a retryable outage as a 500.
  it.effect("propagates PersistenceUnavailable as a failure, not a defect", () =>
    Effect.gen(function* () {
      const resolve = yield* TodoResolverEntry;
      const exit = yield* Effect.exit(resolve({ organizationId, todoId }));

      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        deepStrictEqual(Cause.hasDies(exit.cause), false);
        const error = Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow);
        deepStrictEqual(error instanceof PersistenceUnavailable, true);
      }
    }).pipe(
      Effect.provide(resolverOver(new PersistenceUnavailable({ message: "connection lost" }))),
    ),
  );
});
