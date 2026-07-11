import * as Schema from "effect/Schema";

import { RoleValueObject } from "@/modules/role/domain/roles/role.value-object.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { UserId } from "@/platform/ids/user-id.js";

export const RevokeRoleCommand = Schema.TaggedStruct("RevokeRoleCommand", {
  userId: UserId,
  role: RoleValueObject,
});
export type RevokeRoleCommand = typeof RevokeRoleCommand.Type;

export const revokeRoleCommandSpanAttributes: SpanAttributesExtractor<RevokeRoleCommand> = (
  cmd,
) => ({
  "user.id": cmd.userId,
  "role.name": cmd.role,
});
