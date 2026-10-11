import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Neon from "alchemy/Neon";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import PlaceholderWorker from "./src/platform/worker/placeholder.js";
import { appDatabase, identityDatabase } from "./src/stack/databases.js";
import { domainEventsDeadLetterQueue, domainEventsQueue } from "./src/stack/queues.js";
import { identityWorker } from "./src/stack/workers.js";

const stateStore = Layer.unwrap(
  Effect.gen(function* () {
    const { dev } = yield* Alchemy.AlchemyContext;
    return dev ? Alchemy.localState() : Cloudflare.state();
  }),
);

export default Alchemy.Stack(
  "hexagon",
  {
    providers: Cloudflare.providers().pipe(Layer.provideMerge(Neon.providers())),
    state: stateStore,
  },
  Effect.gen(function* () {
    const app = yield* appDatabase;
    const identity = yield* identityDatabase;
    const domainEvents = yield* domainEventsQueue;
    const domainEventsDeadLetter = yield* domainEventsDeadLetterQueue;
    const placeholder = yield* PlaceholderWorker;
    const identityAuth = yield* identityWorker;
    return {
      appHyperdriveId: app.hyperdriveId,
      identityHyperdriveId: identity.hyperdriveId,
      domainEventsQueue: domainEvents.queueName,
      domainEventsDeadLetterQueue: domainEventsDeadLetter.queueName,
      placeholderUrl: placeholder.url,
      identityUrl: identityAuth.url,
    };
  }),
);
