import { OrganizationContract } from "@org/contracts/api/Contracts";
import { CommandBus } from "@org/cqrs";
import * as Effect from "effect/Effect";

import { SoftDeleteOrganizationCommand } from "@/modules/organization/commands/soft-delete-organization.command.js";
import { OrganizationResource } from "@/modules/organization/policies/organization.policies.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

export const softDeleteEndpoint = Effect.fn("OrganizationLive.softDelete")(
  function* (request: EndpointRequest<typeof OrganizationContract.Group, "softDelete">) {
    yield* Authz.hasPermissions(OrganizationResource, Actions.Delete, request.params.id);
    const commandBus = yield* CommandBus;
    yield* commandBus.execute(SoftDeleteOrganizationCommand, { organizationId: request.params.id });
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
        // `OrganizationAlreadyDeleted` is unreachable in practice: the
        // command's active-only load filters tombstoned rows, so a double-delete
        // surfaces as `OrganizationNotFound` above. The aggregate-level
        // invariant remains as defense in depth; if it does fire, treat it
        // as a not-found at the wire (same outward effect).
        OrganizationAlreadyDeleted: (err) =>
          new OrganizationContract.OrganizationNotFoundError({
            organizationId: err.organizationId,
            message: `Organization ${err.organizationId} not found`,
          }),
      }),
      recoverPersistenceUnavailable,
    ),
);
