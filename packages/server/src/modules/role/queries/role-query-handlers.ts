import { findUserRoles } from "@/modules/role/queries/find-user-roles.js";
import { findUserRolesQuerySpanAttributes } from "@/modules/role/queries/find-user-roles-query.js";
import { queryHandlers } from "@/platform/ddd/query-bus.js";

export const roleQueryHandlers = queryHandlers({
  FindUserRolesQuery: {
    handle: findUserRoles,
    spanAttributes: findUserRolesQuerySpanAttributes,
  },
});
