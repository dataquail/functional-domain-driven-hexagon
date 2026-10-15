import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as Schema from "effect/Schema";

import * as CustomHttpApiError from "../CustomHttpApiError";
import { OrganizationId } from "../EntityIds";
import { UserAuthMiddleware } from "../Policy";

// CLI-facing organization surface (ADR-0005). Deliberately leaner than the
// GUI's `MyOrganization` — the CLI only needs to name an org and know
// whether the caller administers it — so the two contracts diverge.
export class CliOrganization extends Schema.Class<
  CliOrganization,
  { readonly brand: "CliOrganization" }
>("CliOrganization")({
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
