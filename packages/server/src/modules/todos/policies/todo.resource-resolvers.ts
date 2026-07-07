import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { TodosRepository } from "@/modules/todos/domain/ports/repositories/todo.repository.js";
import { type TodoId } from "@/modules/todos/domain/todo.id.js";
import { TodosRepositoryLive } from "@/modules/todos/infrastructure/repositories/todos.repository-live.js";
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
    todoCollection: { resourceType: TodoOrgContext; idType: OrganizationId };
    todo: { resourceType: TodoOrgContext; idType: TodoResourceId };
  }
}

export class TodoCollectionResolverEntry extends Context.Tag("TodoCollectionResolverEntry")<
  TodoCollectionResolverEntry,
  Resolver<"todoCollection">
>() {}

// Echo: the collection's identity is the org id. No cross-module load —
// non-members get 403 without learning whether the org exists.
export const TodoCollectionResolverEntryLive = Layer.succeed(
  TodoCollectionResolverEntry,
  (organizationId) => Effect.succeed({ organizationId }),
);

export class TodoResolverEntry extends Context.Tag("TodoResolverEntry")<
  TodoResolverEntry,
  Resolver<"todo">
>() {}

// Loads the todo scoped to its org. `TodoNotFound` (missing OR
// cross-tenant) → `NotFound`, which the endpoint maps to
// `TodoNotFoundError`. `PersistenceUnavailable` dies inside the resolver
// — the endpoint's `recoverPersistenceUnavailable` converts it to 503,
// same shape as the organization resolver.
export const TodoResolverEntryLive = Layer.effect(
  TodoResolverEntry,
  Effect.gen(function* () {
    const repo = yield* TodosRepository;
    return ({ organizationId, todoId }) =>
      repo.findOneById(organizationId, todoId).pipe(
        Effect.map((todo) => ({ organizationId: todo.organizationId })),
        Effect.catchTag("TodoNotFound", () => Effect.fail(new CustomHttpApiError.NotFound())),
        Effect.catchTag("PersistenceUnavailable", Effect.die),
      );
  }),
).pipe(Layer.provide(TodosRepositoryLive));
