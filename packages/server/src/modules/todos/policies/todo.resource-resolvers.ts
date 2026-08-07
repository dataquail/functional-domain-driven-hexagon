import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { QueryBus } from "@org/cqrs";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { type TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import { FindTodoOrganizationQuery } from "@/modules/todos/queries/find-todo-organization.query.js";
import { type Resolver } from "@/platform/auth/resource-resolver-registry.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

// Todos expose two policy resources, split by what is actually being
// acted on:
//
//   - `todoCollection` (keyed by OrganizationId) gates the list read
//     (and, via a direct check, create). Its identity genuinely *is*
//     the org, so the resolver is a deliberate echo: there is nothing
//     to load, and a non-member must not learn whether the org exists.
//
//   - `todo` (keyed by the (orgId, todoId) pair) gates per-item
//     update/delete. Its resolver *loads* the todo scoped to the org —
//     a missing row, or one living in a different org, surfaces as
//     NotFound (→ TodoNotFoundError at the endpoint), folding tenant
//     isolation into authorization. The resolved resource carries the
//     todo's real `organizationId`, which the membership check reads.
//
// Both resources resolve to the same org-membership context, so a
// single `IsTodoOrgMember` check serves both (see is-todo-org-member.ts).
export type TodoOrgContext = { readonly organizationId: OrganizationId };
export type TodoResourceId = {
  readonly organizationId: OrganizationId;
  readonly todoId: TodoId;
};

declare module "@/platform/auth/resource-resolver-registry.js" {
  interface ResourceResolverMap {
    todoCollection: {
      resourceType: TodoOrgContext;
      idType: OrganizationId;
      notFound: never;
    };
    todo: { resourceType: TodoOrgContext; idType: TodoResourceId };
  }
}

export class TodoCollectionResolverEntry extends Context.Service<
  TodoCollectionResolverEntry,
  Resolver<"todoCollection">
>()("TodoCollectionResolverEntry") {}

// Echo: the collection's identity is the org id. No cross-module load —
// non-members get 403 without learning whether the org exists.
export const TodoCollectionResolverEntryLive = Layer.succeed(
  TodoCollectionResolverEntry,
  (organizationId) => Effect.succeed({ organizationId }),
);

export class TodoResolverEntry extends Context.Service<TodoResolverEntry, Resolver<"todo">>()(
  "TodoResolverEntry",
) {}

// Loads the todo scoped to its org. Absence (missing OR cross-tenant, since
// the spec pins the org) → `NotFound`, which the endpoint maps to
// `TodoNotFoundError`. A transient store outage propagates untouched, so the
// endpoint's `recoverPersistenceUnavailable` turns it into the same 503 it would
// have produced had the outage struck the use case instead.
export const TodoResolverEntryLive = Layer.effect(
  TodoResolverEntry,
  Effect.gen(function* () {
    const queryBus = yield* QueryBus;
    return ({ organizationId, todoId }) =>
      queryBus
        .execute(FindTodoOrganizationQuery, { organizationId, todoId })
        .pipe(
          Effect.flatMap((view) =>
            view === null ? Effect.fail(new CustomHttpApiError.NotFound()) : Effect.succeed(view),
          ),
        );
  }),
);
