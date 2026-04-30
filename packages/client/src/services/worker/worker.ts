import * as BrowserRuntime from "@effect/platform-browser/BrowserRuntime";
import * as BrowserWorkerRunner from "@effect/platform-browser/BrowserWorkerRunner";
import * as RpcServer from "@effect/rpc/RpcServer";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as WorkerHandlers from "./worker-handlers";
import { WorkerRpc } from "./worker-rpc";

const Live = WorkerRpc.toLayer(
  Effect.gen(function* () {
    yield* Effect.logInfo("Worker started");

    return {
      filterData: (req) =>
        Effect.gen(function* () {
          yield* Effect.logInfo(
            `Worker received request to filter ${req.data.length} items with threshold ${req.threshold}`,
          );

          // Demo-only delay so the UI's "filtering…" state is visible. The
          // actual logic lives in worker-handlers.ts and is unit-tested
          // there.
          yield* Effect.sleep("3 seconds");

          const filtered = yield* WorkerHandlers.filterData(req).pipe(
            Effect.tapError((e) => Effect.logError(e.message)),
          );
          yield* Effect.logInfo(`Worker finished filtering. Returning ${filtered.length} items.`);
          return filtered;
        }),
      calculatePrimes: ({ upperBound }) =>
        Effect.gen(function* () {
          yield* Effect.logInfo(`Worker received request to calculate primes up to ${upperBound}`);
          const count = yield* WorkerHandlers.calculatePrimes({ upperBound });
          yield* Effect.logInfo(`Worker finished calculating primes. Found ${count} primes.`);
          return count;
        }),
    };
  }),
);

const RpcWorkerServer = RpcServer.layer(WorkerRpc).pipe(
  Layer.provide(Live),
  Layer.provide(RpcServer.layerProtocolWorkerRunner),
  Layer.provide(BrowserWorkerRunner.layer),
);

BrowserRuntime.runMain(
  BrowserWorkerRunner.launch(RpcWorkerServer).pipe(
    Effect.tapErrorCause((error) => Effect.logError("[Worker]", error)),
  ),
);
