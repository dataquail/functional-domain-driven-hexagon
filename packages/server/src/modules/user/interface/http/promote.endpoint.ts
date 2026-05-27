import { UserContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";

import { RoleManagement } from "@/modules/user/domain/ports/external/role-management.js";
import { UserResource } from "@/modules/user/policies/user-policies.js";
import { Actions } from "@/platform/auth/actions.js";
import * as Authz from "@/platform/auth/authz.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

// `/users/:id/super-admin` lives in the user module because the URL is
// user-shaped, but the write belongs to the role module. It goes through
// the `RoleManagement` outbound port (ADR-0023) — the role module's
// command and error types stay in `infrastructure/external/`, never here.
export const promoteEndpoint = (
  request: EndpointRequest<typeof UserContract.Group, "promoteToSuperAdmin">,
) =>
  Effect.gen(function* () {
    yield* Authz.hasPermissions(UserResource, Actions.Update, request.path.id);
    const currentUser = yield* CurrentUser;
    const roleManagement = yield* RoleManagement;
    // The port is idempotent — already holding the role is a success — so
    // the endpoint no longer absorbs an "already has role" case here.
    yield* roleManagement.grantSuperAdmin({
      userId: request.path.id,
      actorUserId: currentUser.userId,
    });
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
