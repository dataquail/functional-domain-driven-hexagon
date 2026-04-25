import { runMigrations } from "./test-database.js";

// Vitest expects globalSetup to default-export a function. The eslint rule
// prefers named exports, but the framework contract overrides that here.
// eslint-disable-next-line no-restricted-syntax
export default async function globalSetup(): Promise<void> {
  await runMigrations();
}
