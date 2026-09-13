import { makePolicyRegistry, makeResourceResolverRegistry } from "@effect-server-utils/authz";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { AuthModule } from "@/modules/auth/index.js";
import {
  type BillingModule,
  BillingPolicyContribution,
  BillingResolverEntry,
  BillingResolverEntryLive,
} from "@/modules/billing/index.js";
import {
  OrganizationModule,
  OrganizationPolicyContribution,
  OrganizationResolverEntry,
  OrganizationResolverEntryLive,
} from "@/modules/organization/index.js";
import { RoleModule } from "@/modules/role/index.js";
import {
  TodoCollectionResolverEntry,
  TodoCollectionResolverEntryLive,
  TodoPolicyContribution,
  TodoResolverEntry,
  TodoResolverEntryLive,
  TodosModule,
} from "@/modules/todos/index.js";
import { UserModule } from "@/modules/user/index.js";
import { WalletModule } from "@/modules/wallet/index.js";

// A set, not a sequence: each module layer already provides the modules it
// reaches, and Effect memoizes a layer by reference, so one provided at several
// sites is built once.
//
// The three slots stay apart because they are provided at three depths of the
// server pipeline: `http` into `HttpApiBuilder.layer`, `httpDeps` into the
// result of `HttpRouter.serve`, and `layer` below the buses that route it.
export const applicationModules = (billing: BillingModule) => ({
  layer: Layer.mergeAll(
    RoleModule.layer,
    UserModule.layer,
    AuthModule.layer,
    OrganizationModule.layer,
    billing.layer,
    TodosModule.layer,
    WalletModule.layer,
  ),
  http: Layer.mergeAll(
    AuthModule.http,
    UserModule.http,
    OrganizationModule.http,
    billing.http,
    TodosModule.http,
    WalletModule.http,
  ),
  httpDeps: AuthModule.httpDeps,
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
