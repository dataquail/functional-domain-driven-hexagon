import { Command, PersistenceUnavailable } from "@effect-server-utils/cqrs";
import * as Schema from "effect/Schema";

import { AlreadyHasRole, CannotPromoteSelf } from "@/modules/role/domain/roles/role.errors.js";
import { RoleValueObject } from "@/modules/role/domain/roles/role.value-object.js";
import { UserId } from "@/platform/ids/user-id.js";

// `actorUserId` is carried explicitly rather than pulled from `CurrentUser` so the bus
// boundary stays uniform — the HTTP endpoint is the one place that translates
// request-context into command input.
export const GrantRoleCommand = Command.make("GrantRoleCommand", {
  payload: {
    // The user receiving the role.
    userId: UserId,
    role: RoleValueObject,
    actorUserId: UserId,
  },
  success: Schema.Void,
  failure: Schema.Union([AlreadyHasRole, CannotPromoteSelf, PersistenceUnavailable]),
});
export type GrantRolePayload = Command.Payload<typeof GrantRoleCommand>;
