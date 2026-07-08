import { OrganizationContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { AcceptInvitationCommand } from "@/modules/organization/commands/accept-invitation.command.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// Sits in the standalone InvitationGroup (`/api/invitations/:token/accept`)
// because the caller doesn't have a membership yet and the URL is
// token-shaped. Authenticated (the resulting Membership row is keyed to
// CurrentUser.userId) but with no `Authz.hasPermissions` check — the
// token itself is the authorization.
export const acceptInvitationEndpoint = (
  request: EndpointRequest<typeof OrganizationContract.InvitationGroup, "accept">,
) =>
  Effect.gen(function* () {
    const currentUser = yield* CurrentUser;
    const commandBus = yield* CommandBus;
    const organizationId = yield* commandBus.execute(
      AcceptInvitationCommand.make({
        token: request.params.token,
        userId: currentUser.userId,
      }),
    );
    return new OrganizationContract.AcceptInvitationResponse({ organizationId });
  }).pipe(
    Effect.catchTag("InvitationTokenNotFound", () =>
      Effect.fail(
        new OrganizationContract.InvitationNotFoundError({ message: "Invitation not found" }),
      ),
    ),
    Effect.catchTag("InvitationAlreadyAccepted", () =>
      Effect.fail(
        new OrganizationContract.InvitationGoneError({
          reason: "accepted",
          message: "This invitation has already been accepted.",
        }),
      ),
    ),
    Effect.catchTag("InvitationRevoked", () =>
      Effect.fail(
        new OrganizationContract.InvitationGoneError({
          reason: "revoked",
          message: "This invitation has been revoked.",
        }),
      ),
    ),
    Effect.catchTag("InvitationExpired", () =>
      Effect.fail(
        new OrganizationContract.InvitationGoneError({
          reason: "expired",
          message: "This invitation has expired.",
        }),
      ),
    ),
    Effect.catchTag("SuperAdminCannotOwnOrganization", () =>
      Effect.fail(
        new OrganizationContract.SuperAdminCannotOwnOrganizationError({
          message: "Super-admins don't join organizations.",
        }),
      ),
    ),
    recoverPersistenceUnavailable,
    Effect.withSpan("OrganizationLive.acceptInvitation"),
  );
