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
} from "./src/stack/databases";
import { edge } from "./src/stack/edge";
import { stageUrls } from "./src/stack/hosts";
import { stackProviders } from "./src/stack/providers";
import { domainEventsDeadLetterQueue, domainEventsQueue } from "./src/stack/queues";
import { identityWorker, serverWorker, webWorker } from "./src/stack/workers";
import { presentEntry } from "./src/stage";

// The direct (unpooled) URLs the deploy pipeline migrates and seeds through; a dev stack has none.
const directDatabaseUrls = Effect.gen(function* () {
  if (yield* Alchemy.ALCHEMY_DEV) return {};

  return {
    DATABASE_URL: yield* appDatabaseDirectUrl,
    IDENTITY_DATABASE_URL: yield* identityDatabaseDirectUrl,
  };
});

const stateStore = Layer.unwrap(
  Effect.gen(function* () {
    const { dev } = yield* Alchemy.AlchemyContext;

    if (dev) return Alchemy.localState();

    return Cloudflare.state();
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
    const { IDENTITY_POST_LOGOUT_REDIRECT_URI, IDENTITY_REDIRECT_URI, ...urls } = yield* stageUrls;

    // Outputs named like environment variables are what the deploy pipeline
    // exports to its migrate, seed and acceptance steps (scripts/stage-env.mjs).
    return {
      ...urls,
      ...presentEntry(IDENTITY_POST_LOGOUT_REDIRECT_URI, (url) => ({
        IDENTITY_POST_LOGOUT_REDIRECT_URI: url,
      })),
      ...presentEntry(IDENTITY_REDIRECT_URI, (url) => ({ IDENTITY_REDIRECT_URI: url })),
      ...(yield* directDatabaseUrls),
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
      webUrl: web.url,
    };
  }),
);
