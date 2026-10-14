import * as Effect from "effect/Effect";
import { SqlClient } from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient;

  yield* sql`
    CREATE TABLE "platform"."mail_daily_counts" (
      "day" date PRIMARY KEY,
      "sent" integer NOT NULL CHECK ("sent" >= 0)
    )
  `;
});
