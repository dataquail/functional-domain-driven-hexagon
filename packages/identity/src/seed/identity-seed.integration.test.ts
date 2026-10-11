import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import pg from "pg";
import { afterAll, beforeEach } from "vitest";

import { APP_URL, makeIdentityTestHarness } from "../test-utils/identity-test-auth.js";
import { identityTestDatabaseUrl } from "../test-utils/identity-test-database.js";
import { seedIdentity } from "./identity-seed.js";

const harness = makeIdentityTestHarness();
const inspect = new pg.Pool({ connectionString: identityTestDatabaseUrl(), max: 1 });

const client = {
  clientId: "effect-monorepo-app",
  clientSecret: "integration-client-secret",
  clientName: "Effect Monorepo",
  redirectUris: [`${APP_URL}/api/auth/callback`],
  postLogoutRedirectUris: [`${APP_URL}/`],
};
const admin = { email: "admin@example.com", password: "Password123!", name: "Admin" };

const query = (sql: string): Effect.Effect<ReadonlyArray<Record<string, unknown>>> =>
  Effect.promise(() => inspect.query<Record<string, unknown>>(sql).then((result) => result.rows));

describe("seedIdentity (integration)", () => {
  beforeEach(() => harness.reset());
  afterAll(() => Promise.all([harness.close(), inspect.end()]));

  it.effect("creates verified users without mailing them, and answers with their subjects", () =>
    Effect.gen(function* () {
      const seeded = yield* seedIdentity(harness.makeSeedingAuth(undefined), { users: [admin] });

      const users = yield* query(`SELECT id, email, "emailVerified" FROM "user"`);
      expect(users).toEqual([{ id: seeded[0].subject, email: admin.email, emailVerified: true }]);
      expect(harness.sent).toEqual([]);
    }),
  );

  it.effect(
    "registers the app's client with the id it was given, trusted and able to end sessions",
    () =>
      Effect.gen(function* () {
        yield* seedIdentity(harness.makeSeedingAuth(client), { client, users: [admin] });

        const clients = yield* query(
          `SELECT "clientId", "skipConsent", "enableEndSession", "redirectUris" FROM "oauthClient"`,
        );
        expect(clients).toEqual([
          {
            clientId: client.clientId,
            skipConsent: true,
            enableEndSession: true,
            redirectUris: [`${APP_URL}/api/auth/callback`],
          },
        ]);
      }),
  );

  it.effect("is idempotent: a second run keeps the same subjects and the one client", () =>
    Effect.gen(function* () {
      const first = yield* seedIdentity(harness.makeSeedingAuth(client), {
        client,
        users: [admin],
      });
      const second = yield* seedIdentity(harness.makeSeedingAuth(client), {
        client,
        users: [admin],
      });

      expect(second).toEqual(first);
      expect(yield* query(`SELECT count(*)::int AS n FROM "oauthClient"`)).toEqual([{ n: 1 }]);
    }),
  );

  it.effect("verifies a user who had signed up but never followed the link", () =>
    Effect.gen(function* () {
      const auth = harness.makeAuth();
      yield* Effect.promise(() =>
        auth.api.signUpEmail({
          body: { email: admin.email, password: admin.password, name: admin.name },
        }),
      );

      yield* seedIdentity(harness.makeSeedingAuth(undefined), { users: [admin] });

      expect(yield* query(`SELECT "emailVerified" FROM "user"`)).toEqual([{ emailVerified: true }]);
    }),
  );

  it.effect("resets the password of a user who already existed, so the seeded one signs in", () =>
    Effect.gen(function* () {
      yield* seedIdentity(harness.makeSeedingAuth(undefined), {
        users: [{ ...admin, password: "AnOldPassword123!" }],
      });

      yield* seedIdentity(harness.makeSeedingAuth(undefined), { users: [admin] });

      const signedIn = yield* Effect.promise(() =>
        harness.makeAuth().api.signInEmail({
          body: { email: admin.email, password: admin.password },
          asResponse: true,
        }),
      );
      expect(signedIn.ok).toBe(true);
    }),
  );
});
