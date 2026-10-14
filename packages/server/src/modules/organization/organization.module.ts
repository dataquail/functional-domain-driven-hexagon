import * as Layer from "effect/Layer";

import { RoleModule } from "@/modules/role/role.module";
import { UserModule } from "@/modules/user/user.module";

import { OrganizationRepositoryLive } from "./infrastructure/repositories/organization.repository-live";
import { OrgCliLive } from "./interface/cli/organization.endpoint-groups";
import { InvitationEventAdapterLive } from "./interface/events/invitation.event-adapter";
import {
  InvitationLive,
  OrganizationAdminLive,
  OrganizationLive,
} from "./interface/http/organization.endpoint-groups";
import { OrganizationCommandsLive } from "./organization.command-handlers";
import { OrganizationQueriesLive } from "./organization.query-handlers";
import { OrganizationPoliciesLive } from "./policies/organization.policies";

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
