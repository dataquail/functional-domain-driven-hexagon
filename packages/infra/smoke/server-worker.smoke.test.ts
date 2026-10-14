import { describe, expect } from "@effect/vitest";
import * as Test from "alchemy/Test/Vitest";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";

import Stack from "../alchemy.run.ts";
import { stackProviders } from "../src/stack/providers.ts";

// The server Worker under workerd, as `alchemy dev` runs it: Hyperdrive passes
// through to the docker Postgres in DATABASE_URL, and the identity Worker is
// bound beside it. Each test drives one of the three handlers over HTTP. Every
// resource is local, so the harness's own teardown (closing the dev sidecar) is
// all a run leaves behind to clean; `destroy(Stack)` never settles in dev mode.
const { beforeAll, deploy, test } = Test.make({
  providers: stackProviders,
  dev: true,
});

// oxlint-disable-next-line effect/noTestLifecycleHooks -- Alchemy's harness memoizes the dev deploy as an Effect every test yields; it is not a vitest hook
const stack = beforeAll(deploy(Stack), { timeout: 180_000 });

const serverWorkerUrl = Effect.flatMap(stack, (outputs) =>
  Effect.orDie(Effect.fromNullishOr(outputs.serverUrl)),
);

const send = (build: (serverUrl: string) => HttpClientRequest.HttpClientRequest) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;

    return yield* client.execute(build(yield* serverWorkerUrl));
  }).pipe(
    // Redirects are asserted, not followed.
    Effect.provideService(FetchHttpClient.RequestInit, { redirect: "manual" }),
    Effect.provide(FetchHttpClient.layer),
    Effect.orDie,
  );

const get = (path: string, headers: Record<string, string> = {}) =>
  send((serverUrl) =>
    HttpClientRequest.get(new URL(path, serverUrl).toString()).pipe(
      HttpClientRequest.setHeaders(headers),
    ),
  );

type MessageField = string | { readonly [field: string]: MessageField };

const queueBatch = (queue: string, body: { readonly [field: string]: MessageField }) =>
  Effect.gen(function* () {
    const timestamp = yield* Clock.currentTimeMillis;

    const response = yield* send((serverUrl) =>
      HttpClientRequest.post(new URL("/cdn-cgi/handler/queue", serverUrl).toString()).pipe(
        HttpClientRequest.bodyJsonUnsafe({
          queue,
          messages: [{ id: "smoke-1", timestamp, body, attempts: 1 }],
        }),
      ),
    );

    return yield* Effect.orDie(response.json);
  });

describe("server Worker: fetch", () => {
  test(
    "answers an unauthenticated caller with 401",
    Effect.gen(function* () {
      const response = yield* get("/auth/me");

      expect(response.status).toBe(401);
      expect(yield* Effect.orDie(response.json)).toHaveProperty("_tag", "Unauthorized");
    }),
  );

  test(
    "hashes a presented bearer token and refuses an unknown one",
    Effect.gen(function* () {
      const response = yield* get("/auth/me", { authorization: "Bearer pat_not_a_real_token" });

      expect(response.status).toBe(401);
    }),
  );

  test(
    "verifies a session cookie's HMAC and refuses a forged one",
    Effect.gen(function* () {
      const response = yield* get("/auth/me", { cookie: "session=forged.signature" });

      expect(response.status).toBe(401);
    }),
  );

  test(
    "discovers the issuer over the identity service binding and redirects to it",
    Effect.gen(function* () {
      const response = yield* get("/auth/login");

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("/oauth2/authorize?");
    }),
  );
});

describe("server Worker: queue", () => {
  test(
    "acks a message that is not an envelope rather than retrying it",
    Effect.gen(function* () {
      const { domainEventsQueue } = yield* stack;

      const answer = yield* queueBatch(domainEventsQueue, { not: "an envelope" });

      expect(answer).toMatchObject({ ok: true, result: { explicitAcks: ["smoke-1"] } });
    }),
  );

  test(
    "reports a dead letter and acks it",
    Effect.gen(function* () {
      const { domainEventsDeadLetterQueue } = yield* stack;

      const answer = yield* queueBatch(domainEventsDeadLetterQueue, {
        eventId: "00000000-0000-0000-0000-000000000001",
        tag: "InvitationIssued",
        handler: "organization.sendInvitationEmail",
        occurredAt: "2026-10-11T00:00:00.000Z",
        payload: {},
      });

      expect(answer).toMatchObject({ ok: true, result: { explicitAcks: ["smoke-1"] } });
    }),
  );
});

describe("server Worker: scheduled", () => {
  test(
    "runs the outbox sweep on the every-minute cron",
    Effect.gen(function* () {
      const response = yield* get("/cdn-cgi/handler/scheduled?cron=*+*+*+*+*");

      expect(response.status).toBe(200);
    }),
  );

  test(
    "fails a cron no job is scheduled on",
    Effect.gen(function* () {
      const response = yield* get("/cdn-cgi/handler/scheduled?cron=5+4+*+*+*");

      expect(response.status).toBe(500);
    }),
  );
});
