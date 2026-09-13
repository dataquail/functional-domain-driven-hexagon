import { makePolicyRegistry, makeResourceResolverRegistry } from "@effect-server-utils/authz";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { AuthHttpDepsLayer, AuthHttpLayer, AuthLayer } from "@/modules/auth/index.js";
import {
  BillingHttpLayer,
  type BillingLayer,
  BillingPolicyContribution,
  BillingResolverEntry,
  BillingResolverEntryLive,
} from "@/modules/billing/index.js";
import {
  OrganizationHttpLayer,
  OrganizationLayer,
  OrganizationPolicyContribution,
  OrganizationResolverEntry,
  OrganizationResolverEntryLive,
} from "@/modules/organization/index.js";
import { RoleLayer } from "@/modules/role/index.js";
import {
  TodoCollectionResolverEntry,
  TodoCollectionResolverEntryLive,
  TodoPolicyContribution,
  TodoResolverEntry,
  TodoResolverEntryLive,
  TodosHttpLayer,
  TodosLayer,
} from "@/modules/todos/index.js";
import { UserHttpLayer, UserLayer } from "@/modules/user/index.js";
import { WalletHttpLayer, WalletLayer } from "@/modules/wallet/index.js";

// A set, not a sequence: each module layer already provides the modules it
// reaches, and Effect memoizes a layer by reference, so one provided at several
// sites is built once.
export const applicationModules = (billing: BillingLayer) => ({
  layer: Layer.mergeAll(
    RoleLayer,
    UserLayer,
    AuthLayer,
    OrganizationLayer,
    billing,
    TodosLayer,
    WalletLayer,
  ),
  http: Layer.mergeAll(
    AuthHttpLayer,
    UserHttpLayer,
    OrganizationHttpLayer,
    BillingHttpLayer,
    TodosHttpLayer,
    WalletHttpLayer,
  ),
  httpDeps: AuthHttpDepsLayer,
});

export const PolicyRegistryLive = Layer.unwrap(
  Effect.gen(function* () {
    const todoPolicies = yield* TodoPolicyContribution;
    const billingPolicies = yield* BillingPolicyContribution;
    const organizationPolicies = yield* OrganizationPolicyContribution;
    return makePolicyRegistry([todoPolicies, billingPolicies, organizationPolicies]);
  }),
);

export const ResourceResolverRegistryLive = Layer.unwrap(
  Effect.gen(function* () {
    const organizationResolver = yield* OrganizationResolverEntry;
    const todoCollectionResolver = yield* TodoCollectionResolverEntry;
    const todoResolver = yield* TodoResolverEntry;
    const billingResolver = yield* BillingResolverEntry;
    return makeResourceResolverRegistry({
      organization: organizationResolver,
      todoCollection: todoCollectionResolver,
      todo: todoResolver,
      billing: billingResolver,
    });
  }),
).pipe(
  Layer.provide([
    OrganizationResolverEntryLive,
    TodoCollectionResolverEntryLive,
    TodoResolverEntryLive,
    BillingResolverEntryLive,
  ]),
);
