import * as Alchemy from "alchemy";
import * as Neon from "alchemy/Neon";
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

// Each stack places its compute beside this region.
const NEON_REGION = "aws-us-east-2";

// Compute ceilings, in Neon compute units: the most a runaway load can cost.
const LONG_LIVED_MAX_CU = 2;
const PREVIEW_MAX_CU = 0.5;
const MIN_CU = 0.25;

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

export const neonDatabase = Effect.fn("neonDatabase")(function* (neonProject: string) {
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
