import { Command } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

import {
  IdentityEmailAlreadyRegistered,
  IdentityMissingEmail,
} from "@/modules/auth/domain/auth-identity/auth-identity.errors.js";
import { SessionId } from "@/modules/auth/domain/session/session.id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const SignInResultView = Schema.Struct({
  sessionId: SessionId,
  userId: UserId,
});
export type SignInResult = typeof SignInResultView.Type;

// Inputs come from the OIDC callback: a verified Zitadel `subject`, the
// signed-in `email`, and the caller's chosen TTLs. `email` is required to
// JIT-provision an unknown subject on first sign-in (admins are pre-seeded
// by `infra/zitadel/seed.mjs`); a `null` email fails provisioning.
export const SignInCommand = Command.make("SignInCommand", {
  payload: {
    subject: Schema.String,
    email: Schema.NullOr(Schema.String),
    ttlSeconds: Schema.Number,
    absoluteTtlSeconds: Schema.Number,
  },
  success: SignInResultView,
  failure: Schema.Union([
    IdentityMissingEmail,
    IdentityEmailAlreadyRegistered,
    PersistenceUnavailable,
  ]),
});
export type SignInPayload = Command.Payload<typeof SignInCommand>;
