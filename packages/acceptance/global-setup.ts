import { assertIdentityReachable } from "@org/identity/seed/seed-client";

import { seedAdmin } from "./test-utils/admin-seed";
import { runMigrations } from "./test-utils/database";
import { seedMember } from "./test-utils/member-seed";

// Runs once before specs (and before the setup projects):
//   1. Drop+replay migrations against the test DB so the API server boots
//      into a known schema.
//   2. Seed the admin and the member through the identity Worker, which
//      `pnpm dev:cf` must be serving. The admin is also recorded in the test
//      DB as a super-admin; the member provisions itself on first sign-in.
export default async (): Promise<void> => {
  const databaseUrl =
    process.env.DATABASE_URL_TEST ??
    "postgresql://postgres:postgres@localhost:5432/effect-monorepo-test";
  await runMigrations(databaseUrl);

  await assertIdentityReachable(process.env);
  await seedAdmin(databaseUrl);
  await seedMember();
};
