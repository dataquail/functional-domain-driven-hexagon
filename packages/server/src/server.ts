import { createServer } from "node:http";

import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
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
import { isSqlError } from "effect/unstable/sql/SqlError";

import { Api } from "@/platform/api.js";
import {
  CommandBusLive,
  DomainEventBusLive,
  QueryBusLive,
  UnhandledFailuresLive,
  UnitOfWorkLive,
} from "@/platform/cqrs/cqrs-runtime.js";

import { EnvVars } from "./common/env-vars.js";
import { AuthSharedDepsLive } from "./modules/auth/index.js";
import { BillingModule } from "./modules/billing/index.js";
import { DatabaseLive } from "./platform/database-live.js";
import { UserAuthMiddlewareLive } from "./platform/middlewares/auth-middleware-live.js";
import {
  applicationModules,
  PolicyRegistryLive,
  ResourceResolverRegistryLive,
} from "./platform/modules/application-modules.js";

dotenv.config({
  path: "../../.env",
});

// The application, assembled from the module order stated once in
// platform/modules/. Production takes the live billing gateway; the test runtime
// passes the fake to the same factory.
const application = applicationModules(BillingModule);

// v4 model: `HttpApiBuilder.layer` registers the group handlers into the
// `HttpRouter`; the handlers' runtime dependencies are tracked as
// request-scoped requirements and are only satisfiable AFTER
// `HttpRouter.serve` unwraps them (see `AppServicesLive` below). So this
// layer provides only the module group implementations at build time.
const ApiLive = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(application.http),
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
  // The policy registry and the modules' httpDeps are peers of the auth middleware:
  // all consume the buses provided just below and feed upstream consumers (endpoints
  // + policy checks). No module's ACL adapter appears here any more — each is
  // provided inside the module that owns it, and each module's request-scoped
  // dependency rides `application.httpDeps` rather than being named here.
  Layer.provide([PolicyRegistryLive, ResourceResolverRegistryLive, application.httpDeps]),
  // CommandBus + QueryBus provide TO the middleware (which dispatches
  // FindSessionQuery). The event bus is not here: the unit of work resolves it from
  // the running fiber's context when it flushes, so a peer of `UnitOfWork` below
  // reaches it — and one instance is what keeps a subscriber notified.
  Layer.provide([CommandBusLive, QueryBusLive, UnhandledFailuresLive]),
  // Merged, not provided: the buses route through these, and so do the outbound ACL
  // adapters above, which name the module they reach rather than the bus.
  Layer.provideMerge(application.layer),
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
  Layer.provide(DatabaseLive),
  Layer.provide(TracerLive),
  Layer.provide(EnvVars.layer),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3001 })),
);

Layer.launch(HttpLive).pipe(
  Effect.tapCause(Effect.logError),
  Effect.retry({
    // A database that isn't accepting connections yet — the compose race on a
    // cold boot. The pool reports it as a retryable `SqlError`; a pool that dies
    // later surfaces per-request as `DatabaseUnavailable` (503) instead of
    // taking the process down, and node-postgres reconnects on the next acquire.
    while: (error: unknown) => isSqlError(error) && error.isRetryable,
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
