import {
  appClientFromEnv,
  recordSuperAdmin,
  seedIdentityUsers,
} from "@org/identity/seed/seed-client";
import pg from "pg";

import { ADMIN_EMAIL, ADMIN_PASSWORD } from "./admin-credentials";
import { releasingAfter } from "./database";
import { type AcceptanceTarget } from "./target";

const noSeededUser = (): never => {
  throw new Error("[acceptance/admin-seed] the seed returned no user");
};

// Seeds the admin through the identity Worker (registering the app's client
// on the way) and records them in the target's database as a super-admin, so the
// first sign-in finds an existing identity instead of provisioning an ordinary
// user.
export const seedAdmin = async (target: AcceptanceTarget): Promise<void> => {
  const [seeded] = await seedIdentityUsers({
    env: process.env,
    client: appClientFromEnv(process.env),
    users: [{ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: "Admin" }],
  });

  const user = seeded ?? noSeededUser();
  const database = new pg.Client({ connectionString: target.databaseUrl });
  await database.connect();
  await releasingAfter(
    () => recordSuperAdmin(database, user),
    () => database.end(),
  );
};
