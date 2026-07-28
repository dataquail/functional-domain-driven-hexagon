import { createServer } from "node:http";

import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { CommandBus, makeCommandBus, makeQueryBus, mergeDispatchTables, QueryBus } from "@org/cqrs";
import { Database } from "@org/database/index";
import * as dotenv from "dotenv";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as OtlpSerialization from "effect/unstable/observability/OtlpSerialization";
import * as OtlpTracer from "effect/unstable/observability/OtlpTracer";

import { Api } from "./api.js";
import { EnvVars } from "./common/env-vars.js";
import {
  AuthCommands,
  AuthCommandsLive,
  AuthHttpDepsLive,
  AuthModuleLive,
  AuthQueries,
  AuthQueriesLive,
  AuthSharedDepsLive,
} from "./modules/auth/index.js";
import {
  BillingCommands,
  BillingCommandsLive,
  billingEventSpanAttributes,
  BillingModuleLive,
  BillingPoliciesLive,
  BillingPolicyContribution,
  BillingQueries,
  BillingQueriesLive,
  BillingResolverEntry,
  BillingResolverEntryLive,
} from "./modules/billing/index.js";
import {
  OrganizationCommands,
  OrganizationCommandsLive,
  organizationEventSpanAttributes,
  OrganizationModuleLive,
  OrganizationPoliciesLive,
  OrganizationPolicyContribution,
  OrganizationQueries,
  OrganizationQueriesLive,
  OrganizationResolverEntry,
  OrganizationResolverEntryLive,
} from "./modules/organization/index.js";
import {
  RoleCommands,
  RoleCommandsLive,
  roleEventSpanAttributes,
  RoleQueriesLive,
} from "./modules/role/index.js";
import {
  TodoCollectionResolverEntry,
  TodoCollectionResolverEntryLive,
  TodoCommands,
  TodoCommandsLive,
  TodoPoliciesLive,
  TodoPolicyContribution,
  TodoQueries,
  TodoQueriesLive,
  TodoResolverEntry,
  TodoResolverEntryLive,
  TodosModuleLive,
} from "./modules/todos/index.js";
import {
  UserCommands,
  UserCommandsLive,
  userEventSpanAttributes,
  UserModuleLive,
  UserQueries,
  UserQueriesLive,
} from "./modules/user/index.js";
import {
  WalletCommands,
  WalletCommandsLive,
  walletEventSpanAttributes,
  WalletModuleLive,
} from "./modules/wallet/index.js";
import { makePolicyRegistry } from "./platform/auth/policy-registry.js";
import { makeResourceResolverRegistry } from "./platform/auth/resource-resolver-registry.js";
import { DatabaseLive } from "./platform/database-live.js";
import { makeDomainEventBusLive } from "./platform/domain-event-bus-live.js";
import { makeIntegrationEventBusLive } from "./platform/integration-event-bus-live.js";
import { UserAuthMiddlewareLive } from "./platform/middlewares/auth-middleware-live.js";
import { UnitOfWorkLive } from "./platform/unit-of-work-live.js";

dotenv.config({
  path: "../../.env",
});

// `CommandBus`/`QueryBus` route by tag across the per-module dispatch surfaces
// (`ModuleDispatchersLive` below). A dispatch site names the bus and the message
// definition; which module answers a tag is settled here, once.
const CommandBusLive = Layer.effect(
  CommandBus,
  Effect.gen(function* () {
    const wallet = yield* WalletCommands;
    const user = yield* UserCommands;
    const organization = yield* OrganizationCommands;
    const auth = yield* AuthCommands;
    const todos = yield* TodoCommands;
    const role = yield* RoleCommands;
    const billing = yield* BillingCommands;
    return makeCommandBus(
      mergeDispatchTables(wallet, user, organization, auth, todos, role, billing),
    );
  }),
);
const QueryBusLive = Layer.effect(
  QueryBus,
  Effect.gen(function* () {
    const organization = yield* OrganizationQueries;
    const auth = yield* AuthQueries;
    const user = yield* UserQueries;
    const todos = yield* TodoQueries;
    const billing = yield* BillingQueries;
    return makeQueryBus(mergeDispatchTables(organization, auth, user, todos, billing));
  }),
);

