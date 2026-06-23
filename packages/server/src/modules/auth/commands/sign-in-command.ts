import type * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type AuthIdentityRepository } from "@/modules/auth/domain/ports/repositories/auth-identity-repository.js";
import { type SessionRepository } from "@/modules/auth/domain/ports/repositories/session-repository.js";
import { type SessionId } from "@/modules/auth/domain/session-id.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { type UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";
import { type UserProvisioning } from "@/platform/ddd/ports/user-provisioning.js";
import { type UserId } from "@/platform/ids/user-id.js";

// Inputs come from the OIDC callback: a verified Zitadel `subject`, the
// signed-in `email`, and the caller's chosen TTLs. `email` is required to
// JIT-provision an unknown subject on first sign-in (admins are pre-seeded
// by `infra/zitadel/seed.mjs`); a `null` email fails provisioning.
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

// Raw handler effect — `AuthIdentityRepository` and `SessionRepository` are
// discharged by the wrap in `auth-command-handlers.ts`; `UnitOfWork` and
// `UserProvisioning` are satisfied from the composition-root context. The
// bus-registered output type lives in `auth-command-handlers.ts`.
export type SignInOutput = Effect.Effect<
  SignInResult,
  CustomHttpApiError.Unauthorized | PersistenceUnavailable,
  AuthIdentityRepository | SessionRepository | UnitOfWork | UserProvisioning
>;
