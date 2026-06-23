import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type MailDeliveryError } from "./mail-errors.js";

// Platform transport port for outbound email. It carries a *rendered*
// message — `html` + a plaintext `text` fallback — and knows nothing
// about templates or which feature is sending. Rendering (React Email)
// lives one layer out, in the module-owned adapters that build a
// message and call `send`.
//
// Adapters (swapped by the `MAILER` env var at the composition root):
//   - `LogMailerLive`  — dev/test default; structured log line, no send.
//   - `SmtpMailerLive` — nodemailer → Mailpit (local) or any SMTP relay.
//   - `SesMailerLive`  — AWS SES (prod).
export type MailMessage = {
  // RFC-5322 address or "Display Name <addr>". A single recipient is all
  // the current flows need; widen to an array when a fan-out appears.
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  // Plaintext alternative. Always populated (React Email renders one) so
  // spam filters and text-only clients have a body.
  readonly text: string;
  // Overrides the backend's default From (env `MAIL_FROM`) when set.
  readonly from?: string;
};

export type MailerShape = {
  // Real backends can fail at the transport boundary, so `send` carries a
  // modeled error. `LogMailerLive` returns `Effect<void, never>`, which is
  // assignable here.
  readonly send: (message: MailMessage) => Effect.Effect<void, MailDeliveryError>;
};

export class Mailer extends Context.Tag("Mailer")<Mailer, MailerShape>() {}
