import * as PgClient from "@effect/sql-pg/PgClient";
import type * as Layer from "effect/Layer";
import type * as Redacted from "effect/Redacted";
import type { SqlClient } from "effect/unstable/sql/SqlClient";
import type { SqlError } from "effect/unstable/sql/SqlError";
import { types as PgTypes } from "pg";

// The one file that knows which driver is underneath. Nothing here is re-exported
// from the package barrel — consumers reach the database through `Database`.

export type Config = {
  url: Redacted.Redacted;
  ssl: boolean;
};

// node-postgres reads int8 as a string. `wallet.wallets.balance` is the only
// bigint column and its row schema declares a number, so parse it as one and
// accept the precision loss above 2^53.
const int8AsNumber = {
  getTypeParser: ((oid: number, format?: unknown) =>
    oid === PgTypes.builtins.INT8
      ? Number
      : (PgTypes.getTypeParser as (o: number, f?: unknown) => unknown)(
          oid,
          format,
        )) as typeof PgTypes.getTypeParser,
};

export const driverLayer = (config: Config): Layer.Layer<PgClient.PgClient | SqlClient, SqlError> =>
  PgClient.layer({
    url: config.url,
    ssl: config.ssl ? { rejectUnauthorized: true } : undefined,
    types: int8AsNumber,
  });
