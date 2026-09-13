import * as Layer from "effect/Layer";

import { RoleLayer } from "@/modules/role/role.exports.js";
import { UserLayer } from "@/modules/user/user.exports.js";

import { OrganizationRepositoryLive } from "./infrastructure/repositories/organization.repository-live.js";
import { OrgCliLive } from "./interface/cli/index.js";
import { InvitationEventAdapterLive } from "./interface/events/invitation.event-adapter.js";
import { InvitationLive, OrganizationAdminLive, OrganizationLive } from "./interface/http/index.js";
import { OrganizationCommandsLive } from "./organization.command-handlers.js";
import { OrganizationQueriesLive } from "./organization.query-handlers.js";
import { OrganizationPoliciesLive } from "./policies/organization.policies.js";

export const OrganizationLayer = OrganizationPoliciesLive.pipe(
  Layer.provideMerge(Layer.mergeAll(OrganizationCommandsLive, OrganizationQueriesLive)),
  Layer.provide(RoleLayer),
  Layer.provide(UserLayer),
);

export const OrganizationHttpLayer = Layer.mergeAll(
  OrganizationLive,
  OrganizationAdminLive,
  InvitationLive,
  OrgCliLive,
  InvitationEventAdapterLive,
).pipe(Layer.provide(OrganizationRepositoryLive));
