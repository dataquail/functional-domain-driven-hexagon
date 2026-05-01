import { randomUUID } from "node:crypto";
import pg from "pg";

// Mirrors the relevant slice of `infra/zitadel/seed.mjs` against the TEST
// database: looks up the admin user in Zitadel by email (using the bootstrap
// PAT) to discover their sub, then INSERTs a corresponding `users` +
// `auth_identities` row in the test DB. Required so the OIDC `SignIn`
// command finds an existing identity at first login (we don't JIT-provision
// admins — see plan §3.6).
export type SeedAdminParams = {
  readonly databaseUrl: string;
  readonly zitadelIssuer: string;
  readonly zitadelPat: string;
  readonly adminEmail: string;
};

export const seedAdminInTestDb = async (params: SeedAdminParams): Promise<void> => {
  const subject = await lookupZitadelSubject(params);
  await insertAdminRow({ databaseUrl: params.databaseUrl, subject, adminEmail: params.adminEmail });
};

const lookupZitadelSubject = async ({
  adminEmail,
  zitadelIssuer,
  zitadelPat,
}: SeedAdminParams): Promise<string> => {
  const response = await fetch(`${zitadelIssuer}/v2/users`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${zitadelPat}`,
    },
    body: JSON.stringify({
      queries: [{ emailQuery: { emailAddress: adminEmail, method: "TEXT_QUERY_METHOD_EQUALS" } }],
    }),
  });
  if (!response.ok) {
    throw new Error(
      `[acceptance/admin-seed] Zitadel user lookup failed: ${response.status} ${await response.text()}`,
    );
  }
  const data = (await response.json()) as { result?: ReadonlyArray<{ userId: string }> };
  const found = data.result?.[0];
  if (found === undefined) {
    throw new Error(
      `[acceptance/admin-seed] No Zitadel user found for ${adminEmail}. Run \`pnpm auth:up && pnpm auth:seed\` first.`,
    );
  }
  return found.userId;
};

const insertAdminRow = async ({
  adminEmail,
  databaseUrl,
  subject,
}: {
  readonly databaseUrl: string;
  readonly subject: string;
  readonly adminEmail: string;
}): Promise<void> => {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN");
    const newId = randomUUID();
    await client.query(
      `INSERT INTO users (id, email, role, country, street, postal_code, created_at, updated_at)
       VALUES ($1, $2, 'admin', 'N/A', 'N/A', 'N/A', now(), now())
       ON CONFLICT (email) DO UPDATE SET role = 'admin'`,
      [newId, adminEmail],
    );
    const userRow = await client.query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [
      adminEmail,
    ]);
    const finalUserId = userRow.rows[0]?.id;
    if (finalUserId === undefined) {
      throw new Error(`[acceptance/admin-seed] failed to read back admin user_id`);
    }
    await client.query(
      `INSERT INTO auth_identities (subject, user_id, provider, created_at)
       VALUES ($1, $2, 'zitadel', now())
       ON CONFLICT (subject) DO NOTHING`,
      [subject, finalUserId],
    );
    await client.query("COMMIT");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    await client.end();
  }
};
