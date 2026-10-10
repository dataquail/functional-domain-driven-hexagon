import * as Effect from "effect/Effect";
import { SqlClient } from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient;

  // One row per event per named after-commit subscription, written inside the
  // publisher's transaction. `relayed_at` stays null until the envelope has
  // been handed on; the sweeper re-flushes what is still null.
  yield* sql`
    CREATE TABLE "platform"."event_outbox" (
      "event_id" uuid NOT NULL,
      "handler" text NOT NULL,
      "tag" text NOT NULL,
      "payload" jsonb NOT NULL,
      "occurred_at" timestamp with time zone NOT NULL,
      "relayed_at" timestamp with time zone,
      "attempts" integer NOT NULL DEFAULT 0,
      "last_attempted_at" timestamp with time zone,
      PRIMARY KEY ("event_id", "handler")
    )
  `;

  yield* sql`
    CREATE INDEX "event_outbox_unrelayed_idx" ON "platform"."event_outbox"("occurred_at")
    WHERE "relayed_at" IS NULL
  `;

  // Committed in the same transaction as a delivered handler's own writes, so a
  // redelivered envelope finds its row and runs nothing.
  yield* sql`
    CREATE TABLE "platform"."event_deliveries" (
      "event_id" uuid NOT NULL,
      "handler" text NOT NULL,
      "delivered_at" timestamp with time zone NOT NULL DEFAULT now(),
      PRIMARY KEY ("event_id", "handler")
    )
  `;
});
