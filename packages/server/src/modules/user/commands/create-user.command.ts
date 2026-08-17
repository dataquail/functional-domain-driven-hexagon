import { Command, PersistenceUnavailable } from "@effect-server-utils/cqrs";
import * as Schema from "effect/Schema";

import { UserAlreadyExists } from "@/modules/user/domain/user/user.errors.js";
import { UserId } from "@/platform/ids/user-id.js";

// Address fields are optional so the same command serves both the address-collecting
// create-user endpoint and JIT provisioning (which only has an email). The three move
// together — supply all or none.
//
// `UserAlreadyExists` is part of the declared failure channel because another module
// provisions through this command and translates that outcome into its own vocabulary.
export const CreateUserCommand = Command.make("CreateUserCommand", {
  payload: {
    email: Schema.String,
    country: Schema.optional(Schema.String),
    street: Schema.optional(Schema.String),
    postalCode: Schema.optional(Schema.String),
  },
  success: UserId,
  failure: Schema.Union([UserAlreadyExists, PersistenceUnavailable]),
});
export type CreateUserPayload = Command.Payload<typeof CreateUserCommand>;