// The module dependency order, stated once. A module whose handlers reach another
// module through an outbound ACL port sits above the module it reaches, so the graph
// the layers resolve is the real cross-module graph rather than the aggregate one a
// single all-modules bus would impose. A genuine cycle between two modules would
// surface here as an unresolvable layer, which is the point.
const ModuleDispatchersLive = Layer.mergeAll(
  // Reach downward through an outbound ACL port: auth provisions a user and asks role
  // whether the caller is a super admin; organization asks role the same question and
  // asks user for members' emails.
  AuthCommandsLive,
  AuthQueriesLive,
  OrganizationCommandsLive,
  OrganizationQueriesLive,
  // Reach no other module; peers of the above only because nothing reaches them either.
  BillingCommandsLive,
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

// Resource resolvers are owned by each module: the module exports a
// `*ResolverEntryLive` layer that internally satisfies its repository
// dependency, so the composition root never sees module-internal
// repository Tags. Adding a module to the registry: import its
// `*ResolverEntry` Tag + `*ResolverEntryLive` layer, yield the Tag,
// and provide the layer below.
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

// v4 model: `HttpApiBuilder.layer` registers the group handlers into the
// `HttpRouter`; the handlers' runtime dependencies are tracked as
// request-scoped requirements and are only satisfiable AFTER
// `HttpRouter.serve` unwraps them (see `AppServicesLive` below). So this
// layer provides only the module group implementations at build time.
const ApiLive = HttpApiBuilder.layer(Api).pipe(
  Layer.provide([
    TodosModuleLive,
    UserModuleLive,
    WalletModuleLive,
    AuthModuleLive,
    OrganizationModuleLive,
    BillingModuleLive,
  ]),
  // The middleware impl is a build-time requirement of the API (groups declare
  // `.middleware(UserAuthMiddleware)`); providing it here applies the wrapper,
  // which supplies `CurrentUser` to every gated endpoint. Its own deps
  // (buses, CookieCodec, Database) bubble up as plain requirements and close
  // below (post-serve).
  Layer.provide(UserAuthMiddlewareLive),
);

// v4 modernization (Phase 6): the `@effect/opentelemetry/NodeSdk` layer is
// replaced by the first-party OTLP tracer from `effect/unstable/observability`.
// `OtlpTracer.layer` provides a `Tracer.Tracer` that batches ended spans and
// POSTs them (JSON-serialized) to the OTLP `/v1/traces` endpoint — `OTLP_URL`
// already points there. Its two requirements close locally: JSON serialization
// (`OtlpSerialization.layerJson`) and an `HttpClient` (`FetchHttpClient.layer`,
// the platform-agnostic fetch client). This drops the `@effect/opentelemetry`
// and `@opentelemetry/*` dependency set from the server.
const TracerLive = Layer.unwrap(
  Effect.map(EnvVars, (env) =>
    OtlpTracer.layer({
      url: env.OTLP_URL.toString(),
      resource: {
        serviceName: "effect-monorepo-server",
      },
    }),
  ),
).pipe(Layer.provide([OtlpSerialization.layerJson, FetchHttpClient.layer]));

// CORS is a no-op in normal traffic post-ADR-0018: the Next renderer
// is the only browser-facing surface and Next's `/api/*` rewrite calls
// us server-to-server (no Origin header — middleware skips). No browser
// reaches `:3001` directly. The allow-list is intentionally empty so a
// stray cross-origin browser call would be rejected. Layer kept (not
// deleted) so a future operator who genuinely needs to expose the BFF
// to a non-Next browser caller can add an entry without re-discovering
// the wiring; the credentials/methods/headers shape is preserved.
const corsMiddleware = HttpMiddleware.cors({
  allowedOrigins: [],
  allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "B3", "traceparent"],
  credentials: true,
});

