import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { hasTestDatabase } from "@/test-utils/test-database.js";

const NameRowStd = Schema.standardSchemaV1(Schema.Struct({ name: Schema.String }));

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("POST /orgs (integration)", () => {
  const { run } = useServerTestRuntime(["organization.organizations"]);

  it("creates an org and returns its id", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id } = yield* client.organization.create({ payload: { name: "Acme" } });
        ok(typeof id === "string" && id.length > 0);

        const db = yield* Database.Database;
        const rows = yield* db
          .execute((c) =>
            c.any(sql.type(NameRowStd)`
              SELECT name FROM "organization".organizations WHERE id = ${id}
            `),
          )
          .pipe(Effect.orDie);
        deepStrictEqual(
          rows.map((r) => r.name),
          ["Acme"],
        );
      }),
    );
  });
});
