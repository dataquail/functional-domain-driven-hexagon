import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { type UserAuthMiddleware } from "@org/contracts/Policy";
import * as Layer from "effect/Layer";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { EnvVars } from "@/common/env-vars.js";
import { AuthSharedDepsLive } from "@/modules/auth/index.js";
import { BillingGatewayFake } from "@/modules/billing/index.js";
import { Api } from "@/platform/api.js";
import {
  CommandBusLive,
  DomainEventBusLive,
  QueryBusLive,
  UnhandledFailuresLive,
  UnitOfWorkLive,
} from "@/platform/cqrs/cqrs-runtime.js";
import { applicationModules } from "@/platform/modules/application-modules.js";
import {
  UserAuthMiddlewareFake,
  UserAuthMiddlewareFakeAsMember,
} from "@/test-utils/fake-auth-middleware.js";
import { TestDatabaseLive } from "@/test-utils/test-database.js";

// The same application production runs. What this root does differently is
// provide a different environment below: a test database, a fake auth
// middleware, an in-memory transport, and billing's fake gateway.
const application = applicationModules;

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
// test) get the super-admin fake.
export const makeTestServerLive = (authMiddleware: Layer.Layer<UserAuthMiddleware>) => {
  // Same v4 shape as server.ts: `HttpApiBuilder.layer` registers the group
  // handlers + the auth middleware (build-time — the groups declare
  // `.middleware(UserAuthMiddleware)`); the handlers' runtime deps are
  // request-scoped and close post-serve below.
  const ApiLive = HttpApiBuilder.layer(Api).pipe(
    Layer.provide(application.http),
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
    // The application's request-scoped services, which `serve` unwrapped into
    // plain requirements — attached at the assembled api layer because that is the
    // only point that can satisfy one. Their deps (EnvVars, etc.) close below.
    Layer.provide(application.httpDeps),
    Layer.provideMerge(Layer.mergeAll(CommandBusLive, QueryBusLive, UnhandledFailuresLive)),
    Layer.provideMerge(application.layer),
    // Below the dispatchers and merged, not provided: every dispatcher needs these
    // too (`handlersOf` hoists its handlers' requirements), and one layer value in
    // one place keeps it one instance. See server.ts.
    Layer.provideMerge(Layer.mergeAll(DomainEventBusLive, UnitOfWorkLive)),
    Layer.provide([AuthSharedDepsLive, BillingGatewayFake]),
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
