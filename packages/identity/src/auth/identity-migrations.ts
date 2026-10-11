import { getMigrations } from "better-auth/db/migration";
import * as Effect from "effect/Effect";
import type { Pool } from "pg";

import { MailDeliveryError } from "../mail/identity-mailer.js";
import { makeIdentityAuth } from "./identity-auth.js";

// Migrations read the schema Better Auth derives from its options; nothing here signs or sends.
const schemaOnlySettings = (database: Pool) => ({
  baseUrl: "http://identity.invalid",
  secret: "c2NoZW1hLW9ubHk6IG1pZ3JhdGlvbnMgc2lnbiBhbmQgc2VuZCBub3RoaW5n",
  appUrl: "http://app.invalid",
  database,
  mailer: { send: () => new MailDeliveryError({ message: "Migrations send no email" }) },
});

export const migrateIdentityDatabase = Effect.fn("migrateIdentityDatabase")(function* (
  database: Pool,
) {
  const auth = makeIdentityAuth(schemaOnlySettings(database));
  const { runMigrations, toBeAdded, toBeCreated } = yield* Effect.promise(() =>
    getMigrations(auth.options),
  );
  yield* Effect.promise(() => runMigrations());
  return [...toBeCreated, ...toBeAdded].map((table) => table.table);
});
