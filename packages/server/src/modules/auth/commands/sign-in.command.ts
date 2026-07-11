import * as Schema from "effect/Schema";

import { type SessionId } from "@/modules/auth/domain/session/session.id.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
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
