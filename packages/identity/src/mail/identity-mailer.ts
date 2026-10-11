import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export type IdentityEmail = {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
};

export type MailSender = {
  readonly address: string;
  readonly name: string;
};

export class MailDeliveryError extends Schema.TaggedError<MailDeliveryError>()(
  "MailDeliveryError",
  { message: Schema.String },
) {}

export type IdentityMailer = {
  readonly send: (email: IdentityEmail) => Effect.Effect<void, MailDeliveryError>;
};
