import { Api } from "@/api.js";
import { todoCommandHandlers, todoQueryHandlers, TodosModuleLive } from "@/modules/todos/index.js";
import {
  userCommandHandlers,
  userEventSpanAttributes,
  UserModuleLive,
  userQueryHandlers,
} from "@/modules/user/index.js";
import { walletEventSpanAttributes, WalletModuleLive } from "@/modules/wallet/index.js";
import { CommandBus, makeCommandBus } from "@/platform/command-bus.js";
import { makeDomainEventBusLive } from "@/platform/domain-event-bus.js";
import { UserAuthMiddlewareLive } from "@/platform/middlewares/auth-middleware-live.js";
import { makeQueryBus, QueryBus } from "@/platform/query-bus.js";
import { SseHttpLive } from "@/platform/sse-http-live.js";
import { SseManager } from "@/platform/sse-manager.js";
import { TransactionRunnerLive } from "@/platform/transaction-runner.js";
import { TestDatabaseLive } from "@/test-utils/test-database.js";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder";
import * as Layer from "effect/Layer";

const CommandBusLive = Layer.succeed(
  CommandBus,
  makeCommandBus({ ...userCommandHandlers, ...todoCommandHandlers }),
);
const QueryBusLive = Layer.succeed(
  QueryBus,
  makeQueryBus({ ...userQueryHandlers, ...todoQueryHandlers }),
);
const DomainEventBusLive = makeDomainEventBusLive({
  spanAttributes: { ...userEventSpanAttributes, ...walletEventSpanAttributes },
});

const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide([TodosModuleLive, SseHttpLive, UserModuleLive, WalletModuleLive]),
  Layer.provide([
    UserAuthMiddlewareLive,
    DomainEventBusLive,
    CommandBusLive,
    QueryBusLive,
    TransactionRunnerLive,
    SseManager.Default,
  ]),
);

// layerTest binds the server to an in-memory transport and exposes an
// HttpClient wired to it — no port, no network hop. provideMerge (instead
// of provide) keeps HttpClient + Database reachable in the test runtime so
// tests can `yield* HttpApiClient.make(Api)` and drive the DB directly.
export const TestServerLive = HttpApiBuilder.serve().pipe(
  Layer.provide(ApiLive),
  Layer.provideMerge(TestDatabaseLive),
  Layer.provideMerge(NodeHttpServer.layerTest),
);
