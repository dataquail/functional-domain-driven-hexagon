import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import { HttpClientError, TransportError } from "effect/http/HttpClientError";
import type * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";

import {
  appClientFromEnv,
  checkIdentityReachable,
  recordSuperAdminWith,
  seedUsersThroughWorker,
  type SqlRunner,
} from "./seed-client.js";

const env = {
  IDENTITY_ISSUER: "http://localhost:3002/api/auth",
  IDENTITY_SEED_TOKEN: "seed-token",
  IDENTITY_CLIENT_ID: "effect-monorepo-app",
  IDENTITY_CLIENT_SECRET: "client-secret",
};

const admin = { email: "admin@example.com", password: "pw", name: "Admin" };

const answering = (response: Response) => {
  const requests: Array<HttpClientRequest.HttpClientRequest> = [];

  const client = HttpClient.make((request) =>
    Effect.sync(() => {
      requests.push(request);

      return HttpClientResponse.fromWeb(request, response.clone());
    }),
  );

  return { layer: Layer.succeed(HttpClient.HttpClient, client), requests };
};

const unreachable = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make(
    (request) =>
      new HttpClientError({
        reason: new TransportError({ request, description: "ECONNREFUSED" }),
      }),
  ),
);

const recordingDatabase = (userRows: ReadonlyArray<{ readonly id: string }>) => {
  const statements: Array<string> = [];

  const run: SqlRunner = (text) =>
    Effect.sync(() => {
      statements.push(text.trim().split(/\s+/).slice(0, 3).join(" "));

      if (text.includes("SELECT id")) return { rows: userRows };

      return { rows: [] };
    });

  return { run, statements };
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
    () => {
      const { layer, requests } = answering(
        Response.json({ users: [{ email: admin.email, subject: "sub-1" }] }),
      );

      return Effect.gen(function* () {
        const seeded = yield* seedUsersThroughWorker({ env, users: [admin] });

        expect(seeded).toEqual([{ email: admin.email, subject: "sub-1" }]);
        expect(requests[0]?.url).toBe("http://localhost:3002/internal/seed");
        expect(requests[0]?.headers.authorization).toBe("Bearer seed-token");
      }).pipe(Effect.provide(layer));
    },
  );

  it.effect("fails with the Worker's answer when it refuses the seed", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(seedUsersThroughWorker({ env, users: [admin] }));

      expect(error.message).toContain("refused the seed: 401 nope");
    }).pipe(Effect.provide(answering(new Response("nope", { status: 401 })).layer)),
  );

  it.effect("tells the developer to start the stack when the issuer cannot be reached", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(checkIdentityReachable(env));

      expect(error.message).toContain("Start it with `pnpm dev`");
    }).pipe(Effect.provide(unreachable)),
  );

  it.effect("accepts an issuer that serves its discovery document", () => {
    const { layer, requests } = answering(Response.json({ issuer: env.IDENTITY_ISSUER }));

    return Effect.gen(function* () {
      yield* checkIdentityReachable(env);

      expect(requests[0]?.url).toBe(
        "http://localhost:3002/api/auth/.well-known/openid-configuration",
      );
    }).pipe(Effect.provide(layer));
  });

  it.effect("records the seeded identity as a super-admin inside one transaction", () =>
    Effect.gen(function* () {
      const { run, statements } = recordingDatabase([{ id: "user-1" }]);

      const userId = yield* recordSuperAdminWith(run, { email: admin.email, subject: "sub-1" });

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
      const { run, statements } = recordingDatabase([]);

      yield* Effect.exit(recordSuperAdminWith(run, { email: admin.email, subject: "s" }));

      expect(statements.at(-1)).toBe("ROLLBACK");
    }),
  );
});
