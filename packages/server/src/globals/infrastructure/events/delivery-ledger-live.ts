import { DeliveryLedger } from "@effect-server-utils/unit-of-work";
import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { translateDatabaseErrors } from "@/globals/infrastructure/database/translate-database-errors.js";

export const DeliveryLedgerLive: Layer.Layer<DeliveryLedger, never, Database.Database> =
  Layer.effect(
    DeliveryLedger,
    Effect.gen(function* () {
      const sql = yield* Database.Database;
      return DeliveryLedger.of({
        claim: (eventId, handler) =>
          sql`
            INSERT INTO platform.event_deliveries (event_id, handler)
            VALUES (${eventId}, ${handler})
            ON CONFLICT DO NOTHING
            RETURNING event_id
          `.pipe(
            Database.mapSqlError,
            Effect.map((claimed) => claimed.length === 1),
            translateDatabaseErrors,
          ),
      });
    }),
  );
