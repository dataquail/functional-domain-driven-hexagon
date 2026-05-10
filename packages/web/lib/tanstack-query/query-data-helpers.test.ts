import { QueryClient } from "@/services/common/query-client";
import { QueryClient as TanstackQueryClient } from "@tanstack/react-query";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { describe, expect, it } from "vitest";
import { makeHelpers, makeQueryKey } from "./query-data-helpers";

type User = { readonly id: string; readonly name: string };

const makeClient = () =>
  new TanstackQueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

const runWithClient = <A, E>(
  client: TanstackQueryClient,
  effect: Effect.Effect<A, E, QueryClient>,
) => Effect.runPromise(Effect.provide(effect, QueryClient.make(client)));

const runExitWithClient = <A, E>(
  client: TanstackQueryClient,
  effect: Effect.Effect<A, E, QueryClient>,
) => Effect.runPromiseExit(Effect.provide(effect, QueryClient.make(client)));

describe("makeQueryKey", () => {
  it("returns [key] for the void variant", () => {
    const userKey = makeQueryKey("user");
    expect(userKey()).toEqual(["user"]);
  });

  it("returns [key, variables] for the variable variant", () => {
    type Vars = { readonly id: string };
    const userKey = makeQueryKey<"user", Vars>("user");
    expect(userKey({ id: "123" })).toEqual(["user", { id: "123" }]);
  });
});

describe("makeHelpers.setData", () => {
  it("variable variant applies the mutative updater to the cached entry", async () => {
    const client = makeClient();
    type Vars = { readonly id: string };
    const userKey = makeQueryKey<"user", Vars>("user");
    const helpers = makeHelpers<User, Vars>(userKey);

    client.setQueryData(userKey({ id: "1" }), { id: "1", name: "Alice" });

    await runWithClient(
      client,
      helpers.setData({ id: "1" }, (draft) => {
        draft.name = "Bob";
      }),
    );

    expect(client.getQueryData(userKey({ id: "1" }))).toEqual({ id: "1", name: "Bob" });
  });

  it("void variant does not take variables and updates the single keyed entry", async () => {
    const client = makeClient();
    const settingsKey = makeQueryKey("settings");
    type Settings = { readonly theme: string };
    const helpers = makeHelpers<Settings>(settingsKey);

    client.setQueryData(settingsKey(), { theme: "light" });

    await runWithClient(
      client,
      helpers.setData((draft) => {
        draft.theme = "dark";
      }),
    );

    expect(client.getQueryData(settingsKey())).toEqual({ theme: "dark" });
  });

  it("an updater's explicit return replaces the cached value", async () => {
    const client = makeClient();
    const settingsKey = makeQueryKey("settings");
    type Settings = { readonly theme: string };
    const helpers = makeHelpers<Settings>(settingsKey);

    client.setQueryData(settingsKey(), { theme: "light" });

    await runWithClient(
      client,
      helpers.setData(() => ({ theme: "explicit-return" })),
    );

    expect(client.getQueryData(settingsKey())).toEqual({ theme: "explicit-return" });
  });

  it("setData on a missing key is a no-op (does not create an entry)", async () => {
    const client = makeClient();
    const settingsKey = makeQueryKey("settings");
    type Settings = { readonly theme: string };
    const helpers = makeHelpers<Settings>(settingsKey);

    await runWithClient(
      client,
      helpers.setData((draft) => {
        draft.theme = "dark";
      }),
    );

    // setData early-returns oldData (which is undefined) when no entry
    // exists; we should not create a new entry as a side effect.
    expect(client.getQueryData(settingsKey())).toBeUndefined();
  });
});

describe("makeHelpers.invalidateAllQueries / removeAllQueries", () => {
  it("invalidateAllQueries uses exact: false and the namespace key — affects all variants", async () => {
    const client = makeClient();
    type Vars = { readonly id: string };
    const userKey = makeQueryKey<"user", Vars>("user");
    const helpers = makeHelpers<User, Vars>(userKey);

    client.setQueryData(userKey({ id: "1" }), { id: "1", name: "Alice" });
    client.setQueryData(userKey({ id: "2" }), { id: "2", name: "Bob" });

    await runWithClient(client, helpers.invalidateAllQueries());

    const all = client.getQueryCache().findAll({ queryKey: ["user"] });
    expect(all.length).toBe(2);
    expect(all.every((q) => q.state.isInvalidated)).toBe(true);
  });

  it("removeAllQueries removes every entry under the namespace key", async () => {
    const client = makeClient();
    type Vars = { readonly id: string };
    const userKey = makeQueryKey<"user", Vars>("user");
    const helpers = makeHelpers<User, Vars>(userKey);

    client.setQueryData(userKey({ id: "1" }), { id: "1", name: "Alice" });
    client.setQueryData(userKey({ id: "2" }), { id: "2", name: "Bob" });

    await runWithClient(client, helpers.removeAllQueries());

    expect(client.getQueryCache().findAll({ queryKey: ["user"] }).length).toBe(0);
  });
});

describe("makeHelpers — Effect.orDie surfaces QueryClient failures as defects", () => {
  it("invalidateQuery dies when the underlying QueryClient throws", async () => {
    const failingClient = makeClient();
    failingClient.invalidateQueries = () => {
      throw new Error("boom");
    };

    const settingsKey = makeQueryKey("settings");
    type Settings = { readonly theme: string };
    const helpers = makeHelpers<Settings>(settingsKey);

    const exit = await runExitWithClient(failingClient, helpers.invalidateQuery());
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      // orDie converts to a defect, not a typed failure
      expect(exit.cause._tag).toBe("Die");
    }
  });

  it("refetchAllQueries dies when the underlying QueryClient throws", async () => {
    const failingClient = makeClient();
    failingClient.refetchQueries = () => {
      throw new Error("boom");
    };

    const settingsKey = makeQueryKey("settings");
    type Settings = { readonly theme: string };
    const helpers = makeHelpers<Settings>(settingsKey);

    const exit = await runExitWithClient(failingClient, helpers.refetchAllQueries());
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(exit.cause._tag).toBe("Die");
    }
  });
});
