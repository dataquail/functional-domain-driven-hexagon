import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { type UserAuthMiddleware } from "@org/contracts/Policy";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as Layer from "effect/Layer";

import { CookieCodec } from "@/globals/infrastructure/auth/cookie-codec";
import { EnvVars } from "@/globals/infrastructure/config/env-vars";
import {
  AfterCommitTransportLive,
  CommandBusLive,
  DomainEventBusLive,
  DomainEventDeliveryLive,
  QueryBusLive,
  UnhandledFailuresLive,
  UnitOfWorkLive,
} from "@/globals/infrastructure/cqrs/cqrs-runtime";
import { DeliveryLedgerLive } from "@/globals/infrastructure/events/delivery-ledger-live";
import { Api } from "@/globals/infrastructure/framework/http/api";
import { applicationModules } from "@/globals/infrastructure/framework/modules/application-modules";
import { BillingGatewayFake } from "@/modules/billing/billing.platform";
import {
  UserAuthMiddlewareFake,
  UserAuthMiddlewareFakeAsMember,
} from "@/test-utils/fake-auth-middleware";
import { TestDatabaseLive } from "@/test-utils/test-database";
import { InMemoryHttpServerLive } from "@/test-utils/test-http-server";

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
  // Same v4 shape as the Worker entrypoint: `HttpApiBuilder.layer` registers the group
  // handlers + the auth middleware (build-time — the groups declare
  // `.middleware(UserAuthMiddleware)`); the handlers' runtime deps are
  // request-scoped and close post-serve below.
  const ApiLive = HttpApiBuilder.layer(Api).pipe(
    Layer.provide(application.http),
    Layer.provide(authMiddleware),
  );

  // `HttpRouter.serve` binds the app to an in-memory server (no port, no
  // network) and unwraps the endpoints' request-scoped
  // requirements into plain ones, satisfied here in the same dependency order
  // as the Worker's. `CommandBus`/`QueryBus`/`Database`/`HttpClient` are kept in
  // the runtime's SUCCESS channel via `provideMerge` so integration tests can
  // `yield* CommandBus`/`QueryBus`, `yield* HttpApiClient.make(Api)`, and drive
  // the DB directly.
  return HttpRouter.serve(ApiLive).pipe(
    // The application's request-scoped services, which `serve` unwrapped into
    // plain requirements — attached at the assembled api layer because that is the
    // only point that can satisfy one. Their deps (EnvVars, etc.) close below.
    Layer.provide(application.httpDeps),
    Layer.provideMerge(application.events),
    Layer.provideMerge(Layer.mergeAll(CommandBusLive, QueryBusLive, UnhandledFailuresLive)),
    Layer.provide(DomainEventDeliveryLive),
    Layer.provideMerge(application.layer),
    // Below the dispatchers and merged, not provided: every dispatcher needs these
    // too (`handlersOf` hoists its handlers' requirements), and one layer value in
    // one place keeps it one instance.
    Layer.provideMerge(
      Layer.mergeAll(
        DomainEventBusLive,
        UnitOfWorkLive,
        AfterCommitTransportLive,
        DeliveryLedgerLive,
      ),
    ),
    Layer.provide([CookieCodec.layer, BillingGatewayFake, NodeCrypto.layer]),
    Layer.provideMerge(TestDatabaseLive),
    Layer.provide(EnvVars.layer),
    Layer.provideMerge(InMemoryHttpServerLive),
  );
};

// Default — super-admin caller. Every existing integration test consumes this.
export const TestServerLive = makeTestServerLive(UserAuthMiddlewareFake);

// Non-super-admin caller. 403-Forbidden tests for super-admin-only
// endpoints consume this via `useServerTestRuntime(tables, { server: ... })`.
export const TestServerLiveAsMember = makeTestServerLive(UserAuthMiddlewareFakeAsMember);
