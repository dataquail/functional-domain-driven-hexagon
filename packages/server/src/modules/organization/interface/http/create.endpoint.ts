import { OrganizationContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

import { CreateOrganizationCommand } from "@/modules/organization/commands/create-organization-command.js";
import { CommandBus } from "@/platform/ddd/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// Authenticated, no `Authz.hasPermissions` gate. Anyone can create an
// org; the creator's relationship to the org (membership + admin
// grants) materializes in Phase 3 when the membership module exists.
export const createEndpoint = (
  request: EndpointRequest<typeof OrganizationContract.Group, "create">,
) =>
  Effect.gen(function* () {
    const commandBus = yield* CommandBus;
    const id = yield* commandBus.execute(
      CreateOrganizationCommand.make({ name: request.payload.name }),
    );
    return new OrganizationContract.CreateOrganizationResponse({ id });
  }).pipe(recoverPersistenceUnavailable, Effect.withSpan("OrganizationLive.create"));
