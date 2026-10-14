import * as Layer from "effect/Layer";

import { RoleModule } from "@/modules/role/role.module.ts";
import { UserModule } from "@/modules/user/user.module.ts";

import { OrganizationRepositoryLive } from "./infrastructure/repositories/organization.repository-live.ts";
import { OrgCliLive } from "./interface/cli/organization.endpoint-groups.ts";
import { InvitationEventAdapterLive } from "./interface/events/invitation.event-adapter.ts";
import {
  InvitationLive,
  OrganizationAdminLive,
  OrganizationLive,
} from "./interface/http/organization.endpoint-groups.ts";
import { OrganizationCommandsLive } from "./organization.command-handlers.ts";
import { OrganizationQueriesLive } from "./organization.query-handlers.ts";
import { OrganizationPoliciesLive } from "./policies/organization.policies.ts";

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
  ).pipe(Layer.provide(OrganizationRepositoryLive)),

  // Subscribes the invitation mail-out; see the adapter for why it is after-commit.
  events: InvitationEventAdapterLive,
};
