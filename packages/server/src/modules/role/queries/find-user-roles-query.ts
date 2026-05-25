import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type Role } from "@/modules/role/domain/role.js";
import { type RolesRepository } from "@/modules/role/domain/roles-repository.js";
import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/span-attributable.js";
import { UserId } from "@/platform/ids/user-id.js";

// Read-side projection of a user's platform roles. Returns an empty
// array if the user has none — absence isn't NotFound. Other modules'
// policies don't depend on this query directly; the platform-layer
// `RoleService` (`platform/role-service-live.ts`) wraps it and maps to
// a generalized shape.
export const FindUserRolesQuery = Schema.TaggedStruct("FindUserRolesQuery", {
  userId: UserId,
});
export type FindUserRolesQuery = typeof FindUserRolesQuery.Type;

export type FindUserRolesResult = {
  readonly userId: UserId;
  readonly roles: ReadonlyArray<Role>;
};

export const findUserRolesQuerySpanAttributes: SpanAttributesExtractor<FindUserRolesQuery> = (
  query,
) => ({ "query.userId": query.userId });

// Raw handler effect — `RolesRepository` is discharged by the wrap in
// `role-query-handlers.ts`; the bus-registered output type lives there.
export type FindUserRolesOutput = Effect.Effect<
  FindUserRolesResult,
  PersistenceUnavailable,
  RolesRepository
>;
