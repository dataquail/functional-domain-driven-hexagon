import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import {
  InvitationMailer,
  type SendInvitationInput,
} from "@/modules/organization/domain/ports/clients/invitation-mailer.client.js";

// Records every invitation-email request so invite-flow use-case unit
// tests can assert the side effect (recipient + token) without rendering
// HTML or standing up the platform `Mailer`. Mirrors the
// `RecordingEventBus`/`RecordedEvents` pair: provide `InvitationMailerFake`
// in the test layer, then yield `SentInvitations` to read what was captured.
export class SentInvitations extends Context.Tag("SentInvitations")<
  SentInvitations,
  {
    readonly all: Effect.Effect<ReadonlyArray<SendInvitationInput>>;
  }
>() {}

export const InvitationMailerFake: Layer.Layer<InvitationMailer | SentInvitations> =
  Layer.effectContext(
    Effect.gen(function* () {
      const sent = yield* Ref.make<ReadonlyArray<SendInvitationInput>>([]);
      return Context.empty().pipe(
        Context.add(
          InvitationMailer,
          InvitationMailer.of({
            send: (input) => Ref.update(sent, (prev) => [...prev, input]),
          }),
        ),
        Context.add(SentInvitations, {
          all: Ref.get(sent),
        }),
      );
    }),
  );
