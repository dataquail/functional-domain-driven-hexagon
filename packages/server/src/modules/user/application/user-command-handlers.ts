import { changeUserRole } from "@/modules/user/application/commands/change-user-role.js";
import { createUser } from "@/modules/user/application/commands/create-user.js";
import { deleteUser } from "@/modules/user/application/commands/delete-user.js";

export const userCommandHandlers = {
  CreateUserCommand: createUser,
  DeleteUserCommand: deleteUser,
  ChangeUserRoleCommand: changeUserRole,
} as const;
