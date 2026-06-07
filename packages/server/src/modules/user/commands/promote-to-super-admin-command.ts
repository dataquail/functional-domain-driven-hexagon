import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  type RoleManagement,
  type SelfPromotionForbidden,
} from "@/modules/user/domain/ports/external/role-management.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { UserId } from "@/platform/ids/user-id.js";

// Grants the super-admin platform role via the user-owned
// `RoleManagement` port (ADR-0023). Dispatched by the
// `POST /users/:id/super-admin` endpoint; the endpoint no longer
// touches the port directly (per
// `outbound-ports-private-to-use-cases`).
//
// `actorUserId` carries the caller from `CurrentUser` so the port's
// `SelfPromotionForbidden` invariant can fire — keeping the
// translation at the command boundary instead of the controller.
export const PromoteToSuperAdminCommand = Schema.TaggedStruct("PromoteToSuperAdminCommand", {
  userId: UserId,
  actorUserId: UserId,
});
export type PromoteToSuperAdminCommand = typeof PromoteToSuperAdminCommand.Type;

export const promoteToSuperAdminCommandSpanAttributes: SpanAttributesExtractor<
  PromoteToSuperAdminCommand
> = (c) => ({
  "user.id": c.userId,
  "actor.user.id": c.actorUserId,
});

// Raw handler effect — `RoleManagement` is provided at the
// composition root (it's the user-owned outbound adapter, wired via
// `RoleManagementLive`).
export type PromoteToSuperAdminOutput = Effect.Effect<
  void,
  SelfPromotionForbidden | PersistenceUnavailable,
  RoleManagement
>;
