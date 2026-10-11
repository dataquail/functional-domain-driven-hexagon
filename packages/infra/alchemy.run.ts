import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { appDatabase, identityDatabase } from "./src/stack/databases.js";
import { stackProviders } from "./src/stack/providers.js";
import { domainEventsDeadLetterQueue, domainEventsQueue } from "./src/stack/queues.js";
import { identityWorker, serverWorker } from "./src/stack/workers.js";

const stateStore = Layer.unwrap(
  Effect.gen(function* () {
    const { dev } = yield* Alchemy.AlchemyContext;
    return dev ? Alchemy.localState() : Cloudflare.state();
  }),
);

export default Alchemy.Stack(
  "hexagon",
  {
    providers: stackProviders,
    state: stateStore,
  },
  Effect.gen(function* () {
    const app = yield* appDatabase;
    const identity = yield* identityDatabase;
    const domainEvents = yield* domainEventsQueue;
    const domainEventsDeadLetter = yield* domainEventsDeadLetterQueue;
    const identityAuth = yield* identityWorker;
    const server = yield* serverWorker(identityAuth);
    return {
      appHyperdriveId: app.hyperdriveId,
      identityHyperdriveId: identity.hyperdriveId,
      domainEventsQueue: domainEvents.queueName,
      domainEventsDeadLetterQueue: domainEventsDeadLetter.queueName,
      identityUrl: identityAuth.url,
      serverUrl: server.url,
    };
  }),
);
