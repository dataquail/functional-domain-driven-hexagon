import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { type UserAuthMiddleware } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { Api } from "@/api.js";
import { EnvVars } from "@/common/env-vars.js";
import {
  authCommandHandlers,
  AuthModuleLive,
  authQueryHandlers,
  AuthSharedDepsLive,
} from "@/modules/auth/index.js";
import {
  billingCommandHandlers,
  billingEventSpanAttributes,
  BillingModuleTestLive,
  billingPolicies,
  billingQueryHandlers,
  BillingResolverEntry,
  BillingResolverEntryLive,
} from "@/modules/billing/index.js";
import {
  MembershipServiceLive,
  organizationCommandHandlers,
  organizationEventSpanAttributes,
  OrganizationModuleLive,
  organizationPolicies,
  organizationQueryHandlers,
  OrganizationResolverEntry,
  OrganizationResolverEntryLive,
  OrganizationRoleServiceLive,
} from "@/modules/organization/index.js";
import {
  roleCommandHandlers,
  roleEventSpanAttributes,
  roleQueryHandlers,
  RoleServiceLive,
} from "@/modules/role/index.js";
import {
  TodoCollectionResolverEntry,
  TodoCollectionResolverEntryLive,
  todoCommandHandlers,
  todoQueryHandlers,
  TodoResolverEntry,
  TodoResolverEntryLive,
  TodosModuleLive,
  todosPolicies,
} from "@/modules/todos/index.js";
import {
  userCommandHandlers,
  userEventSpanAttributes,
  UserModuleLive,
  userPolicies,
  UserProvisioningLive,
  userQueryHandlers,
  UserResolverEntry,
  UserResolverEntryLive,
} from "@/modules/user/index.js";
import { walletEventSpanAttributes, WalletModuleLive } from "@/modules/wallet/index.js";
import { makePolicyRegistry } from "@/platform/auth/policy-registry.js";
import { makeResourceResolverRegistry } from "@/platform/auth/resource-resolver-registry.js";
import { makeCommandBus } from "@/platform/command-bus-live.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { QueryBus } from "@/platform/ddd/ports/query-bus.js";
import { makeDomainEventBusLive } from "@/platform/domain-event-bus-live.js";
import { makeIntegrationEventBusLive } from "@/platform/integration-event-bus-live.js";
import { makeQueryBus } from "@/platform/query-bus-live.js";
import { UnitOfWorkLive } from "@/platform/unit-of-work-live.js";
import {
  UserAuthMiddlewareFake,
  UserAuthMiddlewareFakeAsMember,
} from "@/test-utils/fake-auth-middleware.js";
import { TestDatabaseLive } from "@/test-utils/test-database.js";

const CommandBusLive = Layer.succeed(
  CommandBus,
  makeCommandBus({
    ...userCommandHandlers,
    ...todoCommandHandlers,
    ...authCommandHandlers,
    ...roleCommandHandlers,
    ...organizationCommandHandlers,
    ...billingCommandHandlers,
  }),
);
const QueryBusLive = Layer.succeed(
  QueryBus,
  makeQueryBus({
    ...userQueryHandlers,
    ...todoQueryHandlers,
    ...authQueryHandlers,
    ...roleQueryHandlers,
    ...organizationQueryHandlers,
    ...billingQueryHandlers,
  }),
);
const DomainEventBusLive = makeDomainEventBusLive({
  spanAttributes: {
    ...userEventSpanAttributes,
    ...walletEventSpanAttributes,
    ...roleEventSpanAttributes,
    ...organizationEventSpanAttributes,
    ...billingEventSpanAttributes,
  },
});
const IntegrationEventBusLive = makeIntegrationEventBusLive();

const PolicyRegistryLive = makePolicyRegistry([
  userPolicies,
  organizationPolicies,
  todosPolicies,
  billingPolicies,
]);

const ResourceResolverRegistryLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const userResolver = yield* UserResolverEntry;
    const organizationResolver = yield* OrganizationResolverEntry;
    const todoCollectionResolver = yield* TodoCollectionResolverEntry;
    const todoResolver = yield* TodoResolverEntry;
    const billingResolver = yield* BillingResolverEntry;
    return makeResourceResolverRegistry({
      user: userResolver,
      organization: organizationResolver,
      todoCollection: todoCollectionResolver,
      todo: todoResolver,
      billing: billingResolver,
    });
  }),
).pipe(
  Layer.provide([
    UserResolverEntryLive,
    OrganizationResolverEntryLive,
    TodoCollectionResolverEntryLive,
    TodoResolverEntryLive,
    BillingResolverEntryLive,
  ]),
);

