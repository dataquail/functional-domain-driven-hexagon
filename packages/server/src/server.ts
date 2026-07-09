import { createServer } from "node:http";

import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
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
  authCommandHandlers,
  AuthModuleLive,
  authQueryHandlers,
  AuthSharedDepsLive,
} from "./modules/auth/index.js";
import {
  billingCommandHandlers,
  billingEventSpanAttributes,
  BillingModuleLive,
  billingPolicies,
  billingQueryHandlers,
  BillingResolverEntry,
  BillingResolverEntryLive,
} from "./modules/billing/index.js";
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
} from "./modules/organization/index.js";
import {
  roleCommandHandlers,
  roleEventSpanAttributes,
  roleQueryHandlers,
  RoleServiceLive,
} from "./modules/role/index.js";
import {
  TodoCollectionResolverEntry,
  TodoCollectionResolverEntryLive,
  todoCommandHandlers,
  todoQueryHandlers,
  TodoResolverEntry,
  TodoResolverEntryLive,
  TodosModuleLive,
  todosPolicies,
} from "./modules/todos/index.js";
import {
  userCommandHandlers,
  userEventSpanAttributes,
  UserModuleLive,
  userPolicies,
  UserProvisioningLive,
  userQueryHandlers,
  UserResolverEntry,
  UserResolverEntryLive,
} from "./modules/user/index.js";
import { walletEventSpanAttributes, WalletModuleLive } from "./modules/wallet/index.js";
import { makePolicyRegistry } from "./platform/auth/policy-registry.js";
import { makeResourceResolverRegistry } from "./platform/auth/resource-resolver-registry.js";
import { makeCommandBus } from "./platform/command-bus-live.js";
import { DatabaseLive } from "./platform/database-live.js";
import { CommandBus } from "./platform/ddd/ports/command-bus.js";
import { QueryBus } from "./platform/ddd/ports/query-bus.js";
import { makeDomainEventBusLive } from "./platform/domain-event-bus-live.js";
import { makeIntegrationEventBusLive } from "./platform/integration-event-bus-live.js";
import { UserAuthMiddlewareLive } from "./platform/middlewares/auth-middleware-live.js";
import { makeQueryBus } from "./platform/query-bus-live.js";
import { UnitOfWorkLive } from "./platform/unit-of-work-live.js";

dotenv.config({
  path: "../../.env",
});

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

// Resource resolvers are owned by each module: the module exports a
// `*ResolverEntryLive` layer that internally satisfies its repository
// dependency, so the composition root never sees module-internal
// repository Tags. Adding a module to the registry: import its
// `*ResolverEntry` Tag + `*ResolverEntryLive` layer, yield the Tag,
// and provide the layer below.
const ResourceResolverRegistryLive = Layer.unwrap(
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
}).pipe(
  // The endpoints' per-request services, now unwrapped by `serve` into plain
  // requirements. The provide ORDER encodes the dependency graph (peers don't
  // satisfy each other) — it mirrors the pre-v4 ApiLive wiring.
  //
  // UserProvisioning (JIT user creation for `auth` first sign-in) depends on
  // DomainEventBus + UnitOfWork (peers below) + CommandBus (fires
  // CreateUserCommand two steps down), so it gets its own earlier step.
  Layer.provide([UserProvisioningLive]),
  // RoleService is a peer of the auth middleware: both consume the buses
  // provided just below and feed upstream consumers (endpoints +
  // `SuperAdminOnly`). The Stripe-vs-fake swap for `BillingGateway` lives
  // INSIDE `BillingModuleLive` (prod variant; `test-server.ts` uses the fake),
  // so no gateway Layer appears here.
  Layer.provide([
    RoleServiceLive,
    MembershipServiceLive,
    OrganizationRoleServiceLive,
    DomainEventBusLive,
    UnitOfWorkLive,
  ]),
  // CommandBus + QueryBus provide TO the middleware (which dispatches
  // FindSessionQuery). IntegrationEventBus provides TO UnitOfWork (post-commit
  // flush), so it sits here, not as a peer of UnitOfWork above.
  Layer.provide([CommandBusLive, QueryBusLive, IntegrationEventBusLive]),
  // Authz registries — endpoints consume these via Authz.requires/requiresOn.
  Layer.provide([PolicyRegistryLive, ResourceResolverRegistryLive]),
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
