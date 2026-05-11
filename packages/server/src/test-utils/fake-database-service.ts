// A `Database.Database`-shaped service backed by `FakeDatabase`. The
// in-process backend uses Fake repositories for mutation paths, so
// the real `Database` is only needed by the read-side query handlers
// (`findUsers`, `listTodos`) and by `PermissionsResolver`. This
// service intercepts those callers' `execute(fn)` calls and returns
// rows synthesized from the FakeDatabase Maps.
//
// Scope: only the SQL shapes our current query handlers run are
// supported. If a handler runs an unfamiliar query against this
// service, it `Effect.die`s with the SQL fragment so the gap is
// visible and unambiguous — not a silent empty result that hides
// a missing feature.

import { type UserId } from "@/platform/ids/user-id.js";
import { Database } from "@org/database/index";
import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { FakeDatabase } from "./fake-database.js";

type DatabaseShape = Context.Tag.Service<typeof Database.Database>;

// A minimal Slonik-client shape. Real Slonik clients have many more
// methods; we surface only what the existing handlers reach for and
// die on anything else.
type FakeClient = {
  readonly any: (query: unknown) => Promise<ReadonlyArray<unknown>>;
  readonly one: (query: unknown) => Promise<unknown>;
  readonly maybeOne: (query: unknown) => Promise<unknown>;
  readonly query: (query: unknown) => Promise<unknown>;
};

const sqlText = (query: unknown): string => {
  // Slonik's sql template produces objects with a `sql` field (the
  // text) and a `values` array. Both `sql.unsafe` and `sql.type` use
  // the same outer shape.
  if (typeof query === "object" && query !== null && "sql" in query) {
    return String(query.sql);
  }
  return "";
};

const sqlValues = (query: unknown): ReadonlyArray<unknown> => {
  if (typeof query === "object" && query !== null && "values" in query) {
    return (query as { values: ReadonlyArray<unknown> }).values;
  }
  return [];
};

const makeFakeClient = (db: FakeDatabase): FakeClient => ({
  any: async (query) => {
    const text = sqlText(query);
    // findUsers: `SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`
    if (/from\s+users/i.test(text) && /order\s+by\s+created_at\s+desc/i.test(text)) {
      const values = sqlValues(query);
      const limit = typeof values[0] === "number" ? values[0] : Number(values[0] ?? 10);
      const offset = typeof values[1] === "number" ? values[1] : Number(values[1] ?? 0);
      const sorted = Array.from(db.users.values()).sort(
        (a, b) =>
          new Date(b.createdAt.toString()).getTime() - new Date(a.createdAt.toString()).getTime(),
      );
      const window = sorted.slice(offset, offset + limit);
      return window.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        country: u.address.country,
        street: u.address.street,
        postal_code: u.address.postalCode,
        created_at: new Date(u.createdAt.toString()),
        updated_at: new Date(u.updatedAt.toString()),
      }));
    }
    // listTodos: `SELECT * FROM todos ORDER BY created_at DESC`
    if (/from\s+todos/i.test(text)) {
      return Array.from(db.todos.values()).map((t) => ({
        id: t.id,
        title: t.title,
        completed: t.completed,
        // Todo aggregate doesn't carry created_at/updated_at; synthesize
        // a stable epoch so the row schema decodes.
        created_at: new Date(0),
        updated_at: new Date(0),
      }));
    }
    // Unknown: die with the SQL so the gap is visible.
    throw new Error(`FakeDatabaseService.any: no mapping for query: ${text.slice(0, 200)}`);
  },

  one: async (query) => {
    const text = sqlText(query);
    // findUsers' count: `SELECT COUNT(*)::int AS value FROM users`
    if (/count\s*\(\s*\*\s*\)/i.test(text) && /from\s+users/i.test(text)) {
      return { value: db.users.size };
    }
    throw new Error(`FakeDatabaseService.one: no mapping for query: ${text.slice(0, 200)}`);
  },

  maybeOne: async (query) => {
    const text = sqlText(query);
    // PermissionsResolver: `SELECT role FROM users WHERE id = $1`
    if (/select\s+role\s+from\s+users/i.test(text)) {
      const values = sqlValues(query);
      const userId = values[0] as UserId | undefined;
      if (userId === undefined) return null;
      const user = db.users.get(userId);
      return user === undefined ? null : { role: user.role };
    }
    throw new Error(`FakeDatabaseService.maybeOne: no mapping for query: ${text.slice(0, 200)}`);
  },

  query: async (query) => {
    throw new Error(
      `FakeDatabaseService.query: writes go through Fake repositories, not Database directly. ` +
        `Query was: ${sqlText(query).slice(0, 200)}`,
    );
  },
});

// Layer that provides `Database.Database` backed by the supplied
// `FakeDatabase`. Wire BEFORE consumers that need it (the in-process
// backend's API layer). All `execute` calls flow through the
// FakeClient above; unknown SQL dies loudly.
export const FakeDatabaseServiceLive = (db: FakeDatabase) =>
  Layer.succeed(
    Database.Database,
    Database.Database.of({
      execute: (<T>(fn: (client: FakeClient) => Promise<T>) =>
        Effect.tryPromise({
          try: () => fn(makeFakeClient(db)),
          catch: (e) =>
            new Error(
              `FakeDatabaseService.execute: callback threw: ${e instanceof Error ? e.message : String(e)}`,
            ),
        }).pipe(Effect.orDie)) as unknown as DatabaseShape["execute"],
      transaction: (effect: Effect.Effect<unknown, unknown, unknown>) =>
        // The fake's mutations don't consult TransactionContext, so
        // `transaction` is a pass-through. Match the live signature
        // (which sets a TransactionContext); we just type-erase.
        effect as Effect.Effect<unknown, unknown, never>,
      setupConnectionListeners: Effect.void as DatabaseShape["setupConnectionListeners"],
      makeQuery:
        <A, E, R, Input = never>(
          queryFn: (execute: DatabaseShape["execute"], input: Input) => Effect.Effect<A, E, R>,
        ) =>
        (...args: [Input] extends [never] ? [] : [Input]) => {
          // No transaction context to thread; just call queryFn with
          // execute directly. The `as never` cast satisfies the
          // ExecuteFn type which is internal to Database.
          const input = (args.length === 0 ? undefined : args[0]) as Input;
          const execute = (<T>(fn: (client: FakeClient) => Promise<T>) =>
            Effect.tryPromise({
              try: () => fn(makeFakeClient(db)),
              catch: (e) => e,
            }).pipe(Effect.orDie)) as unknown as DatabaseShape["execute"];
          return queryFn(execute, input);
        },
    } as unknown as DatabaseShape),
  );
