import { OrganizationContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { CreateOrganizationCommand } from "@/modules/organization/commands/create-organization-command.js";
import { CommandBus } from "@/platform/ddd/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// Authenticated, no `Authz.hasPermissions` gate. Anyone can create an
// org; the caller becomes its first Membership and (Phase 4) receives
// the default admin grant bundle via `MembershipCreated` /
// `OrganizationCreated` subscribers.
export const createEndpoint = (
  request: EndpointRequest<typeof OrganizationContract.Group, "create">,
) =>
  Effect.gen(function* () {
    const currentUser = yield* CurrentUser;
    const commandBus = yield* CommandBus;
    const id = yield* commandBus.execute(
      CreateOrganizationCommand.make({
        name: request.payload.name,
        actorUserId: currentUser.userId,
      }),
    );
    return new OrganizationContract.CreateOrganizationResponse({ id });
  }).pipe(recoverPersistenceUnavailable, Effect.withSpan("OrganizationLive.create"));
