import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient;

  yield* sql`
    CREATE TABLE "auth"."auth_identities" (
      "subject" varchar(128) PRIMARY KEY,
      "user_id" uuid NOT NULL REFERENCES "user"."users"("id") ON DELETE CASCADE,
      "provider" varchar(32) NOT NULL DEFAULT 'zitadel',
      "created_at" timestamp with time zone NOT NULL DEFAULT now()
    )
  `;

  yield* sql`
    CREATE INDEX "auth_identities_user_id_idx" ON "auth"."auth_identities"("user_id")
  `;
});
