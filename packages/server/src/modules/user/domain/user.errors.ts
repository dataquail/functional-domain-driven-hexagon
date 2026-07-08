import * as Schema from "effect/Schema";

import { UserId } from "@/platform/ids/user-id.js";

export class UserAlreadyExists extends Schema.TaggedErrorClass<UserAlreadyExists>("UserAlreadyExists")(
  "UserAlreadyExists",
  { email: Schema.String },
) {}

export class UserNotFound extends Schema.TaggedErrorClass<UserNotFound>("UserNotFound")("UserNotFound", {
  userId: UserId,
}) {}
