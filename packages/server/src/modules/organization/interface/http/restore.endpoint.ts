import { CommandBus } from "@effect-server-utils/cqrs";
import { OrganizationContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

import { RestoreOrganizationCommand } from "@/modules/organization/commands/restore-organization.command.js";
import { OrganizationResource } from "@/modules/organization/policies/organization.policies.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

export const restoreEndpoint = Effect.fn("OrganizationLive.restore")(
  function* (request: EndpointRequest<typeof OrganizationContract.Group, "restore">) {
    yield* Authz.hasPermissions(OrganizationResource, Actions.Update, request.params.id);
    const commandBus = yield* CommandBus;
    yield* commandBus.execute(RestoreOrganizationCommand, { organizationId: request.params.id });
  },
  (effect, request) =>
    effect.pipe(
      Effect.catchTags({
        NotFound: () =>
          new OrganizationContract.OrganizationNotFoundError({
            organizationId: request.params.id,
            message: `Organization ${request.params.id} not found`,
          }),
        OrganizationNotFound: (err) =>
          new OrganizationContract.OrganizationNotFoundError({
            organizationId: err.organizationId,
            message: `Organization ${err.organizationId} not found`,
          }),
        // Restoring a non-deleted org is a state-conflict, not a not-found.
        OrganizationNotDeleted: (err) =>
          new OrganizationContract.OrganizationNotDeletedError({
            organizationId: err.organizationId,
            message: `Organization ${err.organizationId} is not deleted; nothing to restore`,
          }),
      }),
      recoverPersistenceUnavailable,
    ),
);
