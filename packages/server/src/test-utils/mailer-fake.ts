import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import { Mailer, type MailInput } from "@/platform/notifications/mailer.js";

// Records every sent mail so command unit tests can assert against the
// invite-flow side effect. Mirrors the `RecordingEventBus` /
// `RecordedEvents` pair shape — provide `MailerFake` in the test layer,
// then yield `SentMails` to read what was captured.
export class SentMails extends Context.Tag("SentMails")<
  SentMails,
  {
    readonly all: Effect.Effect<ReadonlyArray<MailInput>>;
  }
>() {}

export const MailerFake: Layer.Layer<Mailer | SentMails> = Layer.effectContext(
  Effect.gen(function* () {
    const sent = yield* Ref.make<ReadonlyArray<MailInput>>([]);
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
