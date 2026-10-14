import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { QueryBus } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { TodoId } from "@/modules/todos/domain/todo/todo.id.ts";
import { type TodoOrganizationView } from "@/modules/todos/queries/find-todo-organization.query.ts";

import { TodoResolverEntry, TodoResolverEntryLive } from "./todo.resource-resolvers.ts";

const organizationId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const todoId = TodoId.make("33333333-3333-3333-3333-333333333333");

type Answer = Effect.Effect<Option.Option<TodoOrganizationView>, PersistenceUnavailable>;

// The resolver's only dependency is the query it dispatches, so the bus is faked
// down to that one answer.
const busAnswering = (answer: Answer) =>
  QueryBus.of({
    // SAFETY: the resolver dispatches only FindTodoOrganizationQuery, whose success is this answer.
    // oxlint-disable-next-line effect/noAs -- a fixed answer cannot inhabit execute's per-message generic
    execute: () => answer as never,
    tags: new Set(["FindTodoOrganizationQuery"]),
  });

const resolverOver = (answer: Answer) =>
  TodoResolverEntryLive.pipe(Layer.provide(Layer.succeed(QueryBus, busAnswering(answer))));

describe("TodoResolverEntry", () => {
  it.effect("resolves the todo's organization context", () =>
    Effect.gen(function* () {
      const resolve = yield* TodoResolverEntry;
      deepStrictEqual(yield* resolve({ organizationId, todoId }), { organizationId });
    }).pipe(Effect.provide(resolverOver(Effect.succeedSome({ organizationId })))),
  );

  it.effect("reports absence as NotFound", () =>
    Effect.gen(function* () {
      const resolve = yield* TodoResolverEntry;
      const exit = yield* Effect.exit(resolve({ organizationId, todoId }));

      deepStrictEqual(Exit.isFailure(exit), true);

      if (Exit.isFailure(exit)) {
        const error = Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow);
        deepStrictEqual(Schema.is(CustomHttpApiError.NotFound)(error), true);
      }
    }).pipe(Effect.provide(resolverOver(Effect.succeedNone))),
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
        deepStrictEqual(Schema.is(PersistenceUnavailable)(error), true);
      }
    }).pipe(
      Effect.provide(resolverOver(new PersistenceUnavailable({ message: "connection lost" }))),
    ),
  );
});
