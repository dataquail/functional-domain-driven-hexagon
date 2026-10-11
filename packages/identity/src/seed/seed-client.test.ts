import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import {
  appClientFromEnv,
  assertIdentityReachable,
  type Queryable,
  recordSuperAdmin,
  seedIdentityUsers,
} from "./seed-client.js";

const env = {
  IDENTITY_ISSUER: "http://localhost:3002/api/auth",
  IDENTITY_SEED_TOKEN: "seed-token",
  IDENTITY_CLIENT_ID: "effect-monorepo-app",
  IDENTITY_CLIENT_SECRET: "client-secret",
};
const admin = { email: "admin@example.com", password: "pw", name: "Admin" };

const answering = (response: Response) => {
  const requests: Array<Request> = [];
  const fetch: typeof globalThis.fetch = (input, init) => {
    requests.push(new Request(input, init));
    return Promise.resolve(response.clone());
  };
  return { fetch, requests };
};

const recordingDatabase = (userId: string | null) => {
  const statements: Array<string> = [];
  const database: Queryable = {
    query: (text) => {
      statements.push(text.trim().split(/\s+/).slice(0, 3).join(" "));
      return Promise.resolve({
        rows: text.includes("SELECT id") && userId !== null ? [{ id: userId }] : [],
      });
    },
  };
  return { database, statements };
};

describe("seed client", () => {
  it("registers the app with the client id, secret and URIs the server is configured with", () => {
    expect(
      appClientFromEnv({
        ...env,
        IDENTITY_REDIRECT_URI: "http://app.test/api/auth/callback",
        IDENTITY_POST_LOGOUT_REDIRECT_URI: "http://app.test/",
      }),
    ).toEqual({
      clientId: "effect-monorepo-app",
      clientSecret: "client-secret",
      clientName: "Effect Monorepo",
      redirectUris: ["http://app.test/api/auth/callback"],
      postLogoutRedirectUris: ["http://app.test/"],
    });
  });

  it("names the missing variable when the app's client is not configured", () => {
    expect(() => appClientFromEnv({})).toThrow("IDENTITY_CLIENT_ID is not set");
  });

  it.effect(
    "posts the users to the seed endpoint with the seed token and returns their subjects",
    () =>
      Effect.gen(function* () {
        const { fetch, requests } = answering(
          Response.json({ users: [{ email: admin.email, subject: "sub-1" }] }),
        );

        const seeded = yield* Effect.promise(() =>
          seedIdentityUsers({ env, users: [admin], fetch }),
        );

        expect(seeded).toEqual([{ email: admin.email, subject: "sub-1" }]);
        expect(requests[0]?.url).toBe("http://localhost:3002/internal/seed");
        expect(requests[0]?.headers.get("authorization")).toBe("Bearer seed-token");
      }),
  );

  it.effect("fails with the Worker's answer when it refuses the seed", () =>
    Effect.gen(function* () {
      const { fetch } = answering(new Response("nope", { status: 401 }));

      const error = yield* Effect.flip(
        Effect.tryPromise(() => seedIdentityUsers({ env, users: [admin], fetch })),
      );

      expect(String(error.cause)).toContain("refused the seed: 401 nope");
    }),
  );

  it.effect("tells the developer to start the stack when the issuer cannot be reached", () =>
    Effect.gen(function* () {
      const unreachable: typeof globalThis.fetch = () => Promise.reject(new Error("ECONNREFUSED"));

      const error = yield* Effect.flip(
        Effect.tryPromise(() => assertIdentityReachable(env, unreachable)),
      );

      expect(String(error.cause)).toContain("Start it with `pnpm dev:cf`");
    }),
  );

  it.effect("accepts an issuer that serves its discovery document", () =>
    Effect.gen(function* () {
      const { fetch, requests } = answering(Response.json({ issuer: env.IDENTITY_ISSUER }));

      yield* Effect.promise(() => assertIdentityReachable(env, fetch));

      expect(requests[0]?.url).toBe(
        "http://localhost:3002/api/auth/.well-known/openid-configuration",
      );
    }),
  );

  it.effect("records the seeded identity as a super-admin inside one transaction", () =>
    Effect.gen(function* () {
      const { database, statements } = recordingDatabase("user-1");

      const userId = yield* Effect.promise(() =>
        recordSuperAdmin(database, { email: admin.email, subject: "sub-1" }),
      );

      expect(userId).toBe("user-1");
      expect(statements).toEqual([
        "BEGIN",
        'INSERT INTO "user".users',
        "SELECT id FROM",
        "INSERT INTO auth.auth_identities",
        "INSERT INTO platform.roles",
        "COMMIT",
      ]);
    }),
  );

  it.effect("rolls back when the user row cannot be read back", () =>
    Effect.gen(function* () {
      const { database, statements } = recordingDatabase(null);

      yield* Effect.exit(
        Effect.tryPromise(() => recordSuperAdmin(database, { email: admin.email, subject: "s" })),
      );

      expect(statements.at(-1)).toBe("ROLLBACK");
    }),
  );
});
