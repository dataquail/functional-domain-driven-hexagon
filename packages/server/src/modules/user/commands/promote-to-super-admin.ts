import * as Effect from "effect/Effect";

import {
  type PromoteToSuperAdminCommand,
  type PromoteToSuperAdminOutput,
} from "@/modules/user/commands/promote-to-super-admin-command.js";
import { RoleManagement } from "@/modules/user/domain/ports/external/role-management.js";

export const promoteToSuperAdmin = (cmd: PromoteToSuperAdminCommand): PromoteToSuperAdminOutput =>
  Effect.gen(function* () {
    const roleManagement = yield* RoleManagement;
    yield* roleManagement.grantSuperAdmin({
      userId: cmd.userId,
      actorUserId: cmd.actorUserId,
    });
  });
