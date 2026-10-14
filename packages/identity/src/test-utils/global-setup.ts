import * as Effect from "effect/Effect";

import { prepareIdentityTestDatabase } from "./identity-test-database.js";

// Vitest expects globalSetup to default-export a function.
export default async function globalSetup(): Promise<void> {
  if (process.env.TEST_INTEGRATION !== "true") return;
  await Effect.runPromise(prepareIdentityTestDatabase);
}
