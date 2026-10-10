import * as Cloudflare from "alchemy/Cloudflare";
import * as SQL from "alchemy/SQL/Postgres";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Schema from "effect/Schema";

import { appDatabase } from "../../stack/databases.js";

const SelectOneRows = Schema.Array(
  Schema.Struct({ one: Schema.Literal(1), database: Schema.String }),
);

export default class PlaceholderWorker extends Cloudflare.Worker<PlaceholderWorker>()(
  "placeholder",
  { main: import.meta.url },
  Effect.gen(function* () {
    const hyperdrive = yield* Cloudflare.Hyperdrive.Connect(appDatabase);
    const sql = yield* SQL.Postgres({ url: hyperdrive.connectionString });
    return {
      fetch: Effect.gen(function* () {
        const rows = yield* sql`SELECT 1 AS one, current_database() AS database`;
        return yield* HttpServerResponse.json(
          yield* Schema.decodeUnknownEffect(SelectOneRows)(rows),
        );
      }).pipe(
        Effect.catchCause((cause) =>
          HttpServerResponse.json({ error: Cause.pretty(cause) }, { status: 500 }),
        ),
      ),
    };
  }).pipe(Effect.provide(Cloudflare.Hyperdrive.ConnectBinding)),
) {}
