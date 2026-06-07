import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { promoteToSuperAdmin } from "@/modules/user/commands/promote-to-super-admin.js";
import { PromoteToSuperAdminCommand } from "@/modules/user/commands/promote-to-super-admin-command.js";
import { SelfPromotionForbidden } from "@/modules/user/domain/ports/external/role-management.js";
import { RoleManagementFake } from "@/modules/user/infrastructure/external/role-management-fake.js";
import { UserId } from "@/platform/ids/user-id.js";

const targetId = UserId.make("11111111-1111-1111-1111-111111111111");
const actorId = UserId.make("99999999-9999-9999-9999-999999999999");
const provide = Effect.provide(RoleManagementFake);

describe("promoteToSuperAdmin", () => {
  it.effect("dispatches grantSuperAdmin via the RoleManagement port", () =>
    Effect.gen(function* () {
      yield* promoteToSuperAdmin(
        PromoteToSuperAdminCommand.make({ userId: targetId, actorUserId: actorId }),
      );
      deepStrictEqual(true, true);
    }).pipe(provide),
  );

  it.effect("surfaces SelfPromotionForbidden when actor equals target", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        promoteToSuperAdmin(
          PromoteToSuperAdminCommand.make({ userId: targetId, actorUserId: targetId }),
        ),
      );
      ok(Exit.isFailure(exit));
      if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
        ok(exit.cause.error instanceof SelfPromotionForbidden);
      }
    }).pipe(provide),
  );
});
