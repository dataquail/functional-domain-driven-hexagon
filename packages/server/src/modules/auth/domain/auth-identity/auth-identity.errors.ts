import * as Schema from "effect/Schema";

export class AuthIdentityNotFound extends Schema.TaggedErrorClass<AuthIdentityNotFound>(
  "AuthIdentityNotFound",
)("AuthIdentityNotFound", { subject: Schema.String }) {}
