import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { UserId } from "@/platform/ids/user-id.js";

// Outbound port (ADR-0023): the user module's own contract for the
// role-management capability it needs from the role module. Defined in
// the consumer's vocabulary, not the publisher's — there is no mention
// of `GrantRoleCommand`, `Role`, or role-module error tags here. The
// `domain-isolation` dep-cruiser rule guarantees this file cannot import
// any of them, so the abstraction is provably consumer-owned; the foreign
// vocabulary is confined to `infrastructure/external/role-management-live.ts`.

// Surfaced when an actor attempts to elevate themselves to super admin.
// The role module raises its own `CannotPromoteSelf`; the outbound
// adapter translates it to this user-owned error so the user module's
// interface layer never names a role-module error type.
export class SelfPromotionForbidden extends Schema.TaggedError<SelfPromotionForbidden>(
  "SelfPromotionForbidden",
)("SelfPromotionForbidden", { userId: UserId }) {}

export type RoleManagementShape = {
  // Grant a user the super-admin role. Idempotent: if the user already
  // holds it, the desired state is met and this succeeds. Fails with
  // `SelfPromotionForbidden` when actor and target are the same user.
  readonly grantSuperAdmin: (params: {
    readonly userId: UserId;
    readonly actorUserId: UserId;
  }) => Effect.Effect<void, SelfPromotionForbidden | PersistenceUnavailable>;
  // Revoke a user's super-admin role. Idempotent: revoking a role the
  // user never held succeeds — the desired "not a super admin" state holds.
  readonly revokeSuperAdmin: (params: {
    readonly userId: UserId;
  }) => Effect.Effect<void, PersistenceUnavailable>;
};

export class RoleManagement extends Context.Tag("user/RoleManagement")<
  RoleManagement,
  RoleManagementShape
>() {}
