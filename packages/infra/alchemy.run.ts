import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import {
  appDatabase,
  appDatabaseDirectUrl,
  identityDatabase,
  identityDatabaseDirectUrl,
} from "./src/stack/databases.js";
import { edge } from "./src/stack/edge.js";
import { stageUrls } from "./src/stack/hosts.js";
import { stackProviders } from "./src/stack/providers.js";
import { domainEventsDeadLetterQueue, domainEventsQueue } from "./src/stack/queues.js";
import { identityWorker, serverWorker, webWorker } from "./src/stack/workers.js";

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
    const web = yield* webWorker(server);
    const zoneRules = yield* edge;
    const dev = yield* Alchemy.ALCHEMY_DEV;
    const urls = yield* stageUrls;
    return {
      appUrl: urls.APP_URL,
      identityIssuer: urls.IDENTITY_ISSUER,
      ...(dev
        ? {}
        : {
            appDatabaseUrl: yield* appDatabaseDirectUrl,
            identityDatabaseUrl: yield* identityDatabaseDirectUrl,
          }),
      ...Option.match(zoneRules, {
        onNone: () => ({}),
        onSome: ({ killSwitchEngaged }) => ({ killSwitchEngaged }),
      }),
      appHyperdriveId: app.hyperdriveId,
      identityHyperdriveId: identity.hyperdriveId,
      domainEventsQueue: domainEvents.queueName,
      domainEventsDeadLetterQueue: domainEventsDeadLetter.queueName,
      identityUrl: identityAuth.url,
      serverUrl: server.url,
      ...Option.match(web, { onNone: () => ({}), onSome: (worker) => ({ webUrl: worker.url }) }),
    };
  }),
);
