import * as Effect from "effect/Effect";

import {
  type DemoteFromSuperAdminCommand,
  type DemoteFromSuperAdminOutput,
} from "@/modules/user/commands/demote-from-super-admin-command.js";
import { RoleManagement } from "@/modules/user/domain/ports/external/role-management.js";

export const demoteFromSuperAdmin = (
  cmd: DemoteFromSuperAdminCommand,
): DemoteFromSuperAdminOutput =>
  Effect.gen(function* () {
    const roleManagement = yield* RoleManagement;
    yield* roleManagement.revokeSuperAdmin({ userId: cmd.userId });
  });
