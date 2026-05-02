import { type AuthIdentityRepository } from "@/modules/auth/domain/auth-identity-repository.js";
import { type SessionId } from "@/modules/auth/domain/session-id.js";
import { type SessionRepository } from "@/modules/auth/domain/session-repository.js";
import { type UserId } from "@/platform/ids/user-id.js";
import { type SpanAttributesExtractor } from "@/platform/span-attributable.js";
import type * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

// Inputs come from the OIDC callback: a verified Zitadel `subject` + the
// caller's chosen TTLs. `email` is informational (kept for future JIT
// provisioning); we don't use it on the v1 happy path because the admin
// identity is pre-seeded by `infra/zitadel/seed.mjs` and non-admin JIT is
// deferred (plan §3.6).
export const SignInCommand = Schema.TaggedStruct("SignInCommand", {
  subject: Schema.String,
  email: Schema.NullOr(Schema.String),
  ttlSeconds: Schema.Number,
  absoluteTtlSeconds: Schema.Number,
});
export type SignInCommand = typeof SignInCommand.Type;

// `subject` is intentionally not in the span — Zitadel's sub is opaque but
// still user-correlatable. The handler annotates `user.id` once it's
// resolved, which is post-redaction and safe.
export const signInCommandSpanAttributes: SpanAttributesExtractor<SignInCommand> = () => ({});

export type SignInResult = {
  readonly sessionId: SessionId;
  readonly userId: UserId;
};

export type SignInOutput = Effect.Effect<
  SignInResult,
  CustomHttpApiError.Unauthorized,
  AuthIdentityRepository | SessionRepository
>;

declare module "@/platform/command-bus.js" {
  interface CommandRegistry {
    SignInCommand: {
      readonly command: SignInCommand;
      readonly output: SignInOutput;
    };
  }
}
