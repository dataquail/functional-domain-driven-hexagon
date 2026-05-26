import { createServer } from "node:http";

import * as NodeSdk from "@effect/opentelemetry/NodeSdk";
import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder";
import * as HttpMiddleware from "@effect/platform/HttpMiddleware";
import * as HttpServer from "@effect/platform/HttpServer";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { Database } from "@org/database/index";
import * as dotenv from "dotenv";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";

import { Api } from "./api.js";
import { EnvVars } from "./common/env-vars.js";
import {
  authCommandHandlers,
  AuthModuleLive,
  authQueryHandlers,
  AuthSharedDepsLive,
} from "./modules/auth/index.js";
import {
  MembershipServiceLive,
  organizationCommandHandlers,
  organizationEventSpanAttributes,
  OrganizationModuleLive,
  organizationPolicies,
  organizationQueryHandlers,
  OrganizationResolverEntry,
  OrganizationResolverEntryLive,
} from "./modules/organization/index.js";
import {
  roleCommandHandlers,
  roleEventSpanAttributes,
  roleQueryHandlers,
  RoleServiceLive,
} from "./modules/role/index.js";
import { todoCommandHandlers, todoQueryHandlers, TodosModuleLive } from "./modules/todos/index.js";
import {
  userCommandHandlers,
  userEventSpanAttributes,
  UserModuleLive,
  userPolicies,
  userQueryHandlers,
  UserResolverEntry,
  UserResolverEntryLive,
} from "./modules/user/index.js";
import { walletEventSpanAttributes, WalletModuleLive } from "./modules/wallet/index.js";
import { makePolicyRegistry } from "./platform/auth/policy-registry.js";
import { makeResourceResolverRegistry } from "./platform/auth/resource-resolver-registry.js";
import { makeCommandBus } from "./platform/command-bus-live.js";
import { DatabaseLive } from "./platform/database-live.js";
import { CommandBus } from "./platform/ddd/command-bus.js";
import { QueryBus } from "./platform/ddd/query-bus.js";
import { makeDomainEventBusLive } from "./platform/domain-event-bus-live.js";
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
  }),
);
const DomainEventBusLive = makeDomainEventBusLive({
  spanAttributes: {
    ...userEventSpanAttributes,
    ...walletEventSpanAttributes,
    ...roleEventSpanAttributes,
    ...organizationEventSpanAttributes,
  },
});

const PolicyRegistryLive = makePolicyRegistry([userPolicies, organizationPolicies]);

// Resource resolvers are owned by each module: the module exports a
// `*ResolverEntryLive` layer that internally satisfies its repository
// dependency, so the composition root never sees module-internal
// repository Tags. Adding a module to the registry: import its
// `*ResolverEntry` Tag + `*ResolverEntryLive` layer, yield the Tag,
// and provide the layer below.
const ResourceResolverRegistryLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const userResolver = yield* UserResolverEntry;
    const organizationResolver = yield* OrganizationResolverEntry;
    return makeResourceResolverRegistry({
      user: userResolver,
      organization: organizationResolver,
    });
  }),
).pipe(Layer.provide([UserResolverEntryLive, OrganizationResolverEntryLive]));

const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide([
    TodosModuleLive,
    UserModuleLive,
    WalletModuleLive,
    AuthModuleLive,
    OrganizationModuleLive,
  ]),
  // RoleService is a peer of the auth middleware: both consume the
  // buses provided just below, and both feed upstream consumers
  // (endpoints + `SuperAdminOnly`). Placing it here means the same
  // `Layer.provide([CommandBusLive, QueryBusLive])` step satisfies its
  // QueryBus dependency too.
  Layer.provide([
    UserAuthMiddlewareLive,
    RoleServiceLive,
    MembershipServiceLive,
    DomainEventBusLive,
    UnitOfWorkLive,
  ]),
  // CommandBus + QueryBus must provide TO the middleware (not be its peers
  // in the array above), since UserAuthMiddlewareLive now dispatches the
  // FindSessionQuery via the bus.
  Layer.provide([CommandBusLive, QueryBusLive]),
  // Authz registries — endpoints consume PolicyRegistry +
  // ResourceResolverRegistry via Authz.requires/requiresOn.
  Layer.provide([PolicyRegistryLive, ResourceResolverRegistryLive]),
  Layer.provide(AuthSharedDepsLive),
  Layer.provide(EnvVars.Default),
);

const NodeSdkLive = Layer.unwrapEffect(
  EnvVars.OTLP_URL.pipe(
    Effect.map((url) =>
      NodeSdk.layer(() => ({
        resource: {
          serviceName: "effect-monorepo-server",
        },
        spanProcessor: new BatchSpanProcessor(
          new OTLPTraceExporter({
            url: url.toString(),
          }),
        ),
      })),
    ),
  ),
);

// CORS is a no-op in normal traffic post-ADR-0018: the Next renderer
// is the only browser-facing surface and Next's `/api/*` rewrite calls
// us server-to-server (no Origin header — middleware skips). No browser
// reaches `:3001` directly. The allow-list is intentionally empty so a
// stray cross-origin browser call would be rejected. Layer kept (not
// deleted) so a future operator who genuinely needs to expose the BFF
// to a non-Next browser caller can add an entry without re-discovering
// the wiring; the credentials/methods/headers shape is preserved.
const CorsLive = HttpApiBuilder.middlewareCors({
  allowedOrigins: [],
  allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "B3", "traceparent"],
  credentials: true,
});

const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  HttpServer.withLogAddress,
  Layer.provide(CorsLive),
  Layer.provide(ApiLive),
  Layer.merge(Layer.effectDiscard(Database.Database.use((db) => db.setupConnectionListeners))),
  Layer.provide(DatabaseLive),
  Layer.provide(NodeSdkLive),
  Layer.provide(EnvVars.Default),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3001 })),
);

Layer.launch(HttpLive).pipe(
  Effect.tapErrorCause(Effect.logError),
  Effect.retry({
    while: (error) => error._tag === "DatabaseConnectionLostError",
    schedule: Schedule.exponential("1 second", 2).pipe(
      Schedule.modifyDelay(Duration.min("8 seconds")),
      Schedule.jittered,
      Schedule.repetitions,
      Schedule.modifyDelayEffect((count, delay) =>
        Effect.as(
          Effect.logError(
            `[Server crashed]: Retrying in ${Duration.format(delay)} (attempt #${count + 1})`,
          ),
          delay,
        ),
      ),
    ),
  }),
  NodeRuntime.runMain(),
);
