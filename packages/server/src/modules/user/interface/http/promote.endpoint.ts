import { UserContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { GrantRoleCommand } from "@/modules/role/index.js";
import { UserResource } from "@/modules/user/policies/user-policies.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { CommandBus } from "@/platform/ddd/command-bus.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// `/users/:id/super-admin` lives in the user module because the URL is
// user-shaped, but the write goes to the role module via the command
// bus — keeping the role module's domain types out of this endpoint.
export const promoteEndpoint = (
  request: EndpointRequest<typeof UserContract.Group, "promoteToSuperAdmin">,
) =>
  Effect.gen(function* () {
    yield* Authz.hasPermissions(UserResource, Actions.Update, request.path.id);
    const currentUser = yield* CurrentUser;
    const commandBus = yield* CommandBus;
    yield* commandBus.execute(
      GrantRoleCommand.make({
        userId: request.path.id,
        role: "super_admin",
        actorUserId: currentUser.userId,
      }),
    );
  }).pipe(
    Effect.catchTag("NotFound", () =>
      Effect.fail(
        new UserContract.UserNotFoundError({
          userId: request.path.id,
          message: `User ${request.path.id} not found`,
        }),
      ),
    ),
    // Domain rule — surface the self-promotion guard as a 403 via the
    // group's Forbidden channel. Same status as the policy denial, but
    // a distinct message so callers can tell *why* they were refused.
    Effect.catchTag("CannotPromoteSelf", () =>
      Effect.fail(
        new CustomHttpApiError.Forbidden({
          message: "A user cannot promote themselves to super admin.",
        }),
      ),
    ),
    // Idempotency: if the user already holds the role, the aggregate
    // surfaces AlreadyHasRole. Treat it as success — the desired state
    // is "user is super admin", which it already is.
    Effect.catchTag("AlreadyHasRole", () => Effect.void),
    recoverPersistenceUnavailable,
    Effect.withSpan("UserLive.promoteToSuperAdmin"),
  );
