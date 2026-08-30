import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient;

  yield* sql`
    CREATE TABLE "todos"."todos" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "title" text NOT NULL,
      "completed" boolean DEFAULT false NOT NULL,
      "organization_id" uuid NOT NULL REFERENCES "organization"."organizations"("id") ON DELETE CASCADE,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `;

  yield* sql`
    CREATE INDEX "todos_organization_id_idx" ON "todos"."todos"("organization_id")
  `;
});
