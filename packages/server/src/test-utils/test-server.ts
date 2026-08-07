import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { type UserAuthMiddleware } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { Api } from "@/api.js";
import { EnvVars } from "@/common/env-vars.js";
import {
  CommandBusLive,
  DomainEventBusLive,
  QueryBusLive,
  UnhandledFailuresLive,
  UnitOfWorkLive,
} from "@/cqrs-runtime.js";
import {
  AuthCommandsLive,
  AuthHttpDepsLive,
  AuthModuleLive,
  AuthQueriesLive,
  AuthSharedDepsLive,
} from "@/modules/auth/index.js";
import {
  BillingCommandsFake,
  BillingModuleLive,
  BillingPoliciesLive,
  BillingPolicyContribution,
  BillingQueriesLive,
  BillingResolverEntry,
  BillingResolverEntryLive,
} from "@/modules/billing/index.js";
import {
  OrganizationCommandsLive,
  OrganizationModuleLive,
  OrganizationPoliciesLive,
  OrganizationPolicyContribution,
  OrganizationQueriesLive,
  OrganizationResolverEntry,
  OrganizationResolverEntryLive,
} from "@/modules/organization/index.js";
import { RoleCommandsLive, RoleQueriesLive } from "@/modules/role/index.js";
import {
  TodoCollectionResolverEntry,
  TodoCollectionResolverEntryLive,
  TodoCommandsLive,
  TodoPoliciesLive,
  TodoPolicyContribution,
  TodoQueriesLive,
  TodoResolverEntry,
  TodoResolverEntryLive,
  TodosModuleLive,
} from "@/modules/todos/index.js";
import { UserCommandsLive, UserModuleLive, UserQueriesLive } from "@/modules/user/index.js";
import { WalletCommandsLive, WalletModuleLive } from "@/modules/wallet/index.js";
import { makePolicyRegistry } from "@/platform/auth/policy-registry.js";
import { makeResourceResolverRegistry } from "@/platform/auth/resource-resolver-registry.js";
import {
  UserAuthMiddlewareFake,
  UserAuthMiddlewareFakeAsMember,
} from "@/test-utils/fake-auth-middleware.js";
import { TestDatabaseLive } from "@/test-utils/test-database.js";

// The module dependency order — see `server.ts` for why it is stated here.
const ModuleDispatchersLive = Layer.mergeAll(
  // Reach downward through an outbound ACL port: auth provisions a user and asks role
  // whether the caller is a super admin; organization asks role the same question and
  // asks user for members' emails.
  AuthCommandsLive,
  AuthQueriesLive,
  OrganizationCommandsLive,
  OrganizationQueriesLive,
  // Reach no other module; peers of the above only because nothing reaches them either.
  BillingCommandsFake,
  BillingQueriesLive,
  TodoCommandsLive,
  TodoQueriesLive,
  WalletCommandsLive,
).pipe(
  // The modules the first group reaches into. They reach nothing themselves, which is
  // what makes the ordering possible at all.
  Layer.provideMerge(
    Layer.mergeAll(RoleCommandsLive, RoleQueriesLive, UserCommandsLive, UserQueriesLive),
  ),
);

// Every module publishes its policy contribution behind a Tag whose Layer closes
// over that module's own ACL ports, so every registered check is R = never and
// the registry holds no ambient service requirements.
const PolicyRegistryLive = Layer.unwrap(
  Effect.gen(function* () {
    const todoPolicies = yield* TodoPolicyContribution;
    const billingPolicies = yield* BillingPolicyContribution;
    const organizationPolicies = yield* OrganizationPolicyContribution;
    return makePolicyRegistry([todoPolicies, billingPolicies, organizationPolicies]);
  }),
).pipe(Layer.provide([TodoPoliciesLive, BillingPoliciesLive, OrganizationPoliciesLive]));

const ResourceResolverRegistryLive = Layer.unwrap(
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
  // Same v4 shape as server.ts: `HttpApiBuilder.layer` registers the group
  // handlers + the auth middleware (build-time — the groups declare
  // `.middleware(UserAuthMiddleware)`); the handlers' runtime deps are
  // request-scoped and close post-serve below.
  const ApiLive = HttpApiBuilder.layer(Api).pipe(
    Layer.provide([
      TodosModuleLive,
      UserModuleLive,
      WalletModuleLive,
      AuthModuleLive,
      OrganizationModuleLive,
      BillingModuleLive,
    ]),
    Layer.provide(authMiddleware),
  );

  // `HttpRouter.serve` binds the app to `NodeHttpServer.layerTest`'s in-memory
  // transport (no port/network) and unwraps the endpoints' request-scoped
  // requirements into plain ones, satisfied here in the same dependency order
  // as server.ts. `CommandBus`/`QueryBus`/`Database`/`HttpClient` are kept in
  // the runtime's SUCCESS channel via `provideMerge` so integration tests can
  // `yield* CommandBus`/`QueryBus`, `yield* HttpApiClient.make(Api)`, and drive
  // the DB directly.
  return HttpRouter.serve(ApiLive).pipe(
    Layer.provide([
      PolicyRegistryLive,
      ResourceResolverRegistryLive,
      // Endpoint-consumed, module-owned services that `serve` unwrapped from
      // request-scoped into plain requirements (see the module Lives). The
      // billing gateway swaps to the fake here; prod uses the live in
      // server.ts. Their deps (EnvVars, etc.) close below.
      AuthHttpDepsLive,
    ]),
    Layer.provideMerge(Layer.mergeAll(CommandBusLive, QueryBusLive, UnhandledFailuresLive)),
    Layer.provideMerge(ModuleDispatchersLive),
    // Below the dispatchers and merged, not provided: every dispatcher needs these
    // too (`handlersOf` hoists its handlers' requirements), and one layer value in
    // one place keeps it one instance. See server.ts.
    Layer.provideMerge(Layer.mergeAll(DomainEventBusLive, UnitOfWorkLive)),
    Layer.provide(AuthSharedDepsLive),
    Layer.provideMerge(TestDatabaseLive),
    Layer.provide(EnvVars.layer),
    Layer.provideMerge(NodeHttpServer.layerTest),
  );
};

// Default — super-admin caller. Every existing integration test consumes this.
export const TestServerLive = makeTestServerLive(UserAuthMiddlewareFake);

// Non-super-admin caller. 403-Forbidden tests for super-admin-only
// endpoints consume this via `useServerTestRuntime(tables, { server: ... })`.
export const TestServerLiveAsMember = makeTestServerLive(UserAuthMiddlewareFakeAsMember);
