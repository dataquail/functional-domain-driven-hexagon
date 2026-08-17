import { CommandBus } from "@effect-server-utils/cqrs";
import { OrganizationContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { ResendInvitationCommand } from "@/modules/organization/commands/resend-invitation.command.js";
import { OrganizationResource } from "@/modules/organization/policies/organization.policies.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// Default invitation lifetime — 7 days, same as a fresh invite (the TTL
// is a UX decision, kept at the endpoint, not the command).
const DEFAULT_INVITATION_TTL_SECONDS = 60 * 60 * 24 * 7;

export const resendInvitationEndpoint = Effect.fn("OrganizationLive.resendInvitation")(
  function* (request: EndpointRequest<typeof OrganizationContract.Group, "resendInvitation">) {
    yield* Authz.hasPermissions(OrganizationResource, Actions.Update, request.params.orgId);
    const currentUser = yield* CurrentUser;
    const commandBus = yield* CommandBus;
    yield* commandBus.execute(ResendInvitationCommand, {
      invitationId: request.params.invitationId,
      ttlSeconds: DEFAULT_INVITATION_TTL_SECONDS,
      actorUserId: currentUser.userId,
    });
  },
  (effect, request) =>
    effect.pipe(
      Effect.catchTags({
        NotFound: () =>
          new OrganizationContract.OrganizationNotFoundError({
            organizationId: request.params.orgId,
            message: `Organization ${request.params.orgId} not found`,
          }),
        InvitationNotFound: () =>
          new OrganizationContract.InvitationNotFoundError({ message: "Invitation not found" }),
        InvitationAlreadyAccepted: () =>
          new OrganizationContract.InvitationGoneError({
            reason: "accepted",
            message: "Invitation already accepted; nothing to resend.",
          }),
        InvitationAlreadyRevoked: () =>
          new OrganizationContract.InvitationGoneError({
            reason: "revoked",
            message: "Invitation was revoked; issue a new invite instead.",
          }),
      }),
      recoverPersistenceUnavailable,
    ),
);
