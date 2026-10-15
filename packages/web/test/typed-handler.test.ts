// Spike: prove `typedHandler` round-trips through the real
// `@org/contracts` schemas via MSW + `HttpApiClient.make`. Two cases:
// `Users.find` (GET with `urlParams` + paginated success body) and
// `Users.create` (POST with `payload` + tagged-error union).

import { afterAll, afterEach, beforeAll, describe, expect, it } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import * as UserContract from "@org/contracts/api/UserContract";
import { DomainApi } from "@org/contracts/DomainApi";
import { UserId } from "@org/contracts/EntityIds";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import { setupServer } from "msw/node";

import { getEndpoint, typedHandler } from "./typed-handler";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

const userFindEndpoint = getEndpoint(UserContract.Group, "find");
const userCreateEndpoint = getEndpoint(UserContract.Group, "create");

// Match production's `baseUrl: "/api"` (api-client.client.ts), but make it
// absolute so node fetch is happy — MSW intercepts on the path.
const makeClient = () =>
  HttpApiClient.make(DomainApi, { baseUrl: "http://localhost/api" }).pipe(
    Effect.provide(FetchHttpClient.layer),
  );

describe("typedHandler", () => {
  it.effect("round-trips Users.find with urlParams + paginated success body", () =>
    Effect.gen(function* () {
      const fixedDate = DateTime.makeUnsafe("2026-01-01T00:00:00Z");

      const sampleUser = new UserContract.User({
        id: UserId.make("11111111-1111-1111-1111-111111111111"),
        email: "alice@example.com",
        address: { country: "US", street: "1 A St", postalCode: "10001" },
        createdAt: fixedDate,
        updatedAt: fixedDate,
      });

      server.use(
        typedHandler(userFindEndpoint, ({ urlParams }) =>
          Effect.succeed(
            new UserContract.PaginatedUsers({
              users: [sampleUser],
              page: urlParams.page,
              pageSize: urlParams.pageSize,
              total: 1,
            }),
          ),
        ),
      );

      const client = yield* makeClient();

      const result = yield* client.user.find({
        query: new UserContract.FindUsersParams({ page: 1, pageSize: 10 }),
      });

      expect(result.total).toBe(1);
      expect(result.users.map((user) => user.email)).toEqual(["alice@example.com"]);
    }),
  );

  it.effect("round-trips Users.create success", () =>
    Effect.gen(function* () {
      const newId = UserId.make("22222222-2222-2222-2222-222222222222");
      server.use(
        typedHandler(userCreateEndpoint, ({ payload }) => {
          expect(payload.email).toBe("bob@example.com");

          return Effect.succeed(new UserContract.CreateUserResponse({ id: newId }));
        }),
      );

      const client = yield* makeClient();

      const result = yield* client.user.create({
        payload: new UserContract.CreateUserPayload({
          email: "bob@example.com",
          country: "US",
          street: "2 B St",
          postalCode: "10002",
        }),
      });

      expect(result.id).toBe(newId);
    }),
  );

  it.effect("encodes a tagged-error failure as the right HTTP status + body", () =>
    Effect.gen(function* () {
      server.use(
        typedHandler(userCreateEndpoint, ({ payload }) =>
          Effect.fail(
            new UserContract.UserAlreadyExistsError({
              email: payload.email,
              message: "Email already in use",
            }),
          ),
        ),
      );

      const client = yield* makeClient();

      const error = yield* Effect.flip(
        client.user.create({
          payload: new UserContract.CreateUserPayload({
            email: "duplicate@example.com",
            country: "US",
            street: "3 C St",
            postalCode: "10003",
          }),
        }),
      );

      assertInstanceOf(error, UserContract.UserAlreadyExistsError);
      expect(error.email).toBe("duplicate@example.com");
    }),
  );
});
