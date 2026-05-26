import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import {
  RoleManagement,
  type RoleManagementShape,
  SelfPromotionForbidden,
} from "@/modules/user/domain/ports/external/role-management.js";
import { type UserId } from "@/platform/ids/user-id.js";

// In-memory `RoleManagement` for use-case unit tests. Models the port's
// observable contract — idempotent grant/revoke, self-promotion guard —
// without standing up the role module or the command bus. Lets user-side
// tests assert behavior against a focused double instead of faking the
// whole typed bus.
export const RoleManagementFake = Layer.effect(
  RoleManagement,
  Effect.gen(function* () {
    const superAdmins = yield* Ref.make(HashSet.empty<UserId>());

    const grantSuperAdmin: RoleManagementShape["grantSuperAdmin"] = ({ actorUserId, userId }) =>
      userId === actorUserId
        ? Effect.fail(new SelfPromotionForbidden({ userId }))
        : Ref.update(superAdmins, HashSet.add(userId));

    const revokeSuperAdmin: RoleManagementShape["revokeSuperAdmin"] = ({ userId }) =>
      Ref.update(superAdmins, HashSet.remove(userId));

    return RoleManagement.of({ grantSuperAdmin, revokeSuperAdmin });
  }),
);