// `CommandBus` and `QueryBus` are cross-cutting public production APIs
// (ADR-0006) — the same dispatch surface every HTTP handler uses. Exposing
// them at the test runtime via `provideMerge` lets integration tests seed
// state and assert via the production seam without leaking module-internal
// ports (repositories) into the test runtime. The remaining services
// (UserAuthMiddleware, DomainEventBus, UnitOfWork) stay consumed by
// `Layer.provide` because they're either internal infrastructure
// (DomainEventBus, UnitOfWork) or feature-specific (auth middleware)
// and aren't meant to be driven directly from tests.
// Factory: build a TestServer composition with a swappable
// auth-middleware fake. Default callers (every existing integration
// test) get the super-admin fake. The Stripe-vs-fake `BillingGateway`
// swap lives inside `BillingModuleTestLive` (the test-variant module
// Live exported from billing's barrel) — no gateway Layer threads
// through the composition root.
export const makeTestServerLive = (authMiddleware: Layer.Layer<UserAuthMiddleware>) => {
  const ApiLive = HttpApiBuilder.api(Api).pipe(
    Layer.provide([
      TodosModuleLive,
      UserModuleLive,
      WalletModuleLive,
      AuthModuleLive,
      OrganizationModuleLive,
      BillingModuleTestLive,
    ]),
    // Own step (mirrors server.ts): UserProvisioningLive depends on
    // DomainEventBus + UnitOfWork (peers in the block below) + CommandBus, so
    // those steps must provide TO it.
    Layer.provide([UserProvisioningLive]),
    Layer.provide([
      authMiddleware,
      RoleServiceLive,
      MembershipServiceLive,
      OrganizationRoleServiceLive,
      DomainEventBusLive,
      UnitOfWorkLive,
    ]),
    // CommandBus + QueryBus must provide TO the modules above (they dispatch
    // via the buses) AND remain reachable from test runtimes — `provideMerge`
    // keeps them in the runtime context so `yield* CommandBus`/`QueryBus`
    // works in test bodies. IntegrationEventBusLive rides along in the same
    // `provideMerge` so it lands in the SUCCESS channel rather than being
    // `Exclude`d from requirements — the latter makes the inferred type and the
    // emitted `.d.ts` diverge (and trips a `tsc -b` declaration-emit crash).
    Layer.provideMerge(Layer.mergeAll(CommandBusLive, QueryBusLive, IntegrationEventBusLive)),
    // Authz registries — same shape as `server.ts`. Endpoints consume
    // PolicyRegistry + ResourceResolverRegistry via Authz.requires*.
    Layer.provide([PolicyRegistryLive, ResourceResolverRegistryLive]),
    Layer.provide(AuthSharedDepsLive),
    Layer.provide(EnvVars.Default),
  );

  // layerTest binds the server to an in-memory transport and exposes an
  // HttpClient wired to it — no port, no network hop. provideMerge (instead
  // of provide) keeps HttpClient + Database reachable in the test runtime so
  // tests can `yield* HttpApiClient.make(Api)` and drive the DB directly.
  // `provideMerge(ApiLive)` carries the bus exposure forward into the
  // TestServerLive runtime context so tests can `yield* CommandBus`/`QueryBus`.
  return HttpApiBuilder.serve().pipe(
    Layer.provideMerge(ApiLive),
    Layer.provideMerge(TestDatabaseLive),
    Layer.provideMerge(NodeHttpServer.layerTest),
  );
};

// Default — super-admin caller. Every existing integration test consumes this.
export const TestServerLive = makeTestServerLive(UserAuthMiddlewareFake);

// Non-super-admin caller. 403-Forbidden tests for super-admin-only
// endpoints consume this via `useServerTestRuntime(tables, { server: ... })`.
export const TestServerLiveAsMember = makeTestServerLive(UserAuthMiddlewareFakeAsMember);
