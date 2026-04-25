import { Api } from "@/api.js";
import { userCommandHandlers, UserModuleLive, userQueryHandlers } from "@/modules/user/index.js";
import { WalletModuleLive } from "@/modules/wallet/index.js";
import { CommandBus, makeCommandBus } from "@/platform/command-bus.js";
import { DomainEventBusLive } from "@/platform/domain-event-bus.js";
import { UserAuthMiddlewareLive } from "@/platform/middlewares/auth-middleware-live.js";
import { makeQueryBus, QueryBus } from "@/platform/query-bus.js";
import { SseModuleLive } from "@/public/sse/index.js";
import { TodosModuleLive } from "@/public/todos/index.js";
import { TestDatabaseLive } from "@/test-utils/test-database.js";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder";
import * as Layer from "effect/Layer";

const CommandBusLive = Layer.succeed(CommandBus, makeCommandBus({ ...userCommandHandlers }));
const QueryBusLive = Layer.succeed(QueryBus, makeQueryBus({ ...userQueryHandlers }));

const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide([TodosModuleLive, SseModuleLive, UserModuleLive, WalletModuleLive]),
  Layer.provide([UserAuthMiddlewareLive, DomainEventBusLive, CommandBusLive, QueryBusLive]),
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
