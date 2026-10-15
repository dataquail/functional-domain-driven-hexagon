import { layer } from "@effect/vitest";
import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import type * as Layer from "effect/Layer";
import type * as Scope from "effect/Scope";

import { MEMBER_CALLER_ID, SUPER_ADMIN_CALLER_ID } from "@/test-utils/fake-auth-middleware";
import { truncate } from "@/test-utils/test-database";
import { TestServerLive } from "@/test-utils/test-server";

type ServerContext = Layer.Success<typeof TestServerLive>;

type ServerError = Layer.Error<typeof TestServerLive>;

export type IntegrationIt<R> = {
  readonly effect: <A, E>(
    name: string,
    self: () => Effect.Effect<A, E, R | Scope.Scope>,
    timeout?: number,
  ) => void;
};

type IntegrationSuite<R, LayerError> = {
  readonly layer: Layer.Layer<R | Database.Database, LayerError>;
  // Truncated before every test; each must be schema-qualified ("schema.table").
  readonly tables: ReadonlyArray<string>;
  readonly seed?: Effect.Effect<void, never, R | Database.Database>;
};

// One layer per describe block, built once and shared by its tests, with the
// tables truncated (and the seed applied) before each test. The clock is live:
// rows carry database timestamps.
export const describeIntegration = <R, LayerError>(
  name: string,
  suite: IntegrationSuite<R, LayerError>,
  body: (it: IntegrationIt<R | Database.Database>) => void,
): void => {
  const reset = truncate(...suite.tables).pipe(Effect.andThen(suite.seed ?? Effect.void));

  layer(suite.layer, { excludeTestServices: true })(name, (it) => {
    body({
      effect: (testName, self, timeout) => {
        it.effect(testName, () => Effect.andThen(reset, Effect.suspend(self)), timeout);
      },
    });
  });
};

// Both deterministic caller rows into "user".users, plus `super_admin` for the
// super-admin caller, so a test may create an org (memberships FK user.users)
// under either middleware variant.
const seedCallers = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
    INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
    VALUES
      (${SUPER_ADMIN_CALLER_ID}, 'super-admin@test.local', 'USA', '1 St', '00000', now(), now()),
      (${MEMBER_CALLER_ID}, 'member@test.local', 'USA', '2 St', '00000', now(), now())
    ON CONFLICT (id) DO NOTHING
  `;
  yield* sql`
    INSERT INTO platform.roles (user_id, role)
    VALUES (${SUPER_ADMIN_CALLER_ID}, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING
  `;
}).pipe(Effect.orDie);

type ServerSuite = {
  readonly tables: ReadonlyArray<string>;
  // Defaults to `TestServerLive` (super-admin caller); `TestServerLiveAsMember`
  // exercises the 403 paths of super-admin-only endpoints.
  readonly server?: Layer.Layer<ServerContext, ServerError>;
  // Set for endpoint tests that exercise `Authz.hasPermissions`, `/auth/me`'s
  // `isSuperAdmin`, or any flow that touches `organization.memberships`.
  readonly seedSuperAdminCaller?: boolean;
};

export const describeServer = (
  name: string,
  suite: ServerSuite,
  body: (it: IntegrationIt<ServerContext>) => void,
): void => {
  const seed = seedCallers.pipe(
    Effect.when(Effect.succeed(suite.seedSuperAdminCaller === true)),
    Effect.asVoid,
  );

  describeIntegration(
    name,
    { layer: suite.server ?? TestServerLive, tables: suite.tables, seed },
    body,
  );
};
