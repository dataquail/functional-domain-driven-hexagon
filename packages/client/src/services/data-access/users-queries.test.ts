import { ApiClient } from "@/services/common/api-client";
import { QueryClient } from "@/services/common/query-client";
import { UsersQueries } from "@/services/data-access/users-queries";
import { UserContract } from "@org/contracts/api/Contracts";
import { UserId } from "@org/contracts/EntityIds";
import { QueryClient as TanstackQueryClient } from "@tanstack/react-query";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// UsersQueries.createUser invalidates the paginated list cache after the
// API call succeeds. The list query is keyed by ["users", { page, pageSize }],
// so any cached page must be marked stale once a new user lands.

const usersKeyFor = (page: number, pageSize: number) => ["users", { page, pageSize }] as const;

const validPayload: UserContract.CreateUserPayload = UserContract.CreateUserPayload.make({
  email: "alice@example.com",
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
});

const makeCreateResponse = (id: string): UserContract.CreateUserResponse =>
  new UserContract.CreateUserResponse({ id: UserId.make(id) });

const makeHarness = (overrides?: {
  readonly create?: (
    payload: UserContract.CreateUserPayload,
  ) => Effect.Effect<UserContract.CreateUserResponse>;
}) => {
  const queryClient = new TanstackQueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  const calls: Array<UserContract.CreateUserPayload> = [];

  const FakeApi = Layer.succeed(
    ApiClient,
    ApiClient.of({
      client: {
        user: {
          create: (args: { payload: UserContract.CreateUserPayload }) => {
            calls.push(args.payload);
            return overrides?.create !== undefined
              ? overrides.create(args.payload)
              : Effect.succeed(makeCreateResponse("11111111-1111-1111-1111-111111111111"));
          },
        },
      },
    } as unknown as ApiClient),
  );

  const layer = Layer.mergeAll(FakeApi, QueryClient.make(queryClient));

  return {
    queryClient,
    calls,
    run: <A, E>(self: Effect.Effect<A, E, ApiClient | QueryClient>) =>
      Effect.runPromise(self.pipe(Effect.provide(layer))),
  };
};

let harness: ReturnType<typeof makeHarness>;

beforeEach(() => {
  harness = makeHarness();
});

afterEach(() => {
  harness.queryClient.clear();
});

describe("UsersQueries.createUser", () => {
  it("calls the API with the payload and returns the created response", async () => {
    const result = await harness.run(UsersQueries.createUser(validPayload));

    expect(harness.calls).toHaveLength(1);
    expect(harness.calls[0]?.email).toBe(validPayload.email);
    expect(result.id).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("invalidates every cached users page after a successful create", async () => {
    // Seed two pages and mark them as fresh by setting query state to success.
    const seed = (page: number) => {
      harness.queryClient.setQueryData(
        usersKeyFor(page, 10),
        new UserContract.PaginatedUsers({ users: [], page, pageSize: 10, total: 0 }),
      );
    };
    seed(1);
    seed(2);

    expect(harness.queryClient.getQueryState(usersKeyFor(1, 10))?.isInvalidated).not.toBe(true);
    expect(harness.queryClient.getQueryState(usersKeyFor(2, 10))?.isInvalidated).not.toBe(true);

    await harness.run(UsersQueries.createUser(validPayload));

    expect(harness.queryClient.getQueryState(usersKeyFor(1, 10))?.isInvalidated).toBe(true);
    expect(harness.queryClient.getQueryState(usersKeyFor(2, 10))?.isInvalidated).toBe(true);
  });
});
