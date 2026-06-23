import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { Mailer } from "./mailer.js";

// Dev/CI default backend (`MAILER=log`): structured logs only, no real
// send — so `pnpm test` and a fresh checkout need no SMTP/SES. The
// plaintext body is logged in full (not the HTML) so an invitation link
// is recoverable from logs when no Mailpit is running. Never fails:
// `Effect.logInfo` is `Effect<void, never>`, assignable to the port's
// `MailDeliveryError` channel.
export const LogMailerLive = Layer.succeed(
  Mailer,
  Mailer.of({
    send: (message) =>
      Effect.logInfo("Mailer.send", {
        to: message.to,
        subject: message.subject,
        text: message.text,
      }),
  }),
);
