import * as NodeServices from "@effect/platform-node/NodeServices";
import { resetAndMigrate } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import pg from "pg";

import { ADMIN_EMAIL } from "./admin-credentials";
import { MEMBER_EMAIL } from "./member-credentials";
import { type AcceptanceTarget } from "./target";

export const runMigrations = async (target: AcceptanceTarget): Promise<void> => {
  const url = Redacted.make(target.databaseUrl);
  await Effect.runPromise(
    resetAndMigrate({ url, ssl: false }).pipe(
      Effect.asVoid,
      Effect.provide(NodeServices.layer),
      Effect.orDie,
    ),
  );
};

const splitQualified = (qualified: string): readonly [string, string] => {
  const [schema, table, ...rest] = qualified.split(".");
  if (schema === undefined || table === undefined || rest.length > 0) {
    throw new Error(
      `[acceptance/test-utils] expected "schema.table", got "${qualified}". Acceptance specs must qualify table names with their owning module schema.`,
    );
  }
  return [schema, table];
};

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
  try {
    const usersEntry = qualified.find(([s, t]) => s === "user" && t === "users");
    if (usersEntry !== undefined) {
      await pool.query(`DELETE FROM "user".users WHERE email <> ALL($1::text[])`, [
        preservedEmails,
      ]);
      const others = qualified.filter(([s, t]) => !(s === "user" && t === "users"));
      if (others.length > 0) {
        const list = others.map(([s, t]) => `"${s}"."${t}"`).join(", ");
        await pool.query(`TRUNCATE TABLE ${list} CASCADE`);
      }
      return;
    }
    const list = qualified.map(([s, t]) => `"${s}"."${t}"`).join(", ");
    await pool.query(`TRUNCATE TABLE ${list} CASCADE`);
  } finally {
    await pool.end();
  }
};
