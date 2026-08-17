import { CommandBus } from "@effect-server-utils/cqrs";
import { OrganizationContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { RevokeInvitationCommand } from "@/modules/organization/commands/revoke-invitation.command.js";
import { OrganizationResource } from "@/modules/organization/policies/organization.policies.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

export const revokeInvitationEndpoint = Effect.fn("OrganizationLive.revokeInvitation")(
  function* (request: EndpointRequest<typeof OrganizationContract.Group, "revokeInvitation">) {
    yield* Authz.hasPermissions(OrganizationResource, Actions.Update, request.params.orgId);
    const currentUser = yield* CurrentUser;
    const commandBus = yield* CommandBus;
    yield* commandBus.execute(RevokeInvitationCommand, {
      invitationId: request.params.invitationId,
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
            message: "Invitation already accepted; use removeMember to undo.",
          }),
        InvitationAlreadyRevoked: () =>
          new OrganizationContract.InvitationGoneError({
            reason: "revoked",
            message: "Invitation already revoked.",
          }),
      }),
      recoverPersistenceUnavailable,
    ),
);
