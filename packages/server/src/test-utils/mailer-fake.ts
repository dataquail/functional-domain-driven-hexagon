import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import { Mailer, type MailMessage } from "@/platform/notifications/mailer.js";

// Records every rendered message handed to the platform transport so
// tests can assert against it (the `InvitationMailerLive` adapter test
// uses this to check the rendered HTML/text carries the accept link).
// Mirrors the `RecordingEventBus` / `RecordedEvents` pair shape — provide
// `MailerFake` in the test layer, then yield `SentMails` to read what was
// captured.
export class SentMails extends Context.Service<
  SentMails,
  {
    readonly all: Effect.Effect<ReadonlyArray<MailMessage>>;
  }
>()("SentMails") {}

export const MailerFake: Layer.Layer<Mailer | SentMails> = Layer.effectContext(
  Effect.gen(function* () {
    const sent = yield* Ref.make<ReadonlyArray<MailMessage>>([]);
    return Context.empty().pipe(
      Context.add(
        Mailer,
        Mailer.of({
          send: (input) => Ref.update(sent, (prev) => [...prev, input]),
        }),
      ),
      Context.add(SentMails, {
        all: Ref.get(sent),
      }),
    );
  }),
);
