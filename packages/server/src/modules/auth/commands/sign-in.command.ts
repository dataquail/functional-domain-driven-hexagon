import { Command } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

import { UserId } from "@/globals/application/ddd/ids/user-id.js";
import {
  IdentityEmailAlreadyRegistered,
  IdentityMissingEmail,
} from "@/modules/auth/domain/auth-identity/auth-identity.errors.js";
import { SessionId } from "@/modules/auth/domain/session/session.id.js";

export const SignInResultView = Schema.Struct({
  sessionId: SessionId,
  userId: UserId,
});
export type SignInResult = typeof SignInResultView.Type;

// Inputs come from the OIDC callback: the issuer's `subject`, the signed-in `email`
// and whether the issuer verified it, and the caller's chosen TTLs.
export const SignInCommand = Command.make("SignInCommand", {
  payload: {
    subject: Schema.String,
    email: Schema.NullOr(Schema.String),
    emailVerified: Schema.Boolean,
    ttlSeconds: Schema.Int,
    absoluteTtlSeconds: Schema.Int,
  },
  success: SignInResultView,
  failure: Schema.Union([
    IdentityMissingEmail,
    IdentityEmailAlreadyRegistered,
    PersistenceUnavailable,
  ]),
});
export type SignInPayload = Command.Payload<typeof SignInCommand>;
