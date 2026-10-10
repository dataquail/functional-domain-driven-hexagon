import * as Schema from "effect/Schema";

import { UserId } from "@/globals/application/ddd/ids/user-id.js";

export class UserAlreadyExists extends Schema.TaggedError<UserAlreadyExists>()(
  "UserAlreadyExists",
  { email: Schema.String },
) {}

export class UserNotFound extends Schema.TaggedError<UserNotFound>()("UserNotFound", {
  userId: UserId,
}) {}
