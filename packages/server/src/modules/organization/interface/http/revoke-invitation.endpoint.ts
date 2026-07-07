import { OrganizationContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { RevokeInvitationCommand } from "@/modules/organization/commands/revoke-invitation.command.js";
import { OrganizationResource } from "@/modules/organization/policies/organization.policies.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

export const revokeInvitationEndpoint = (
  request: EndpointRequest<typeof OrganizationContract.Group, "revokeInvitation">,
) =>
  Effect.gen(function* () {
    yield* Authz.hasPermissions(OrganizationResource, Actions.Update, request.path.orgId);
    const currentUser = yield* CurrentUser;
    const commandBus = yield* CommandBus;
    yield* commandBus.execute(
      RevokeInvitationCommand.make({
        invitationId: request.path.invitationId,
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
          message: "Invitation already accepted; use removeMember to undo.",
        }),
      ),
    ),
    Effect.catchTag("InvitationAlreadyRevoked", () =>
      Effect.fail(
        new OrganizationContract.InvitationGoneError({
          reason: "revoked",
          message: "Invitation already revoked.",
        }),
      ),
    ),
    recoverPersistenceUnavailable,
    Effect.withSpan("OrganizationLive.revokeInvitation"),
  );
