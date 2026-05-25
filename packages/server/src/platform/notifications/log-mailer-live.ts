import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { Mailer } from "./mailer.js";

// Dev/MVP backend: structured logs only. Body is truncated in the log
// to keep the line readable; full body is dropped (it's the only way to
// recover the invitation token from logs, which is by design — the
// production path uses a real email backend).
export const LogMailerLive = Layer.succeed(
  Mailer,
  Mailer.of({
    send: (input) =>
      Effect.log("Mailer.send", {
        to: input.to,
        subject: input.subject,
        bodyPreview: input.body.length > 120 ? `${input.body.slice(0, 117)}...` : input.body,
      }),
  }),
);
