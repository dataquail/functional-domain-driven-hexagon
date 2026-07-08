import { OrganizationContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

import { OrganizationResource } from "@/modules/organization/policies/organization.policies.js";
import { FindPendingInvitationsQuery } from "@/modules/organization/queries/find-pending-invitations.query.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { QueryBus } from "@/platform/ddd/ports/query-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// Org admins + super-admins (the `update` policy's OR chain). Lists the
// org's open invitations (pending + expired) for the member-management
// surface's "Pending invitations" section. Thin dispatch — the status
// derivation lives in the query handler.
export const findInvitationsEndpoint = (
  request: EndpointRequest<typeof OrganizationContract.Group, "findInvitations">,
) =>
  Effect.gen(function* () {
    yield* Authz.hasPermissions(OrganizationResource, Actions.Update, request.params.orgId).pipe(
      Effect.catchTag("NotFound", () =>
        Effect.fail(
          new OrganizationContract.OrganizationNotFoundError({
            organizationId: request.params.orgId,
            message: `Organization ${request.params.orgId} not found`,
          }),
        ),
      ),
    );

    const queryBus = yield* QueryBus;
    const invitations = yield* queryBus.execute(
      FindPendingInvitationsQuery.make({ organizationId: request.params.orgId }),
    );

    return new OrganizationContract.PendingInvitationsResponse({
      invitations: invitations.map(
        (invitation) =>
          new OrganizationContract.PendingInvitation({
            invitationId: invitation.invitationId,
            inviteeEmail: invitation.inviteeEmail,
            status: invitation.status,
            expiresAt: invitation.expiresAt,
            createdAt: invitation.createdAt,
          }),
      ),
    });
  }).pipe(recoverPersistenceUnavailable, Effect.withSpan("OrganizationLive.findInvitations"));
