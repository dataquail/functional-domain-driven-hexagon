import * as Schema from "effect/Schema";
import { UserId } from "./user-id.js";

export class UserAlreadyExists extends Schema.TaggedError<UserAlreadyExists>("UserAlreadyExists")(
  "UserAlreadyExists",
  { email: Schema.String },
) {}

export class UserNotFound extends Schema.TaggedError<UserNotFound>("UserNotFound")("UserNotFound", {
  userId: UserId,
}) {}
