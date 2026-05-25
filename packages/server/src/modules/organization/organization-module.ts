import * as Layer from "effect/Layer";

import { OrganizationRepositoryLive } from "./infrastructure/organization-repository-live.js";
import { OrganizationAdminLive, OrganizationLive } from "./interface/http/organization-live.js";

export const OrganizationModuleLive = Layer.mergeAll(OrganizationLive, OrganizationAdminLive).pipe(
  Layer.provide(OrganizationRepositoryLive),
);
