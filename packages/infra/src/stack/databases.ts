import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Neon from "alchemy/Neon";
import * as Output from "alchemy/Output";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

import { neonDatabase } from "./neon";

type DatabaseSpec = {
  readonly neonProject: string;
  readonly hyperdrive: string;
  readonly dockerUrlVariable: string;
};

// The app relies on read-your-writes, so Hyperdrive must never answer a query from its cache.
const NO_CACHING = { disabled: true };

const dockerOrigin = Effect.fn("dockerOrigin")(function* (variable: string) {
  const url = yield* Config.Redacted(variable);

  return Neon.parsePostgresOrigin(Redacted.value(url));
});

const database = Effect.fn("database")(function* (spec: DatabaseSpec) {
  if (yield* Alchemy.ALCHEMY_DEV) {
    const origin = yield* dockerOrigin(spec.dockerUrlVariable);

    return yield* Cloudflare.Hyperdrive.Connection(spec.hyperdrive, {
      origin,
      caching: NO_CACHING,
      dev: { ...origin, sslmode: "disable" },
    });
  }

  return yield* Cloudflare.Hyperdrive.Connection(spec.hyperdrive, {
    origin: (yield* neonDatabase(spec.neonProject)).origin,
    caching: NO_CACHING,
  });
});

// The direct (unpooled) URL the deploy pipeline migrates and seeds through.
const directUrl = Effect.fn("directUrl")(function* (neonProject: string) {
  const neon = yield* neonDatabase(neonProject);

  return neon.connectionUri.pipe(Output.map(Redacted.make));
});

const APP = { neonProject: "app-db", hyperdrive: "app-hd", dockerUrlVariable: "DATABASE_URL" };

const IDENTITY = {
  neonProject: "identity-db",
  hyperdrive: "identity-hd",
  dockerUrlVariable: "IDENTITY_DATABASE_URL",
};

export const appDatabase = database(APP);

export const identityDatabase = database(IDENTITY);

export const appDatabaseDirectUrl = directUrl(APP.neonProject);

export const identityDatabaseDirectUrl = directUrl(IDENTITY.neonProject);
