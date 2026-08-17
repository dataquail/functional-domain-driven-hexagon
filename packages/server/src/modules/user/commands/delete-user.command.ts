import { Command, PersistenceUnavailable } from "@effect-server-utils/cqrs";
import * as Schema from "effect/Schema";

import { UserNotFound } from "@/modules/user/domain/user/user.errors.js";
import { UserId } from "@/platform/ids/user-id.js";

export const DeleteUserCommand = Command.make("DeleteUserCommand", {
  payload: { userId: UserId },
  success: Schema.Void,
  failure: Schema.Union([UserNotFound, PersistenceUnavailable]),
});
export type DeleteUserPayload = Command.Payload<typeof DeleteUserCommand>;
