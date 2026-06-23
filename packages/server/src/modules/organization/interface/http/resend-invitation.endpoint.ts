import { OrganizationContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { ResendInvitationCommand } from "@/modules/organization/commands/resend-invitation-command.js";
import { OrganizationResource } from "@/modules/organization/policies/organization-policies.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// Default invitation lifetime — 7 days, same as a fresh invite (the TTL
// is a UX decision, kept at the endpoint, not the command).
const DEFAULT_INVITATION_TTL_SECONDS = 60 * 60 * 24 * 7;

export const resendInvitationEndpoint = (
  request: EndpointRequest<typeof OrganizationContract.Group, "resendInvitation">,
) =>
  Effect.gen(function* () {
    yield* Authz.hasPermissions(OrganizationResource, Actions.Update, request.path.orgId);
    const currentUser = yield* CurrentUser;
    const commandBus = yield* CommandBus;
    yield* commandBus.execute(
      ResendInvitationCommand.make({
        invitationId: request.path.invitationId,
        ttlSeconds: DEFAULT_INVITATION_TTL_SECONDS,
        actorUserId: currentUser.userId,
      }),
    );
  }).pipe(
    Effect.catchTag("NotFound", () =>
      Effect.fail(
        new OrganizationContract.OrganizationNotFoundError({
          organizationId: request.path.orgId,
          message: `Organization ${request.path.orgId} not found`,
        }),
      ),
    ),
    Effect.catchTag("InvitationNotFound", () =>
      Effect.fail(
        new OrganizationContract.InvitationNotFoundError({ message: "Invitation not found" }),
      ),
    ),
    Effect.catchTag("InvitationAlreadyAccepted", () =>
      Effect.fail(
        new OrganizationContract.InvitationGoneError({
          reason: "accepted",
          message: "Invitation already accepted; nothing to resend.",
        }),
      ),
    ),
    Effect.catchTag("InvitationAlreadyRevoked", () =>
      Effect.fail(
        new OrganizationContract.InvitationGoneError({
          reason: "revoked",
          message: "Invitation was revoked; issue a new invite instead.",
        }),
      ),
    ),
    recoverPersistenceUnavailable,
    Effect.withSpan("OrganizationLive.resendInvitation"),
  );
