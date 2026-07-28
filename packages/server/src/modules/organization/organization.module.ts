import * as Layer from "effect/Layer";

import { OrganizationRepositoryLive } from "./infrastructure/repositories/organization.repository-live.js";
import { OrgCliLive } from "./interface/cli/index.js";
import { InvitationLive, OrganizationAdminLive, OrganizationLive } from "./interface/http/index.js";

export const OrganizationModuleLive = Layer.mergeAll(
  OrganizationLive,
  OrganizationAdminLive,
  InvitationLive,
  // CLI-facing `listMine` (the `cliOrganization` group on CliApi).
  OrgCliLive,
).pipe(Layer.provide(OrganizationRepositoryLive));
