import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Neon from "alchemy/Neon";
import * as Config from "effect/Config";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

import { kindOfStage, PREVIEW_PARENT_STAGE, previewBranchExpiresAt } from "../stage.js";

type DatabaseSpec = {
  readonly neonProject: string;
  readonly hyperdrive: string;
  readonly dockerUrlVariable: string;
};

// The app relies on read-your-writes, so Hyperdrive must never answer a query from its cache.
const NO_CACHING = { disabled: true };

const neonOrigin = Effect.fn(function* (neonProject: string) {
  const { stage } = yield* Alchemy.Stack;
  if (kindOfStage(stage) === "long-lived") {
    const project = yield* Neon.Project(neonProject).pipe(Alchemy.RemovalPolicy.retain());
    return project.origin;
  }
  const parent = yield* Neon.Project.ref(neonProject, { stage: PREVIEW_PARENT_STAGE });
  const branch = yield* Neon.Branch(`${neonProject}-preview`, {
    project: parent,
    initSource: "schema-only",
    expiresAt: previewBranchExpiresAt(yield* DateTime.now),
  });
  return branch.origin;
});

const dockerOrigin = Effect.fn(function* (variable: string) {
  const url = yield* Config.Redacted(variable);
  return Neon.parsePostgresOrigin(Redacted.value(url));
});

const database = Effect.fn(function* (spec: DatabaseSpec) {
  const { dev } = yield* Alchemy.AlchemyContext;
  if (dev) {
    const origin = yield* dockerOrigin(spec.dockerUrlVariable);
    return yield* Cloudflare.Hyperdrive.Connection(spec.hyperdrive, {
      origin,
      caching: NO_CACHING,
      dev: { ...origin, sslmode: "disable" },
    });
  }
  return yield* Cloudflare.Hyperdrive.Connection(spec.hyperdrive, {
    origin: yield* neonOrigin(spec.neonProject),
    caching: NO_CACHING,
  });
});

export const appDatabase = database({
  neonProject: "app-db",
  hyperdrive: "app-hd",
  dockerUrlVariable: "DATABASE_URL",
});

export const identityDatabase = database({
  neonProject: "identity-db",
  hyperdrive: "identity-hd",
  dockerUrlVariable: "IDENTITY_DATABASE_URL",
});
