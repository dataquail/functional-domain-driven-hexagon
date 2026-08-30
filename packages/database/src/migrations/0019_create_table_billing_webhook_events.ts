import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient;

  yield* sql`
    CREATE TABLE "billing"."webhook_events" (
      "stripe_event_id" text PRIMARY KEY NOT NULL,
      "received_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `;
});
