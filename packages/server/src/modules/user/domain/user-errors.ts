import { UserId } from "@/platform/ids/user-id.js";
import * as Schema from "effect/Schema";

export class UserAlreadyExists extends Schema.TaggedError<UserAlreadyExists>("UserAlreadyExists")(
  "UserAlreadyExists",
  { email: Schema.String },
) {}

export class UserNotFound extends Schema.TaggedError<UserNotFound>("UserNotFound")("UserNotFound", {
  userId: UserId,
}) {}
