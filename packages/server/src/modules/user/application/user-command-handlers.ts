import { changeUserRole } from "@/modules/user/application/commands/change-user-role.js";
import { createUser } from "@/modules/user/application/commands/create-user.js";
import { deleteUser } from "@/modules/user/application/commands/delete-user.js";
import { type CommandHandlers } from "@/platform/command-bus.js";

export const userCommandHandlers: CommandHandlers<
  "CreateUserCommand" | "DeleteUserCommand" | "ChangeUserRoleCommand"
> = {
  CreateUserCommand: createUser,
  DeleteUserCommand: deleteUser,
  ChangeUserRoleCommand: changeUserRole,
};
