import { changeUserRoleCommandSpanAttributes } from "@/modules/user/commands/change-user-role-command.js";
import { changeUserRole } from "@/modules/user/commands/change-user-role.js";
import { createUserCommandSpanAttributes } from "@/modules/user/commands/create-user-command.js";
import { createUser } from "@/modules/user/commands/create-user.js";
import { deleteUserCommandSpanAttributes } from "@/modules/user/commands/delete-user-command.js";
import { deleteUser } from "@/modules/user/commands/delete-user.js";
import { commandHandlers } from "@/platform/command-bus.js";

export const userCommandHandlers = commandHandlers({
  CreateUserCommand: { handle: createUser, spanAttributes: createUserCommandSpanAttributes },
  DeleteUserCommand: { handle: deleteUser, spanAttributes: deleteUserCommandSpanAttributes },
  ChangeUserRoleCommand: {
    handle: changeUserRole,
    spanAttributes: changeUserRoleCommandSpanAttributes,
  },
});
