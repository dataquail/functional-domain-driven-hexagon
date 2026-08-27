import { Command } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

import { DoesNotHaveRole } from "@/modules/role/domain/roles/role.errors.js";
import { RoleValueObject } from "@/modules/role/domain/roles/role.value-object.js";
import { UserId } from "@/platform/ids/user-id.js";

export const RevokeRoleCommand = Command.make("RevokeRoleCommand", {
  payload: { userId: UserId, role: RoleValueObject },
  success: Schema.Void,
  failure: Schema.Union([DoesNotHaveRole, PersistenceUnavailable]),
});
export type RevokeRolePayload = Command.Payload<typeof RevokeRoleCommand>;
