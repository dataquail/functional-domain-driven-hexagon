import { assertIdentityReachable } from "@org/identity/seed/seed-client";

import { seedAdmin } from "./test-utils/admin-seed";
import { runMigrations } from "./test-utils/database";
import { seedMember } from "./test-utils/member-seed";
import { acceptanceTarget } from "./test-utils/target";

// A local run replays the migrations into the test database; a deployed
// preview stage was migrated by the pipeline before the suite started.
export default async (): Promise<void> => {
  const target = acceptanceTarget();
  if (target.kind === "local") await runMigrations(target);

  await assertIdentityReachable(process.env);
  await seedAdmin(target);
  await seedMember();
};
