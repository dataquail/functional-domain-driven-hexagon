import * as Layer from "effect/Layer";

import { OrganizationRepositoryLive } from "./infrastructure/organization-repository-live.js";
import {
  InvitationLive,
  OrganizationAdminLive,
  OrganizationLive,
} from "./interface/http/organization-live.js";

export const OrganizationModuleLive = Layer.mergeAll(
  OrganizationLive,
  OrganizationAdminLive,
  InvitationLive,
).pipe(Layer.provide(OrganizationRepositoryLive));
