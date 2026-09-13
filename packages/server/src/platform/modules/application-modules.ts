import { makePolicyRegistry, makeResourceResolverRegistry } from "@effect-server-utils/authz";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { AuthModule } from "@/modules/auth/auth.platform.js";
import {
  BillingModule,
  BillingPolicyContribution,
  BillingResolverEntry,
  BillingResolverEntryLive,
} from "@/modules/billing/billing.platform.js";
import {
  OrganizationModule,
  OrganizationPolicyContribution,
  OrganizationResolverEntry,
  OrganizationResolverEntryLive,
} from "@/modules/organization/organization.platform.js";
import { RoleModule } from "@/modules/role/role.platform.js";
import {
  TodoCollectionResolverEntry,
  TodoCollectionResolverEntryLive,
  TodoPolicyContribution,
  TodoResolverEntry,
  TodoResolverEntryLive,
  TodosModule,
} from "@/modules/todos/todos.platform.js";
import { UserModule } from "@/modules/user/user.platform.js";
import { WalletModule } from "@/modules/wallet/wallet.platform.js";

// The two cross-module registries. Neither is a module — no bounded context
// owns a registry — but each is folded from one contribution per module, the
// same shape as the command and query buses. A module publishes its
// contribution behind a Tag whose Layer closes over its own ACL ports, so every
// registered check is R = never and the registry holds no ambient requirements.
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

// A set, not a sequence: each module layer already provides the modules it
// reaches, and Effect memoizes a layer by reference, so one provided at several
// sites is built once.
//
// The three slots stay apart because they are provided at three depths of the
// server pipeline: `http` into `HttpApiBuilder.layer`, `httpDeps` into the
// result of `HttpRouter.serve`, and `layer` below the buses that route it.
//
// `httpDeps` carries the two cross-module registries beside the modules' own
// request-scoped services. They are not a module — no bounded context owns
// either — but they are resolved per request the same way, and both composition
// roots want them identically, so neither root names them.
export const applicationModules = {
  layer: Layer.mergeAll(
    RoleModule.layer,
    UserModule.layer,
    AuthModule.layer,
    OrganizationModule.layer,
    BillingModule.layer,
    TodosModule.layer,
    WalletModule.layer,
  ),
  http: Layer.mergeAll(
    AuthModule.http,
    UserModule.http,
    OrganizationModule.http,
    BillingModule.http,
    TodosModule.http,
    WalletModule.http,
  ),
  httpDeps: Layer.mergeAll(AuthModule.httpDeps, PolicyRegistryLive, ResourceResolverRegistryLive),
};
