import { OrganizationContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { GrantOrganizationRoleCommand } from "@/modules/organization/commands/grant-organization-role.command.js";
import { OrganizationResource } from "@/modules/organization/policies/organization.policies.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// Promote a member to the `admin` OrganizationRole. Gated by the
// `update` policy (`any(SuperAdminOnly, IsOrgAdmin)`) so org admins and
// super-admins both reach it. The `CannotPromoteSelfInOrganization`
// invariant (an actor can't grant themselves) lives on the command and
// maps to 403; `AlreadyHasOrganizationRole` maps to a 409 conflict.
export const promoteMemberEndpoint = (
  request: EndpointRequest<typeof OrganizationContract.Group, "promoteMember">,
) =>
  Effect.gen(function* () {
    yield* Authz.hasPermissions(OrganizationResource, Actions.Update, request.path.orgId);
    const currentUser = yield* CurrentUser;
    const commandBus = yield* CommandBus;
    yield* commandBus.execute(
      GrantOrganizationRoleCommand.make({
        userId: request.path.userId,
        organizationId: request.path.orgId,
        role: "admin",
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
    Effect.catchTag("AlreadyHasOrganizationRole", () =>
      Effect.fail(
        new OrganizationContract.OrganizationRoleConflictError({
          reason: "already_admin",
          message: "Member is already an admin of this organization",
        }),
      ),
    ),
    Effect.catchTag("CannotPromoteSelfInOrganization", () =>
      Effect.fail(
        new CustomHttpApiError.Forbidden({
          message: "You cannot change your own role",
        }),
      ),
    ),
    recoverPersistenceUnavailable,
    Effect.withSpan("OrganizationLive.promoteMember"),
  );
