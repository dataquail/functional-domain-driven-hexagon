import { Database, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { afterAll, beforeAll, beforeEach } from "vitest";

import { MEMBER_CALLER_ID, SUPER_ADMIN_CALLER_ID } from "@/test-utils/fake-auth-middleware.js";
import { truncate } from "@/test-utils/test-database.js";
import { TestServerLive } from "@/test-utils/test-server.js";

type ServerContext = Layer.Success<typeof TestServerLive>;
type ServerError = Layer.Error<typeof TestServerLive>;

export type ServerTestRuntime = {
  readonly run: <A, E>(effect: Effect.Effect<A, E, ServerContext>) => Promise<A>;
};

type Opts = {
  // Optional override for the composed server Layer — e.g. the
  // `TestServerLiveAsMember` variant for testing 403-Forbidden paths on
  // super-admin-only endpoints. Defaults to the standard `TestServerLive`
  // (super-admin caller) so existing callers don't change.
  readonly server?: Layer.Layer<ServerContext, ServerError>;
  // After truncating, INSERT both deterministic caller rows
  // (`SUPER_ADMIN_CALLER_ID` + `MEMBER_CALLER_ID`) into "user".users
  // plus a `platform.roles` entry granting `super_admin` to the
  // super-admin caller. Both user rows are seeded so any test that
  // creates an org (which inserts a membership row FK'd to user.users)
  // works regardless of which middleware variant the test uses. Set
  // true for endpoint tests that exercise `Authz.hasPermissions`,
  // `/auth/me`'s `isSuperAdmin`, or any flow that touches
  // `organization.memberships`.
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
              VALUES
                (${SUPER_ADMIN_CALLER_ID}, 'super-admin@test.local', 'USA', '1 St', '00000', now(), now()),
                (${MEMBER_CALLER_ID}, 'member@test.local', 'USA', '2 St', '00000', now(), now())
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
