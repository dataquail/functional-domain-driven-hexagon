import { changeUserRole } from "@/modules/user/application/commands/change-user-role.js";
import { createUser } from "@/modules/user/application/commands/create-user.js";
import { deleteUser } from "@/modules/user/application/commands/delete-user.js";
import { commandHandlers } from "@/platform/command-bus.js";

export const userCommandHandlers = commandHandlers({
  CreateUserCommand: createUser,
  DeleteUserCommand: deleteUser,
  ChangeUserRoleCommand: changeUserRole,
});
