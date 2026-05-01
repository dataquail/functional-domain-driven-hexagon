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
import { SseHttpLive } from "./platform/sse-http-live.js";
import { SseManager } from "./platform/sse-manager.js";
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
  Layer.provide([TodosModuleLive, SseHttpLive, UserModuleLive, WalletModuleLive, AuthModuleLive]),
  Layer.provide([
    UserAuthMiddlewareLive,
    DomainEventBusLive,
    TransactionRunnerLive,
    SseManager.Default,
  ]),
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

const CorsLive = Layer.unwrapEffect(
  EnvVars.pipe(
    Effect.map((envVars) =>
      HttpApiBuilder.middlewareCors({
        // Must be a specific origin (not "*") because we send credentials.
        // Browsers reject `Access-Control-Allow-Origin: *` with
        // `Access-Control-Allow-Credentials: true`.
        allowedOrigins: [envVars.APP_URL],
        allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        allowedHeaders: ["Content-Type", "Authorization", "B3", "traceparent"],
        credentials: true,
      }),
    ),
  ),
);

const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  HttpServer.withLogAddress,
  Layer.provide(CorsLive),
  Layer.provide(ApiLive),
  Layer.merge(Layer.effectDiscard(Database.Database.use((db) => db.setupConnectionListeners))),
  Layer.provide(DatabaseLive),
  Layer.provide(NodeSdkLive),
  Layer.provide(EnvVars.Default),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
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
