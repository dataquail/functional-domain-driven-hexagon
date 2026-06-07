import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type RoleManagement } from "@/modules/user/domain/ports/external/role-management.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { UserId } from "@/platform/ids/user-id.js";

// Revokes the super-admin platform role via the user-owned
// `RoleManagement` port. Dispatched by the
// `DELETE /users/:id/super-admin` endpoint. The port is idempotent —
// revoking a role never held succeeds — so the command surfaces only
// the transient-DB failure.
export const DemoteFromSuperAdminCommand = Schema.TaggedStruct("DemoteFromSuperAdminCommand", {
  userId: UserId,
});
export type DemoteFromSuperAdminCommand = typeof DemoteFromSuperAdminCommand.Type;

export const demoteFromSuperAdminCommandSpanAttributes: SpanAttributesExtractor<
  DemoteFromSuperAdminCommand
> = (c) => ({ "user.id": c.userId });

export type DemoteFromSuperAdminOutput = Effect.Effect<
  void,
  PersistenceUnavailable,
  RoleManagement
>;
