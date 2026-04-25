import { findUsers } from "@/modules/user/application/queries/find-users.js";

export const userQueryHandlers = {
  FindUsersQuery: findUsers,
} as const;
