import { OrganizationContract } from "@org/contracts/api/Contracts";
import { CommandBus } from "@org/cqrs";
import * as Effect from "effect/Effect";

import { RevokeOrganizationRole } from "@/modules/organization/commands/revoke-organization-role.command.js";
import { OrganizationResource } from "@/modules/organization/policies/organization.policies.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// Demote a member from the `admin` OrganizationRole. Gated by the
// `update` policy (`any(SuperAdminOnly, IsOrgAdmin)`). Demoting the
// last admin is allowed by design (the org-admin invariant was dropped
// — a super-admin restores access if an org becomes admin-less), so
// there's no last-admin guard. `DoesNotHaveOrganizationRole` maps to a
// 409 conflict.
export const demoteMemberEndpoint = (
  request: EndpointRequest<typeof OrganizationContract.Group, "demoteMember">,
) =>
  Effect.gen(function* () {
    yield* Authz.hasPermissions(OrganizationResource, Actions.Update, request.params.orgId);
    const commandBus = yield* CommandBus;
    yield* commandBus.execute(RevokeOrganizationRole, {
      userId: request.params.userId,
      organizationId: request.params.orgId,
      role: "admin",
    });
  }).pipe(
    Effect.catchTag("NotFound", () =>
      Effect.fail(
        new OrganizationContract.OrganizationNotFoundError({
          organizationId: request.params.orgId,
          message: `Organization ${request.params.orgId} not found`,
        }),
      ),
    ),
    Effect.catchTag("DoesNotHaveOrganizationRole", () =>
      Effect.fail(
        new OrganizationContract.OrganizationRoleConflictError({
          reason: "not_admin",
          message: "Member is not an admin of this organization",
        }),
      ),
    ),
    recoverPersistenceUnavailable,
    Effect.withSpan("OrganizationLive.demoteMember"),
  );
