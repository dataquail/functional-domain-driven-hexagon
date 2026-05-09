import * as NodeSdk from "@effect/opentelemetry/NodeSdk";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder";
import * as HttpMiddleware from "@effect/platform/HttpMiddleware";
import * as HttpServer from "@effect/platform/HttpServer";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { Database } from "@org/database/index";
import * as dotenv from "dotenv";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import { createServer } from "node:http";
import { Api } from "./api.js";
import { EnvVars } from "./common/env-vars.js";
import {
  authCommandHandlers,
  AuthModuleLive,
  authQueryHandlers,
  AuthSharedDepsLive,
} from "./modules/auth/index.js";
import { todoCommandHandlers, todoQueryHandlers, TodosModuleLive } from "./modules/todos/index.js";
import {
  userCommandHandlers,
  userEventSpanAttributes,
  UserModuleLive,
  userQueryHandlers,
} from "./modules/user/index.js";
import { walletEventSpanAttributes, WalletModuleLive } from "./modules/wallet/index.js";
import { PermissionsResolver } from "./platform/auth/permissions-resolver.js";
import { CommandBus, makeCommandBus } from "./platform/command-bus.js";
import { makeDomainEventBusLive } from "./platform/domain-event-bus.js";
import { UserAuthMiddlewareLive } from "./platform/middlewares/auth-middleware-live.js";
import { makeQueryBus, QueryBus } from "./platform/query-bus.js";
import { TransactionRunnerLive } from "./platform/transaction-runner.js";

dotenv.config({
  path: "../../.env",
});

const CommandBusLive = Layer.succeed(
  CommandBus,
  makeCommandBus({ ...userCommandHandlers, ...todoCommandHandlers, ...authCommandHandlers }),
);
const QueryBusLive = Layer.succeed(
  QueryBus,
  makeQueryBus({ ...userQueryHandlers, ...todoQueryHandlers, ...authQueryHandlers }),
);
const DomainEventBusLive = makeDomainEventBusLive({
  spanAttributes: { ...userEventSpanAttributes, ...walletEventSpanAttributes },
});

const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide([TodosModuleLive, UserModuleLive, WalletModuleLive, AuthModuleLive]),
  Layer.provide([UserAuthMiddlewareLive, DomainEventBusLive, TransactionRunnerLive]),
  // CommandBus + QueryBus must provide TO the middleware (not be its peers
  // in the array above), since UserAuthMiddlewareLive now dispatches the
  // FindSessionQuery via the bus.
  Layer.provide([CommandBusLive, QueryBusLive]),
  Layer.provide(PermissionsResolver.Default),
  Layer.provide(AuthSharedDepsLive),
  Layer.provide(EnvVars.Default),
);

const DatabaseLive = Layer.unwrapEffect(
  EnvVars.pipe(
    Effect.map((envVars) =>
      Database.layer({
        url: envVars.DATABASE_URL,
        ssl: envVars.ENV === "prod",
      }),
    ),
  ),
).pipe(Layer.provide(EnvVars.Default));

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
