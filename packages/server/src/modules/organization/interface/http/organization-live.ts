import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder";

import { Api } from "@/api.js";
import { createEndpoint } from "@/modules/organization/interface/http/create.endpoint.js";
import { findAllEndpoint } from "@/modules/organization/interface/http/find-all.endpoint.js";
import { restoreEndpoint } from "@/modules/organization/interface/http/restore.endpoint.js";
import { softDeleteEndpoint } from "@/modules/organization/interface/http/soft-delete.endpoint.js";

// User-facing org operations: create-your-own + super-admin
// soft-delete/restore. Membership-scoped read endpoints land in
// Phase 3 once `MembershipService` exists.
export const OrganizationLive = HttpApiBuilder.group(Api, "organization", (handlers) =>
  handlers
    .handle("create", createEndpoint)
    .handle("softDelete", softDeleteEndpoint)
    .handle("restore", restoreEndpoint),
);

// Admin browse of every org. Gated by `Authz.hasPermissions(OrganizationResource, Actions.Read)`
// inside the endpoint, so non-super-admins get 403 before any query
// dispatches.
export const OrganizationAdminLive = HttpApiBuilder.group(Api, "organizationAdmin", (handlers) =>
  handlers.handle("findAll", findAllEndpoint),
);
