import { assertTestDatabaseConfigured, runMigrations } from "./test-database.js";

// Vitest expects globalSetup to default-export a function.
// eslint-disable-next-line no-restricted-syntax
export default async function globalSetup(): Promise<void> {
  // Integration mode must fail — never skip — when there's no database.
  // Assert the URL is set, then let `runMigrations` connect (it throws if the
  // database is unreachable), so a missing or dead DB aborts the whole run.
  if (process.env.TEST_INTEGRATION === "true") {
    assertTestDatabaseConfigured();
  }
  await runMigrations();
}
