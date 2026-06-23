import * as HttpApiEndpoint from "@effect/platform/HttpApiEndpoint";
import * as HttpApiGroup from "@effect/platform/HttpApiGroup";
import * as Schema from "effect/Schema";

import * as CustomHttpApiError from "../CustomHttpApiError.js";
import { OrganizationId } from "../EntityIds.js";
import { UserAuthMiddleware } from "../Policy.js";

// CLI-facing organization surface (ADR-0024). Deliberately leaner than the
// GUI's `MyOrganization` — the CLI only needs to name an org and know
// whether the caller administers it — so the two contracts diverge.
export class CliOrganization extends Schema.Class<CliOrganization>("CliOrganization")({
  id: OrganizationId,
  name: Schema.String,
  isAdmin: Schema.Boolean,
}) {}

export class Group extends HttpApiGroup.make("cliOrganization")
  .middleware(UserAuthMiddleware)
  .add(HttpApiEndpoint.get("listMine", "/").addSuccess(Schema.Array(CliOrganization)))
  .addError(CustomHttpApiError.ServiceUnavailable)
  .prefix("/cli/orgs") {}
