import { type Resolver } from "@org/authz";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { type OrganizationId } from "@/platform/ids/organization-id.js";

// Billing exposes a single org-scoped policy resource. The "resource"
// identity IS the org id — there is nothing to load before the check,
// and a non-member must not learn whether a subscription exists for
// the org. Same shape as the `todoCollection` resolver: a deliberate
// echo. The membership / org-admin checks each look up against their
// own ACL port and decide.
export type BillingResourceContext = { readonly organizationId: OrganizationId };

declare module "@org/authz/resource-resolver-registry" {
  interface ResourceResolverMap {
    billing: {
      resourceType: BillingResourceContext;
      idType: OrganizationId;
      notFound: never;
    };
  }
}

export class BillingResolverEntry extends Context.Service<
  BillingResolverEntry,
  Resolver<"billing">
>()("BillingResolverEntry") {}

export const BillingResolverEntryLive = Layer.succeed(BillingResolverEntry, (organizationId) =>
  Effect.succeed({ organizationId }),
);
