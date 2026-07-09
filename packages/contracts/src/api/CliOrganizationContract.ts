import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

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
  .add(
    HttpApiEndpoint.get("listMine", "/", {
      success: Schema.Array(CliOrganization),
      // group-wide error (v3 HttpApiGroup.addError) distributes onto each endpoint in v4
      error: CustomHttpApiError.ServiceUnavailable,
    }),
  )
  .middleware(UserAuthMiddleware)
  .prefix("/cli/orgs") {}
