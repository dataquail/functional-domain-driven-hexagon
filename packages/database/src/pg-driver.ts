import * as PgClient from "@effect/sql-pg/PgClient";
import * as PgTypes from "@effect/sql-pg/PgTypes";
import type * as Layer from "effect/Layer";
import type * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import type { SqlClient } from "effect/sql/SqlClient";
import type { SqlError } from "effect/sql/SqlError";

// The one file that knows which driver is underneath. Nothing here is re-exported
// from the package barrel — consumers reach the database through `Database`.

export type Config = {
  url: Redacted.Redacted;
  ssl: boolean;
};

const INT8_BYTES = 8;

// The driver reads int8 as a bigint. `wallet.wallets.balance` is the only
// bigint column and its row schema declares a number, so read it as one and
// accept the precision loss above 2^53.
const int8AsNumber: PgTypes.Codec<number | bigint> = {
  encode: (value) => {
    const bytes = new Uint8Array(INT8_BYTES);
    new DataView(bytes.buffer).setBigInt64(0, BigInt(value));
    return Result.succeed(bytes);
  },
  decode: (bytes) =>
    bytes.length === INT8_BYTES
      ? Result.succeed(
          Number(new DataView(bytes.buffer, bytes.byteOffset, INT8_BYTES).getBigInt64(0)),
        )
      : Result.fail(new PgTypes.CodecError({ message: `int8 needs 8 bytes, got ${bytes.length}` })),
};

const makeTypes = (): PgTypes.Registry => {
  const registry = PgTypes.makeRegistry();
  registry.register(PgTypes.OID.int8, int8AsNumber, { arrayOid: PgTypes.OID.int8Array });
  return registry;
};

// The driver infers an array parameter's type from its elements, so an empty
// one cannot be sent without naming the element type.
const typedArray =
  (elementOid: number) =>
  (values: ReadonlyArray<string>): PgTypes.Parameter =>
    Result.getOrThrow(PgTypes.array(values, elementOid));

export const textArray = typedArray(PgTypes.OID.text);
export const uuidArray = typedArray(PgTypes.OID.uuid);

export const driverLayer = (config: Config): Layer.Layer<PgClient.PgClient | SqlClient, SqlError> =>
  PgClient.layer({
    url: config.url,
    ssl: config.ssl ? { rejectUnauthorized: true } : undefined,
    types: makeTypes(),
  });
