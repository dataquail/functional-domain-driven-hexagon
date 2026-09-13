import * as Layer from "effect/Layer";

import { roleLayer } from "@/modules/role/role.exports.js";
import { userLayer } from "@/modules/user/user.exports.js";

import { OrganizationRepositoryLive } from "./infrastructure/repositories/organization.repository-live.js";
import { OrgCliLive } from "./interface/cli/index.js";
import { InvitationEventAdapterLive } from "./interface/events/invitation.event-adapter.js";
import { InvitationLive, OrganizationAdminLive, OrganizationLive } from "./interface/http/index.js";
import { OrganizationCommandsLive } from "./organization.command-handlers.js";
import { OrganizationQueriesLive } from "./organization.query-handlers.js";
import { OrganizationPoliciesLive } from "./policies/organization.policies.js";

export const OrganizationModule = {
  layer: OrganizationPoliciesLive.pipe(
    Layer.provideMerge(Layer.mergeAll(OrganizationCommandsLive, OrganizationQueriesLive)),
    Layer.provide(roleLayer),
    Layer.provide(userLayer),
  ),

  http: Layer.mergeAll(
    OrganizationLive,
    OrganizationAdminLive,
    InvitationLive,
    // CLI-facing `listMine` (the `cliOrganization` group on CliApi).
    OrgCliLive,
    // Subscribes the invitation mail-out; see the adapter for why it is after-commit.
    InvitationEventAdapterLive,
  ).pipe(Layer.provide(OrganizationRepositoryLive)),
};
