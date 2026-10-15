import * as Schema from "effect/Schema";

import { UserId } from "@/globals/application/ddd/ids/user-id";

export class UserAlreadyExists extends Schema.TaggedError<
  UserAlreadyExists,
  { readonly brand: "UserAlreadyExists" }
>()("UserAlreadyExists", { email: Schema.String }) {}

export class UserNotFound extends Schema.TaggedError<
  UserNotFound,
  { readonly brand: "UserNotFound" }
>()("UserNotFound", {
  userId: UserId,
}) {}