const HttpLive = HttpRouter.serve(ApiLive, {
  // Applied to the whole server chain: log every request, then answer CORS
  // preflight (empty allow-list — see CORS note above).
  middleware: (httpApp) => corsMiddleware(HttpMiddleware.logger(httpApp)),
  // `HttpRouter.serve` composes its OWN `HttpMiddleware.logger` unless told not
  // to. Our `middleware` above already logs, so without this every request was
  // logged twice ("Sent HTTP response" ×2, visible in traces). Own the logger
  // here; let serve skip its default.
  disableLogger: true,
}).pipe(
  // The endpoints' per-request services, now unwrapped by `serve` into plain
  // requirements. The provide ORDER encodes the dependency graph (peers don't
  // satisfy each other) — it mirrors the pre-v4 ApiLive wiring.
  // The policy registry and the endpoint-consumed module services are peers of the auth
  // middleware: all consume the buses provided just below and feed upstream consumers
  // (endpoints + policy checks). No module's ACL adapter appears here any more — each is
  // provided inside the module that owns it. The Stripe-vs-fake `BillingGateway` swap
  // ships as the module's `BillingHttpDeps{Live,Fake}` bundles: prod provides the live
  // one here; `test-server.ts` provides the fake, so the `BillingGateway` Tag stays
  // private to the module and only the opaque bundle appears here.
  Layer.provide([
    PolicyRegistryLive,
    ResourceResolverRegistryLive,
    // Endpoint-consumed, module-owned services that `serve` unwrapped from
    // request-scoped into plain requirements (see the module Lives). Prod
    // uses the live billing gateway; test-server.ts swaps the fake. Their
    // deps (EnvVars, etc.) close below.
    AuthHttpDepsLive,
  ]),
  // CommandBus + QueryBus provide TO the middleware (which dispatches
  // FindSessionQuery). IntegrationEventBus provides TO UnitOfWork (post-commit
  // flush), so it sits here, not as a peer of UnitOfWork below.
  Layer.provide([CommandBusLive, QueryBusLive, IntegrationEventBusLive]),
  // Merged, not provided: the buses route through these, and so do the outbound ACL
  // adapters above, which name the module they reach rather than the bus.
  Layer.provideMerge(ModuleDispatchersLive),
  // `provideMerge`, and below the dispatchers, because the demand runs both ways: the
  // layers above consume these, and so does every module dispatcher (`handlersOf`
  // hoists its handlers' requirements onto the layer). Merging one layer value in one
  // place is what keeps it a single instance — two `provide` sites would risk a
  // second event bus whose subscribers nobody notifies.
  Layer.provideMerge(Layer.mergeAll(DomainEventBusLive, UnitOfWorkLive)),
  // Resource resolvers read through repositories, so they close on Database
  // alone; the policy registry sits above with the buses it now dispatches
  // through.
  Layer.provide(AuthSharedDepsLive),
  Layer.merge(Layer.effectDiscard(Database.Database.use((db) => db.setupConnectionListeners))),
  Layer.provide(DatabaseLive),
  Layer.provide(TracerLive),
  Layer.provide(EnvVars.layer),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3001 })),
);

Layer.launch(HttpLive).pipe(
  Effect.tapCause(Effect.logError),
  Effect.retry({
    while: (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "_tag" in error &&
      error._tag === "DatabaseConnectionLostError",
    // Capped, jittered exponential backoff. v4 folded `modifyDelayEffect`
    // into `modifyDelay` (now always effectful), so the per-attempt log
    // line and the 8s cap live in one step.
    schedule: Schedule.exponential("1 second", 2).pipe(
      Schedule.jittered,
      Schedule.modifyDelay((_output, delay) => {
        const capped = Duration.min(delay, Duration.seconds(8));
        return Effect.as(
          Effect.logError(`[Server crashed]: Retrying in ${Duration.format(capped)}`),
          capped,
        );
      }),
    ),
  }),
  NodeRuntime.runMain(),
);
