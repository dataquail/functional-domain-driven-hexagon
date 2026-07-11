import * as Schema from "effect/Schema";

import { RoleValueObject } from "@/modules/role/domain/roles/role.value-object.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { UserId } from "@/platform/ids/user-id.js";

export const GrantRoleCommand = Schema.TaggedStruct("GrantRoleCommand", {
  // The user receiving the role.
  userId: UserId,
  role: RoleValueObject,
  // The user dispatching the command. Carried explicitly (rather than
  // pulled from `CurrentUser`) so the bus boundary stays uniform — the
  // HTTP endpoint is the one place that translates request-context
  // into command input.
  actorUserId: UserId,
});
export type GrantRoleCommand = typeof GrantRoleCommand.Type;

export const grantRoleCommandSpanAttributes: SpanAttributesExtractor<GrantRoleCommand> = (cmd) => ({
  "user.id": cmd.userId,
  "role.name": cmd.role,
  "actor.user.id": cmd.actorUserId,
});
