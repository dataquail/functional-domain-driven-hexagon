import { OrganizationContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

import { SoftDeleteOrganizationCommand } from "@/modules/organization/commands/soft-delete-organization.command.js";
import { OrganizationResource } from "@/modules/organization/policies/organization.policies.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

export const softDeleteEndpoint = (
  request: EndpointRequest<typeof OrganizationContract.Group, "softDelete">,
) =>
  Effect.gen(function* () {
    yield* Authz.hasPermissions(OrganizationResource, Actions.Delete, request.params.id);
    const commandBus = yield* CommandBus;
    yield* commandBus.execute(
      SoftDeleteOrganizationCommand.make({ organizationId: request.params.id }),
    );
  }).pipe(
    Effect.catchTag("NotFound", () =>
      Effect.fail(
        new OrganizationContract.OrganizationNotFoundError({
          organizationId: request.params.id,
          message: `Organization ${request.params.id} not found`,
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
    // `OrganizationAlreadyDeleted` is unreachable in practice: the
    // command's active-only load filters tombstoned rows, so a double-delete
    // surfaces as `OrganizationNotFound` above. The aggregate-level
    // invariant remains as defense in depth; if it does fire, treat it
    // as a not-found at the wire (same outward effect).
    Effect.catchTag("OrganizationAlreadyDeleted", (err) =>
      Effect.fail(
        new OrganizationContract.OrganizationNotFoundError({
          organizationId: err.organizationId,
          message: `Organization ${err.organizationId} not found`,
        }),
      ),
    ),
    recoverPersistenceUnavailable,
    Effect.withSpan("OrganizationLive.softDelete"),
  );
