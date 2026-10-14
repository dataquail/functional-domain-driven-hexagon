import { expect, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { APP_URL, IdentityTestHarness } from "../test-utils/identity-test-auth.ts";
import { IdentityTestDatabase } from "../test-utils/identity-test-database.ts";
import { seedIdentity } from "./identity-seed.ts";

const client = {
  clientId: "effect-monorepo-app",
  clientSecret: "integration-client-secret",
  clientName: "Effect Monorepo",
  redirectUris: [`${APP_URL}/api/auth/callback`],
  postLogoutRedirectUris: [`${APP_URL}/`],
};

const admin = { email: "admin@example.com", password: "Password123!", name: "Admin" };

const query = (sql: string) =>
  Effect.gen(function* () {
    const database = yield* IdentityTestDatabase;
    const result = yield* Effect.promise(() => database.query(sql));
    const rows: ReadonlyArray<unknown> = result.rows;

    return rows;
  });

const resetHarness = Effect.gen(function* () {
  const harness = yield* IdentityTestHarness;
  yield* harness.reset;

  return harness;
});

layer(IdentityTestHarness.layer, { excludeTestServices: true })(
  "seedIdentity (integration)",
  (it) => {
    it.effect("creates verified users without mailing them, and answers with their subjects", () =>
      Effect.gen(function* () {
        const harness = yield* resetHarness;

        const seeded = yield* seedIdentity(harness.makeSeedingAuth(Option.none()), {
          users: [admin],
        });

        const users = yield* query(`SELECT id, email, "emailVerified" FROM "user"`);
        expect(users).toEqual([{ id: seeded[0].subject, email: admin.email, emailVerified: true }]);
        expect(harness.sent).toEqual([]);
      }),
    );

    it.effect(
      "registers the app's client with the id it was given, trusted and able to end sessions",
      () =>
        Effect.gen(function* () {
          const harness = yield* resetHarness;
          yield* seedIdentity(harness.makeSeedingAuth(Option.some(client)), {
            client,
            users: [admin],
          });

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
        const harness = yield* resetHarness;

        const first = yield* seedIdentity(harness.makeSeedingAuth(Option.some(client)), {
          client,
          users: [admin],
        });

        const second = yield* seedIdentity(harness.makeSeedingAuth(Option.some(client)), {
          client,
          users: [admin],
        });

        expect(second).toEqual(first);
        expect(yield* query(`SELECT count(*)::int AS n FROM "oauthClient"`)).toEqual([{ n: 1 }]);
      }),
    );

    it.effect("verifies a user who had signed up but never followed the link", () =>
      Effect.gen(function* () {
        const harness = yield* resetHarness;
        const auth = harness.makeAuth();
        yield* Effect.promise(() =>
          auth.api.signUpEmail({
            body: { email: admin.email, password: admin.password, name: admin.name },
          }),
        );

        yield* seedIdentity(harness.makeSeedingAuth(Option.none()), { users: [admin] });

        expect(yield* query(`SELECT "emailVerified" FROM "user"`)).toEqual([
          { emailVerified: true },
        ]);
      }),
    );

    it.effect("resets the password of a user who already existed, so the seeded one signs in", () =>
      Effect.gen(function* () {
        const harness = yield* resetHarness;
        yield* seedIdentity(harness.makeSeedingAuth(Option.none()), {
          users: [{ ...admin, password: "AnOldPassword123!" }],
        });

        yield* seedIdentity(harness.makeSeedingAuth(Option.none()), { users: [admin] });

        const signedIn = yield* Effect.promise(() =>
          harness.makeAuth().api.signInEmail({
            body: { email: admin.email, password: admin.password },
            asResponse: true,
          }),
        );

        expect(signedIn.ok).toBe(true);
      }),
    );
  },
);
