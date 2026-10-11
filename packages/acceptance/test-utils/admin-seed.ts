import {
  appClientFromEnv,
  recordSuperAdmin,
  seedIdentityUsers,
} from "@org/identity/seed/seed-client";
import pg from "pg";

import { ADMIN_EMAIL, ADMIN_PASSWORD } from "./admin-credentials";

// Seeds the admin through the identity Worker (registering the app's client
// on the way) and records them in the TEST database as a super-admin, so the
// first sign-in finds an existing identity instead of provisioning an ordinary
// user.
export const seedAdmin = async (databaseUrl: string): Promise<void> => {
  const [seeded] = await seedIdentityUsers({
    env: process.env,
    client: appClientFromEnv(process.env),
    users: [{ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: "Admin" }],
  });
  if (seeded === undefined) throw new Error("[acceptance/admin-seed] the seed returned no user");
  const database = new pg.Client({ connectionString: databaseUrl });
  await database.connect();
  try {
    await recordSuperAdmin(database, seeded);
  } finally {
    await database.end();
  }
};
