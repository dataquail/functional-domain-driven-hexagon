import * as Layer from "effect/Layer";

import { RoleModule, UserModule } from "@/modules/organization/organization.imports.js";

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
    Layer.provide(RoleModule.layer),
    Layer.provide(UserModule.layer),
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
