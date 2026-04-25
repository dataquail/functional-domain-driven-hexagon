import { findUsers } from "@/modules/user/application/queries/find-users.js";
import { queryHandlers } from "@/platform/query-bus.js";

export const userQueryHandlers = queryHandlers({
  FindUsersQuery: findUsers,
});
