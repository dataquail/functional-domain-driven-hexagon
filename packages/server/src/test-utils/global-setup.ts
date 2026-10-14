import * as Effect from "effect/Effect";

import { migrateTestDatabase } from "./test-database";

// Vitest expects globalSetup to default-export a function. Integration mode
// migrates, and fails the whole run when the database is unset or unreachable.
export default async function globalSetup(): Promise<void> {
  if (process.env.TEST_INTEGRATION === "true") {
    await Effect.runPromise(migrateTestDatabase);
  }
}
