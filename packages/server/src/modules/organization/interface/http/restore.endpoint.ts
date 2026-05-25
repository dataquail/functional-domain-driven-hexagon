import { OrganizationContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

import { RestoreOrganizationCommand } from "@/modules/organization/commands/restore-organization-command.js";
import { OrganizationResource } from "@/modules/organization/policies/organization-policies.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { CommandBus } from "@/platform/ddd/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

export const restoreEndpoint = (
  request: EndpointRequest<typeof OrganizationContract.Group, "restore">,
) =>
  Effect.gen(function* () {
    yield* Authz.hasPermissions(OrganizationResource, Actions.Update, request.path.id);
    const commandBus = yield* CommandBus;
    yield* commandBus.execute(RestoreOrganizationCommand.make({ organizationId: request.path.id }));
  }).pipe(
    Effect.catchTag("NotFound", () =>
      Effect.fail(
        new OrganizationContract.OrganizationNotFoundError({
          organizationId: request.path.id,
          message: `Organization ${request.path.id} not found`,
        }),
      ),
    ),
    Effect.catchTag("OrganizationNotFound", (err) =>
      Effect.fail(
        new OrganizationContract.OrganizationNotFoundError({
          organizationId: err.organizationId,
          message: `Organization ${err.organizationId} not found`,
        }),
      ),
    ),
    // Restoring a non-deleted org is a state-conflict, not a not-found.
    Effect.catchTag("OrganizationNotDeleted", (err) =>
      Effect.fail(
        new OrganizationContract.OrganizationNotDeletedError({
          organizationId: err.organizationId,
          message: `Organization ${err.organizationId} is not deleted; nothing to restore`,
        }),
      ),
    ),
    recoverPersistenceUnavailable,
    Effect.withSpan("OrganizationLive.restore"),
  );
