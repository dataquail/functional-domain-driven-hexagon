import { seedAdminInTestDb } from "./test-utils/admin-seed";
import { runMigrations } from "./test-utils/database";

// Runs once before specs (and before the auth-setup project). Two
// responsibilities:
//   1. Drop+replay migrations against the test DB so the API server boots
//      into a known schema.
//   2. Pre-seed the admin row (see plan §3.6 — admins don't JIT-provision)
//      by looking up the admin's Zitadel `sub` and INSERTing
//      `users` + `auth_identities` rows. This makes the real OIDC `SignIn`
//      command succeed at first login during the auth-setup project.
export default async (): Promise<void> => {
  const databaseUrl =
    process.env.DATABASE_URL_TEST ??
    "postgresql://postgres:postgres@localhost:5432/effect-monorepo-test";
  await runMigrations(databaseUrl);

  const zitadelIssuer = process.env.ZITADEL_ISSUER ?? "http://localhost:8080";
  const zitadelPat = process.env.ZITADEL_BOOTSTRAP_PAT;
  const adminEmail = process.env.ZITADEL_ADMIN_EMAIL ?? "admin@example.com";

  if (zitadelPat === undefined || zitadelPat === "") {
    throw new Error(
      `[acceptance/global-setup] ZITADEL_BOOTSTRAP_PAT is not set.\n` +
        `  Run \`pnpm auth:up && pnpm auth:seed\` and put the resulting PAT into your .env.`,
    );
  }

  await assertZitadelReachable(zitadelIssuer);
  await seedAdminInTestDb({ databaseUrl, zitadelIssuer, zitadelPat, adminEmail });
};

const assertZitadelReachable = async (issuer: string): Promise<void> => {
  try {
    const response = await fetch(`${issuer}/debug/ready`);
    if (!response.ok) {
      throw new Error(`/debug/ready returned ${response.status}`);
    }
  } catch (cause) {
    throw new Error(
      `[acceptance/global-setup] Zitadel is not reachable at ${issuer}. ` +
        `Run \`pnpm auth:up\` first.\n  cause: ${String(cause)}`,
    );
  }
};
