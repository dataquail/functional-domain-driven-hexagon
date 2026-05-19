import { createUser } from "@/modules/user/commands/create-user.js";
import { createUserCommandSpanAttributes } from "@/modules/user/commands/create-user-command.js";
import { deleteUser } from "@/modules/user/commands/delete-user.js";
import { deleteUserCommandSpanAttributes } from "@/modules/user/commands/delete-user-command.js";
import { demoteFromSuperAdmin } from "@/modules/user/commands/demote-from-super-admin.js";
import { demoteFromSuperAdminCommandSpanAttributes } from "@/modules/user/commands/demote-from-super-admin-command.js";
import { promoteToSuperAdmin } from "@/modules/user/commands/promote-to-super-admin.js";
import { promoteToSuperAdminCommandSpanAttributes } from "@/modules/user/commands/promote-to-super-admin-command.js";
import { commandHandlers } from "@/platform/ddd/command-bus.js";

export const userCommandHandlers = commandHandlers({
  CreateUserCommand: { handle: createUser, spanAttributes: createUserCommandSpanAttributes },
  DeleteUserCommand: { handle: deleteUser, spanAttributes: deleteUserCommandSpanAttributes },
  PromoteToSuperAdminCommand: {
    handle: promoteToSuperAdmin,
    spanAttributes: promoteToSuperAdminCommandSpanAttributes,
  },
  DemoteFromSuperAdminCommand: {
    handle: demoteFromSuperAdmin,
    spanAttributes: demoteFromSuperAdminCommandSpanAttributes,
  },
});
