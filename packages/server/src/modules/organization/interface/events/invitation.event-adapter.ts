// Inbound event adapter (ADR-0007) for this module's own invitation events. It
// subscribes after commit, so the email is only ever sent for an invitation that
// actually exists: the accept link would otherwise be live for a row a rollback
// took away.
//
// It is also why a mail-server outage can no longer fail an invite: the reaction
// is written to the outbox with the invitation and delivered after commit, so a
// failed send leaves its row for the sweeper rather than failing the caller.
//
// Bus-only, like every adapter: the dispatched command owns the repository read
// and the send.

import { CommandBus } from "@effect-server-utils/cqrs";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { DomainEventBus } from "@/globals/application/ports/event-bus.js";
import { SendInvitationEmailCommand } from "@/modules/organization/commands/send-invitation-email.command.js";
import {
  InvitationIssued,
  InvitationReissued,
} from "@/modules/organization/domain/invitation/invitation.events.js";

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

    // The name addresses this reaction's outbox rows and delivery-ledger entries,
    // so renaming it strands any envelope still in flight.
    const subscription = { name: "organization.sendInvitationEmail" };
    yield* domainEventBus.subscribeAfterCommit(
      InvitationIssued,
      (event) => send(event.invitationId),
      subscription,
    );
    yield* domainEventBus.subscribeAfterCommit(
      InvitationReissued,
      (event) => send(event.invitationId),
      subscription,
    );
  }),
);
