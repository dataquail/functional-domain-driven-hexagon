import * as Effect from "effect/Effect";
import { SqlClient } from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient;

  yield* sql`
    ALTER TABLE "auth"."auth_identities" ALTER COLUMN "provider" SET DEFAULT 'better-auth'
  `;
});
