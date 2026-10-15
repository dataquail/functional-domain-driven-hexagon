import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Neon from "alchemy/Neon";
import * as Output from "alchemy/Output";
import * as Config from "effect/Config";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

import { kindOfStage, PREVIEW_PARENT_STAGE, previewBranchExpiresAt } from "../stage";

type DatabaseSpec = {
  readonly neonProject: string;
  readonly hyperdrive: string;
  readonly dockerUrlVariable: string;
};

// The Workers that query Neon are placed beside it (workers.ts).
const NEON_REGION = "aws-us-east-2";

// Compute ceilings, in Neon compute units: the most a runaway load can cost.
const LONG_LIVED_MAX_CU = 2;
const PREVIEW_MAX_CU = 0.5;
const MIN_CU = 0.25;

// The app relies on read-your-writes, so Hyperdrive must never answer a query from its cache.
const NO_CACHING = { disabled: true };

const NeonEndpoints = Schema.Struct({
  endpoints: Schema.Array(Schema.Struct({ id: Schema.String, type: Schema.String })),
});

const neonApi = Effect.fn("neonApi")(function* (path: string) {
  const key = yield* Config.Redacted("NEON_API_KEY");

  return HttpClientRequest.make("GET")(`https://console.neon.tech/api/v2${path}`).pipe(
    HttpClientRequest.bearerToken(Redacted.value(key)),
    HttpClientRequest.acceptJson,
  );
});

// Neon.Project creates its default branch's compute without autoscaling props,
// so the ceiling is applied to that endpoint once the project exists.
const CapDefaultEndpoint = Alchemy.Action(
  "NeonDefaultEndpointCap",
  Effect.fn("capDefaultEndpoint")(function* (input: {
    projectId: string;
    branchId: string;
    maxCu: number;
  }) {
    const client = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk);

    const list = yield* neonApi(
      `/projects/${input.projectId}/branches/${input.branchId}/endpoints`,
    );

    const { endpoints } = yield* client
      .execute(list)
      .pipe(Effect.flatMap(HttpClientResponse.schemaBodyJson(NeonEndpoints)));

    for (const endpoint of endpoints.filter(({ type }) => type === "read_write")) {
      const update = yield* neonApi(`/projects/${input.projectId}/endpoints/${endpoint.id}`);
      yield* client.execute(
        update.pipe(
          HttpClientRequest.setMethod("PATCH"),
          HttpClientRequest.bodyJsonUnsafe({
            endpoint: { autoscaling_limit_min_cu: MIN_CU, autoscaling_limit_max_cu: input.maxCu },
          }),
        ),
      );
    }

    return { maxCu: input.maxCu };
  }, Effect.provide(FetchHttpClient.layer)),
);

const neonDatabase = Effect.fn("neonDatabase")(function* (neonProject: string) {
  const { stage } = yield* Alchemy.Stack;

  if (kindOfStage(stage) === "long-lived") {
    const project = yield* Neon.Project(neonProject, { region: NEON_REGION }).pipe(
      Alchemy.RemovalPolicy.retain(),
    );

    yield* CapDefaultEndpoint(`${neonProject}-compute-cap`, {
      projectId: project.projectId,
      branchId: project.defaultBranchId,
      maxCu: LONG_LIVED_MAX_CU,
    });

    return project;
  }

  const parent = yield* Neon.Project.ref(neonProject, { stage: PREVIEW_PARENT_STAGE });

  return yield* Neon.Branch(`${neonProject}-preview`, {
    project: parent,
    initSource: "schema-only",
    expiresAt: previewBranchExpiresAt(yield* DateTime.now),
    endpoints: [
      { type: "read_write", autoscalingLimitMinCu: MIN_CU, autoscalingLimitMaxCu: PREVIEW_MAX_CU },
    ],
  });
});

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
