import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Database } from "@org/database/index";
import * as dotenv from "dotenv";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import { purgeExpiredSessions } from "./jobs/purge-expired-sessions.js";

dotenv.config({ path: "../../.env" });

const DatabaseLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const url = yield* Config.redacted("DATABASE_URL");
    const env = yield* Config.literal(
      "dev",
      "prod",
      "staging",
    )("ENV").pipe(Config.withDefault("dev"));
    return Database.layer({ url, ssl: env === "prod" });
  }),
);

// Hourly at minute 0 — sessions are sub-hour-relevant only insofar as the
// auth middleware rejects expired rows on read regardless of physical purge.
// The point of the job is keeping the table bounded, not enforcing TTL.
const hourlyAtTopOfHour = Schedule.cron("0 * * * *");

// One run on boot, then on the cron schedule. Without the eager first run a
// freshly-deployed jobs container sits idle until the next top-of-hour
// boundary — fine, but reduces operational confidence on rollout.
//
// `purgeExpiredSessions` already has `Effect.orDie` on the DB call, so
// expected DB errors become defects. Wrap the per-tick run with
// `catchAllCause` so a single tick's panic logs but doesn't end the loop —
// the next cron fire gets a fresh attempt. Lost-connection errors propagate
// via the Database layer's release and crash the process; the orchestrator
// is expected to restart it.
const safeRun = purgeExpiredSessions.pipe(
  Effect.catchAllCause((cause) =>
    Effect.logError("[jobs.purge-expired-sessions] iteration failed", cause),
  ),
);

const program = Effect.gen(function* () {
  yield* Effect.logInfo("[jobs] starting; first run immediate, subsequent runs hourly");
  yield* safeRun;
  yield* Effect.repeat(safeRun, hourlyAtTopOfHour);
});

program.pipe(Effect.provide(DatabaseLive), NodeRuntime.runMain());
