import { Api } from "@/api.js";
import { EnvVars } from "@/common/env-vars.js";
import {
  authCommandHandlers,
  AuthModuleLive,
  authQueryHandlers,
  AuthSharedDepsLive,
} from "@/modules/auth/index.js";
import { todoCommandHandlers, todoQueryHandlers, TodosModuleLive } from "@/modules/todos/index.js";
import {
  userCommandHandlers,
  userEventSpanAttributes,
  UserModuleLive,
  userQueryHandlers,
} from "@/modules/user/index.js";
import { walletEventSpanAttributes, WalletModuleLive } from "@/modules/wallet/index.js";
import { PermissionsResolver } from "@/platform/auth/permissions-resolver.js";
import { CommandBus, makeCommandBus } from "@/platform/command-bus.js";
import { makeDomainEventBusLive } from "@/platform/domain-event-bus.js";
import { makeQueryBus, QueryBus } from "@/platform/query-bus.js";
import { TransactionRunnerLive } from "@/platform/transaction-runner.js";
import { UserAuthMiddlewareFake } from "@/test-utils/fake-auth-middleware.js";
import { TestDatabaseLive } from "@/test-utils/test-database.js";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder";
import * as Layer from "effect/Layer";

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

// `CommandBus` and `QueryBus` are cross-cutting public production APIs
// (ADR-0006) — the same dispatch surface every HTTP handler uses. Exposing
// them at the test runtime via `provideMerge` lets integration tests seed
// state and assert via the production seam without leaking module-internal
// ports (repositories) into the test runtime. The remaining services
// (UserAuthMiddleware, DomainEventBus, TransactionRunner) stay consumed by
// `Layer.provide` because they're either internal infrastructure
// (DomainEventBus, TransactionRunner) or feature-specific (auth middleware)
// and aren't meant to be driven directly from tests.
const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide([TodosModuleLive, UserModuleLive, WalletModuleLive, AuthModuleLive]),
  Layer.provide([UserAuthMiddlewareFake, DomainEventBusLive, TransactionRunnerLive]),
  // CommandBus + QueryBus must provide TO the modules above (they dispatch
  // via the buses) AND remain reachable from test runtimes — `provideMerge`
  // keeps them in the runtime context so `yield* CommandBus`/`QueryBus`
  // works in test bodies.
  Layer.provideMerge(Layer.mergeAll(CommandBusLive, QueryBusLive)),
  Layer.provide(PermissionsResolver.Default),
  Layer.provide(AuthSharedDepsLive),
  Layer.provide(EnvVars.Default),
);

// layerTest binds the server to an in-memory transport and exposes an
// HttpClient wired to it — no port, no network hop. provideMerge (instead
// of provide) keeps HttpClient + Database reachable in the test runtime so
// tests can `yield* HttpApiClient.make(Api)` and drive the DB directly.
// `provideMerge(ApiLive)` carries the bus exposure forward into the
// TestServerLive runtime context so tests can `yield* CommandBus`/`QueryBus`.
export const TestServerLive = HttpApiBuilder.serve().pipe(
  Layer.provideMerge(ApiLive),
  Layer.provideMerge(TestDatabaseLive),
  Layer.provideMerge(NodeHttpServer.layerTest),
);
