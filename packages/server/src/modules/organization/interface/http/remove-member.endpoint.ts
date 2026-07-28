import { OrganizationContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import { CommandBus } from "@org/cqrs";
import * as Effect from "effect/Effect";

import { RemoveMemberCommand } from "@/modules/organization/commands/remove-member.command.js";
import { OrganizationResource } from "@/modules/organization/policies/organization.policies.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

export const removeMemberEndpoint = (
  request: EndpointRequest<typeof OrganizationContract.Group, "removeMember">,
) =>
  Effect.gen(function* () {
    yield* Authz.hasPermissions(OrganizationResource, Actions.Update, request.params.orgId);
    const currentUser = yield* CurrentUser;
    const commandBus = yield* CommandBus;
    yield* commandBus.execute(RemoveMemberCommand, {
      targetUserId: request.params.userId,
      organizationId: request.params.orgId,
      actorUserId: currentUser.userId,
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
    Effect.catchTag("MembershipNotFound", () =>
      Effect.fail(
        new OrganizationContract.MembershipNotFoundError({ message: "Member not found in org" }),
      ),
    ),
    recoverPersistenceUnavailable,
    Effect.withSpan("OrganizationLive.removeMember"),
  );
