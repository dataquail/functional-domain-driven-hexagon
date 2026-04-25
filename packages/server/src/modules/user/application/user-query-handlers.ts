import { findUsers } from "@/modules/user/application/queries/find-users.js";
import { type QueryHandlers } from "@/platform/query-bus.js";

export const userQueryHandlers: QueryHandlers<"FindUsersQuery"> = {
  FindUsersQuery: findUsers,
};
