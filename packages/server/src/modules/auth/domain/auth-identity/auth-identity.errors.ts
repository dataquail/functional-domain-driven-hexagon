import * as Schema from "effect/Schema";

export class AuthIdentityNotFound extends Schema.TaggedErrorClass<AuthIdentityNotFound>(
  "AuthIdentityNotFound",
)("AuthIdentityNotFound", { subject: Schema.String }) {}

// The two ways first sign-in can fail to establish an application user for an
// otherwise-verified external identity. Both are auth's own vocabulary: the
// endpoint decides they are a 401, and one of them is this module's translation
// of the user module's provisioning conflict.
export class IdentityMissingEmail extends Schema.TaggedErrorClass<IdentityMissingEmail>(
  "IdentityMissingEmail",
)("IdentityMissingEmail", { subject: Schema.String }) {}

export class IdentityEmailAlreadyRegistered extends Schema.TaggedErrorClass<IdentityEmailAlreadyRegistered>(
  "IdentityEmailAlreadyRegistered",
)("IdentityEmailAlreadyRegistered", { email: Schema.String }) {}
