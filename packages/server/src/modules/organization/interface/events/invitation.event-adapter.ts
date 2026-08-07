// Inbound event adapter (ADR-0007) for this module's own invitation events. It
// subscribes after commit, so the email is only ever sent for an invitation that
// actually exists: the accept link would otherwise be live for a row a rollback
// took away.
//
// It is also why a mail-server outage can no longer fail an invite. Delivery is
// isolated by the flush, where before it was a statement the handler ran after
// its unit of work and whose failure surfaced to the caller.
//
// Bus-only, like every adapter: the dispatched command owns the repository read
// and the send.

import { CommandBus } from "@org/cqrs";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { SendInvitationEmailCommand } from "@/modules/organization/commands/send-invitation-email.command.js";
import {
  InvitationIssued,
  InvitationReissued,
} from "@/modules/organization/domain/invitation/invitation.events.js";
import { DomainEventBus } from "@/platform/ddd/event-bus.js";

export const InvitationEventAdapterLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const domainEventBus = yield* DomainEventBus;
    const commandBus = yield* CommandBus;

    // Issue and re-issue both mint a fresh token and both must reach the invitee;
    // what differs is only which of the two the aggregate decided to emit.
    //
    // `orDie` costs nothing after a commit: the request has already been answered,
    // so there is no status a typed failure could still influence. Either way the
    // flush isolates it and reports it to `UnhandledFailures`.
    const send = (invitationId: InvitationIssued["invitationId"]) =>
      commandBus.execute(SendInvitationEmailCommand, { invitationId }).pipe(Effect.orDie);

    yield* domainEventBus.subscribeAfterCommit(InvitationIssued, (event) =>
      send(event.invitationId),
    );
    yield* domainEventBus.subscribeAfterCommit(InvitationReissued, (event) =>
      send(event.invitationId),
    );
  }),
);
