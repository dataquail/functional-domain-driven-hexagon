import { runMigrations } from "./test-database.js";

// Vitest expects globalSetup to default-export a function.
// eslint-disable-next-line no-restricted-syntax
export default async function globalSetup(): Promise<void> {
  await runMigrations();
}
