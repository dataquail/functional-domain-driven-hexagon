import { OrganizationContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { LeaveOrganizationCommand } from "@/modules/organization/commands/leave-organization.command.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// No `Authz.hasPermissions` check — leaving is a self-action and the
// membership-existence check (returns 404) is the gate. A caller who
// isn't a member gets MembershipNotFound, not a 403.
export const leaveEndpoint = Effect.fn("OrganizationLive.leave")(
  function* (request: EndpointRequest<typeof OrganizationContract.Group, "leave">) {
    const currentUser = yield* CurrentUser;
    const commandBus = yield* CommandBus;
    yield* commandBus.execute(
      LeaveOrganizationCommand.make({
        userId: currentUser.userId,
        organizationId: request.params.orgId,
      }),
    );
  },
  Effect.catchTag("MembershipNotFound", () =>
    Effect.fail(
      new OrganizationContract.MembershipNotFoundError({
        message: "You aren't a member of this organization",
      }),
    ),
  ),
  recoverPersistenceUnavailable,
);
