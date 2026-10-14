import { getMigrations } from "better-auth/db/migration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type { Pool } from "pg";

import { MAIL_DAILY_COUNTS_TABLE } from "../mail/daily-capped-mailer.js";
import { MailDeliveryError } from "../mail/identity-mailer.js";
import { identityAuthFor } from "./identity-auth.js";

// Migrations read the schema Better Auth derives from its options; nothing here signs or sends.
const schemaOnlySettings = (database: Pool) => ({
  baseUrl: "http://identity.invalid",
  secret: "c2NoZW1hLW9ubHk6IG1pZ3JhdGlvbnMgc2lnbiBhbmQgc2VuZCBub3RoaW5n",
  appUrl: "http://app.invalid",
  database,
  mailer: { send: () => new MailDeliveryError({ message: "Migrations send no email" }) },
  runInBackground: Option.none(),
  registerClientAs: Option.none(),
});

export const migrateIdentityDatabase = Effect.fn("migrateIdentityDatabase")(function* (
  database: Pool,
) {
  const auth = identityAuthFor(schemaOnlySettings(database));

  const { runMigrations, toBeAdded, toBeCreated } = yield* Effect.promise(() =>
    getMigrations(auth.options),
  );

  yield* Effect.promise(() => runMigrations());
  yield* Effect.promise(() => database.query(MAIL_DAILY_COUNTS_TABLE));

  return [...toBeCreated, ...toBeAdded].map((table) => table.table);
});
