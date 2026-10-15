import * as NodeServices from "@effect/platform-node/NodeServices";
import { resetAndMigrate } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import pg from "pg";

import { ADMIN_EMAIL } from "./admin-credentials";
import { MEMBER_EMAIL } from "./member-credentials";
import { type AcceptanceTarget } from "./target";

export const runMigrations = (target: AcceptanceTarget) =>
  resetAndMigrate({ url: Redacted.make(target.databaseUrl), ssl: false }).pipe(
    Effect.asVoid,
    Effect.provide(NodeServices.layer),
    Effect.orDie,
  );

// Runs `work`, then `release` whether or not it failed; the failure still propagates.
export const releasingAfter = async <A>(
  work: () => Promise<A>,
  release: () => Promise<void>,
): Promise<A> => {
  const result = await work().catch(async (cause: unknown) => {
    await release();
    throw cause;
  });

  await release();

  return result;
};

type QualifiedTable = readonly [schema: string, table: string];

const splitQualified = (qualified: string): QualifiedTable => {
  const parts = qualified.split(".");

  if (parts.length !== 2) {
    throw new Error(
      `[acceptance/test-utils] expected "schema.table", got "${qualified}". Acceptance specs must qualify table names with their owning module schema.`,
    );
  }

  const [schema = "", table = ""] = parts;

  return [schema, table];
};

const isUsersTable = ([schema, table]: QualifiedTable) => schema === "user" && table === "users";

const tableList = (tables: ReadonlyArray<QualifiedTable>) =>
  tables.map(([schema, table]) => `"${schema}"."${table}"`).join(", ");

// Truncate is auth-aware: when a spec asks to clear `user.users`, we DELETE
// non-system rows instead of TRUNCATE'ing — a preserved user's session and
// `auth_identities` row would otherwise CASCADE-delete and break the
// storageState cookie for the next spec. We preserve BOTH the admin
// (ADMIN_EMAIL, seeded by admin-seed.ts) and the regular member
// (MEMBER_EMAIL, JIT-provisioned at member-setup login) so an org-scoped
// spec's member session survives a user-table reset by another spec
// regardless of run order.
export const truncate = async (
  target: AcceptanceTarget,
  tables: ReadonlyArray<string>,
): Promise<void> => {
  if (tables.length === 0) return;
  const preservedEmails = [ADMIN_EMAIL, MEMBER_EMAIL];
  const qualified = tables.map(splitQualified);
  const pool = new pg.Pool({ connectionString: target.databaseUrl });

  const clear = async (): Promise<void> => {
    if (!qualified.some(isUsersTable)) {
      await pool.query(`TRUNCATE TABLE ${tableList(qualified)} CASCADE`);

      return;
    }

    await pool.query(`DELETE FROM "user".users WHERE email <> ALL($1::text[])`, [preservedEmails]);
    const others = qualified.filter((entry) => !isUsersTable(entry));

    if (others.length > 0) await pool.query(`TRUNCATE TABLE ${tableList(others)} CASCADE`);
  };

  await releasingAfter(clear, () => pool.end());
};
