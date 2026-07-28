import { OrganizationContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import { CommandBus } from "@org/cqrs";
import * as Effect from "effect/Effect";

import { CreateOrganization } from "@/modules/organization/commands/create-organization.command.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// Authenticated, no `Authz.hasPermissions` gate. Anyone can create an
// org; the caller becomes its first Membership and (Phase 4) receives
// the default admin grant bundle via `MembershipCreated` /
// `OrganizationCreated` subscribers.
export const createEndpoint = Effect.fn("OrganizationLive.create")(
  function* (request: EndpointRequest<typeof OrganizationContract.Group, "create">) {
    const currentUser = yield* CurrentUser;
    const commandBus = yield* CommandBus;
    const id = yield* commandBus.execute(CreateOrganization, {
      name: request.payload.name,
      actorUserId: currentUser.userId,
    });
    return new OrganizationContract.CreateOrganizationResponse({ id });
  },
  Effect.catchTag("SuperAdminCannotOwnOrganization", () =>
    Effect.fail(
      new OrganizationContract.SuperAdminCannotOwnOrganizationError({
        message: "Super-admins don't own organizations.",
      }),
    ),
  ),
  recoverPersistenceUnavailable,
);
