import * as Schema from "effect/Schema";

// A transport-level failure to hand a message off to the mail backend
// (SMTP connection refused, SES API error, etc.). Modeled as a tagged
// error (ADR-0004) so adapters surface a uniform failure regardless of
// backend, and consumers decide policy: the invite flow, for instance,
// logs-and-swallows because the invitation row is already committed and
// email is best-effort. `LogMailerLive` never produces this.
export class MailDeliveryError extends Schema.TaggedErrorClass<MailDeliveryError>(
  "MailDeliveryError",
)("MailDeliveryError", { message: Schema.String }) {}
