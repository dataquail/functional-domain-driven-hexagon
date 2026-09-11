import { makePolicyRegistry, makeResourceResolverRegistry } from "@effect-server-utils/authz";
import type { UnitOfWork } from "@effect-server-utils/unit-of-work";
import type { Database } from "@org/database";
import { Builder } from "@org/module";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import type { EnvVars } from "@/common/env-vars.js";
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
import type { DomainEventBus } from "@/platform/ddd/event-bus.js";

// What a module may assume is already there. Everything else it requires has to
// come from a module added before it, or `.add` refuses the module and names
// both it and the services it could not resolve.
export type Platform = Database.Database | DomainEventBus | UnitOfWork | EnvVars;

// The module dependency order, stated once for every composition root. A module
// whose handlers reach another module through an outbound ACL port is added
// after the module it reaches, so the graph the layers resolve is the real
// cross-module graph rather than the aggregate one a single all-modules bus
// would impose. Reorder two of these and the type checker names the module and
// the surface it lost; a genuine cycle is inexpressible.
export const applicationModules = (billing: BillingModule) =>
  Builder.app<Platform>()
    // Reached by the modules below through an outbound ACL port; reach nothing
    // themselves, which is what makes the ordering possible at all.
    .add(RoleModule)
    .add(UserModule)
    // Auth provisions a user and asks role whether the caller is a super admin.
    .add(AuthModule)
    // Organization asks role about super admins and user for members' emails.
    .add(OrganizationModule)
    .add(billing)
    .add(TodosModule)
    .add(WalletModule)
    .build();

// Every module publishes its policy contribution behind a Tag whose Layer closes
// over that module's own ACL ports, so every registered check is R = never and
// the registry holds no ambient service requirements. The contributions come
// from the modules themselves — each folds its own `*PoliciesLive` into its
// layer — so the cross-module edges a policy check reaches through (todos and
// billing both ask organization about membership) are edges the builder sees and
// checks, rather than ones satisfied behind its back at this composition root.
export const PolicyRegistryLive = Layer.unwrap(
  Effect.gen(function* () {
    const todoPolicies = yield* TodoPolicyContribution;
    const billingPolicies = yield* BillingPolicyContribution;
    const organizationPolicies = yield* OrganizationPolicyContribution;
    return makePolicyRegistry([todoPolicies, billingPolicies, organizationPolicies]);
  }),
);

// Resource resolvers are owned by each module: the module exports a
// `*ResolverEntryLive` layer that internally satisfies its repository
// dependency, so the composition root never sees module-internal repository
// Tags. Adding a module to the registry: import its `*ResolverEntry` Tag +
// `*ResolverEntryLive` layer, yield the Tag, and provide the layer below.
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
