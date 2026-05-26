import { findAllOrganizations } from "@/modules/organization/queries/find-all-organizations.js";
import { findAllOrganizationsQuerySpanAttributes } from "@/modules/organization/queries/find-all-organizations-query.js";
import { queryHandlers } from "@/platform/ddd/query-bus.js";

// `FindAllOrganizationsQuery` reads SQL directly (no OrganizationRepository
// in R) so the handler doesn't need wrapping. Lives at module root for
// symmetry with `organization-command-handlers.ts`.
export const organizationQueryHandlers = queryHandlers({
  FindAllOrganizationsQuery: {
    handle: findAllOrganizations,
    spanAttributes: findAllOrganizationsQuerySpanAttributes,
  },
});
