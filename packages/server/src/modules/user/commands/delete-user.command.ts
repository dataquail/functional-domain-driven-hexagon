import { Command } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { UserNotFound } from "@/modules/user/domain/user/user.errors.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { UserId } from "@/platform/ids/user-id.js";

export const DeleteUser = Command.make("DeleteUserCommand", {
  payload: { userId: UserId },
  success: Schema.Void,
  failure: Schema.Union([UserNotFound, PersistenceUnavailable]),
});
export type DeleteUserPayload = Command.Payload<typeof DeleteUser>;
