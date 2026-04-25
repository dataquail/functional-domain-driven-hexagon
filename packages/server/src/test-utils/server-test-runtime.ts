import { truncate } from "@/test-utils/test-database.js";
import { TestServerLive } from "@/test-utils/test-server.js";
import * as Effect from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { afterAll, beforeAll, beforeEach } from "vitest";

type ServerContext = Layer.Layer.Success<typeof TestServerLive>;
type ServerError = Layer.Layer.Error<typeof TestServerLive>;

export type ServerTestRuntime = {
  readonly run: <A, E>(effect: Effect.Effect<A, E, ServerContext>) => Promise<A>;
};

// Wires the server runtime + per-test truncation into the surrounding describe
// block. Call inside a describe; receive `run` for executing test effects
// against a fully-composed in-memory server.
export const useServerTestRuntime = (truncateTables: ReadonlyArray<string>): ServerTestRuntime => {
  let runtime: ManagedRuntime.ManagedRuntime<ServerContext, ServerError>;

  beforeAll(async () => {
    runtime = ManagedRuntime.make(TestServerLive);
    await runtime.runPromise(Effect.void);
  });

  afterAll(async () => {
    await runtime.dispose();
  });

  beforeEach(async () => {
    await runtime.runPromise(truncate(...truncateTables));
  });

  return {
    run: <A, E>(effect: Effect.Effect<A, E, ServerContext>) => runtime.runPromise(effect),
  };
};
