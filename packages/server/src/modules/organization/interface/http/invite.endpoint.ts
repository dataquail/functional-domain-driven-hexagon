import { OrganizationContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { InviteUserCommand } from "@/modules/organization/commands/invite-user-command.js";
import { OrganizationResource } from "@/modules/organization/policies/organization-policies.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { CommandBus } from "@/platform/ddd/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// Default invitation lifetime — 7 days. Lives at the endpoint
// (rather than the command) because it's a UX/policy decision, not a
// domain invariant; the command takes the TTL as input so a future
// "extended invite" flow can pick a longer value without forking the
// handler.
const DEFAULT_INVITATION_TTL_SECONDS = 60 * 60 * 24 * 7;

export const inviteEndpoint = (
  request: EndpointRequest<typeof OrganizationContract.Group, "inviteUser">,
) =>
  Effect.gen(function* () {
    yield* Authz.hasPermissions(OrganizationResource, Actions.Update, request.path.orgId);
    const currentUser = yield* CurrentUser;
    const commandBus = yield* CommandBus;
    const invitationId = yield* commandBus.execute(
      InviteUserCommand.make({
        organizationId: request.path.orgId,
        inviteeEmail: request.payload.email,
        ttlSeconds: DEFAULT_INVITATION_TTL_SECONDS,
        actorUserId: currentUser.userId,
      }),
    );
    return new OrganizationContract.InviteUserResponse({ invitationId });
  }).pipe(
    Effect.catchTag("NotFound", () =>
      Effect.fail(
        new OrganizationContract.OrganizationNotFoundError({
          organizationId: request.path.orgId,
          message: `Organization ${request.path.orgId} not found`,
        }),
      ),
    ),
    recoverPersistenceUnavailable,
    Effect.withSpan("OrganizationLive.inviteUser"),
  );
