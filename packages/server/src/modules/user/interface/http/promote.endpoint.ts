import { UserContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { PromoteToSuperAdminCommand } from "@/modules/user/commands/promote-to-super-admin-command.js";
import { UserResource } from "@/modules/user/policies/user-policies.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// `/users/:id/super-admin` lives in the user module because the URL is
// user-shaped, but the write belongs to the role module. The dispatch
// goes through `PromoteToSuperAdminCommand`; that command's handler
// calls the user-owned `RoleManagement` port (ADR-0023), and the
// port's outbound adapter is the one place the role module's command
// + error vocabulary appears.
export const promoteEndpoint = (
  request: EndpointRequest<typeof UserContract.Group, "promoteToSuperAdmin">,
) =>
  Effect.gen(function* () {
    yield* Authz.hasPermissions(UserResource, Actions.Update, request.path.id);
    const currentUser = yield* CurrentUser;
    const commandBus = yield* CommandBus;
    yield* commandBus.execute(
      PromoteToSuperAdminCommand.make({
        userId: request.path.id,
        actorUserId: currentUser.userId,
      }),
    );
  }).pipe(
    // `NotFound` originates in the authorization resource resolution, not
    // the role write.
    Effect.catchTag("NotFound", () =>
      Effect.fail(
        new UserContract.UserNotFoundError({
          userId: request.path.id,
          message: `User ${request.path.id} not found`,
        }),
      ),
    ),
    // Surface the self-promotion guard as a 403 via the group's Forbidden
    // channel. The port maps the role module's invariant into this
    // user-owned error, so the endpoint catches its own vocabulary.
    Effect.catchTag("SelfPromotionForbidden", () =>
      Effect.fail(
        new CustomHttpApiError.Forbidden({
          message: "A user cannot promote themselves to super admin.",
        }),
      ),
    ),
    recoverPersistenceUnavailable,
    Effect.withSpan("UserLive.promoteToSuperAdmin"),
  );
