import { Database, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { afterAll, beforeAll, beforeEach } from "vitest";

import { SUPER_ADMIN_CALLER_ID } from "@/test-utils/fake-auth-middleware.js";
import { truncate } from "@/test-utils/test-database.js";
import { TestServerLive } from "@/test-utils/test-server.js";

type ServerContext = Layer.Layer.Success<typeof TestServerLive>;
type ServerError = Layer.Layer.Error<typeof TestServerLive>;

export type ServerTestRuntime = {
  readonly run: <A, E>(effect: Effect.Effect<A, E, ServerContext>) => Promise<A>;
};

type Opts = {
  // Optional override for the composed server Layer — e.g. the
  // `TestServerLiveAsMember` variant for testing 403-Forbidden paths on
  // super-admin-only endpoints. Defaults to the standard `TestServerLive`
  // (super-admin caller) so existing callers don't change.
  readonly server?: Layer.Layer<ServerContext, ServerError>;
  // After truncating, INSERT the deterministic super-admin caller row
  // (matching `UserAuthMiddlewareFake`'s userId) plus a `platform.roles`
  // entry granting `super_admin`. Set true for endpoint tests that
  // exercise a `Authz.hasPermissions` check or `/auth/me`'s
  // `isSuperAdmin` response — the live `RoleService` consults the DB
  // and would otherwise see no role for this caller.
  readonly seedSuperAdminCaller?: boolean;
};

// Wires the server runtime + per-test truncation into the surrounding describe
// block. Call inside a describe; receive `run` for executing test effects
// against a fully-composed in-memory server.
export const useServerTestRuntime = (
  truncateTables: ReadonlyArray<string>,
  opts: Opts = {},
): ServerTestRuntime => {
  let runtime: ManagedRuntime.ManagedRuntime<ServerContext, ServerError>;

  beforeAll(async () => {
    runtime = ManagedRuntime.make(opts.server ?? TestServerLive);
    await runtime.runPromise(Effect.void);
  });

  afterAll(async () => {
    await runtime.dispose();
  });

  beforeEach(async () => {
    await runtime.runPromise(truncate(...truncateTables));
    if (opts.seedSuperAdminCaller === true) {
      await runtime.runPromise(
        Effect.gen(function* () {
          const db = yield* Database.Database;
          yield* db.execute((client) =>
            client.query(sql.unsafe`
              INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
              VALUES (${SUPER_ADMIN_CALLER_ID}, 'super-admin@test.local', 'USA', '1 St', '00000', now(), now())
              ON CONFLICT (id) DO NOTHING
            `),
          );
          yield* db.execute((client) =>
            client.query(sql.unsafe`
              INSERT INTO platform.roles (user_id, role)
              VALUES (${SUPER_ADMIN_CALLER_ID}, 'super_admin')
              ON CONFLICT (user_id, role) DO NOTHING
            `),
          );
        }).pipe(Effect.orDie),
      );
    }
  });

  return {
    run: <A, E>(effect: Effect.Effect<A, E, ServerContext>) => runtime.runPromise(effect),
  };
};
