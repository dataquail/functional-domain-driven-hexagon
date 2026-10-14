#!/usr/bin/env node
// Seeds the local stack's identity: registers the app as a trusted OIDC client
// of the identity Worker, creates the admin there with a verified email, and
// records them in the app database as a super-admin. Idempotent.
//
// Needs the identity Worker running (`pnpm dev`, or a deployed stage) and the
// app database migrated (`pnpm db:migrate`). Reads the repo's .env when there
// is one. Run through tsx, which loads the identity package's TypeScript seed
// client.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

import { readEnv } from "./lib/env-file.mjs";
import {
  appClientFromEnv,
  assertIdentityReachable,
  recordSuperAdmin,
  seedIdentityUsers,
} from "../packages/identity/src/seed/seed-client.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
// A deploy pipeline has no .env; its environment carries every value.
const ENV_FILE = join(ROOT, ".env");
const env = { ...(existsSync(ENV_FILE) ? readEnv(ENV_FILE) : {}), ...process.env };

const admin = {
  email: env.IDENTITY_ADMIN_EMAIL || "admin@example.com",
  password: env.IDENTITY_ADMIN_PASSWORD || "ChangeMe!1",
  name: "Admin",
};

await assertIdentityReachable(env);
const [seeded] = await seedIdentityUsers({ env, client: appClientFromEnv(env), users: [admin] });

const database = new pg.Client({ connectionString: env.DATABASE_URL });
await database.connect();
try {
  await recordSuperAdmin(database, seeded);
} finally {
  await database.end();
}

console.log(`✓ ${admin.email} can sign in as a super-admin (subject ${seeded.subject}).`);
