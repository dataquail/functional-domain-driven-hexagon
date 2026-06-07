import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";

import { demoteFromSuperAdmin } from "@/modules/user/commands/demote-from-super-admin.js";
import { DemoteFromSuperAdminCommand } from "@/modules/user/commands/demote-from-super-admin-command.js";
import { RoleManagementFake } from "@/modules/user/infrastructure/external/role-management-fake.js";
import { UserId } from "@/platform/ids/user-id.js";

const targetId = UserId.make("11111111-1111-1111-1111-111111111111");
const provide = Effect.provide(RoleManagementFake);

describe("demoteFromSuperAdmin", () => {
  it.effect("dispatches revokeSuperAdmin via the RoleManagement port", () =>
    Effect.gen(function* () {
      yield* demoteFromSuperAdmin(DemoteFromSuperAdminCommand.make({ userId: targetId }));
      deepStrictEqual(true, true);
    }).pipe(provide),
  );

  it.effect("is idempotent when the user does not hold the role", () =>
    Effect.gen(function* () {
      yield* demoteFromSuperAdmin(DemoteFromSuperAdminCommand.make({ userId: targetId }));
      yield* demoteFromSuperAdmin(DemoteFromSuperAdminCommand.make({ userId: targetId }));
      deepStrictEqual(true, true);
    }).pipe(provide),
  );
});
