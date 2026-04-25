import { SseContract } from "@org/domain/api/Contracts";
import * as Effect from "effect/Effect";
import * as Either from "effect/Either";
import * as Fiber from "effect/Fiber";
import { constant, constVoid } from "effect/Function";
import * as Option from "effect/Option";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as React from "react";
import { ApiClient } from "../common/api-client";
import { NetworkMonitor } from "../common/network-monitor";
import { useRuntime } from "../runtime/use-runtime";
import { TodosQueries } from "./todos-queries";

export namespace SseQueries {
  export const SseConnector: React.FC = () => {
    const runtime = useRuntime();
    const hasRun = React.useRef(false);

    React.useEffect(() => {
      if (hasRun.current) return constVoid;
      hasRun.current = true;

      const handler = Effect.flatMap(NetworkMonitor, (monitor) =>
        Effect.gen(function* () {
          const { unsafeClient } = yield* ApiClient;

          const response = yield* unsafeClient.sse.connect();

          yield* Effect.log("[SseConnector] connected");

          const source = yield* response.stream.pipe(
            Stream.decodeText(),
            Stream.splitLines,
            Stream.filter((str) => str.length > 0),
            Stream.share({ capacity: "unbounded" }),
          );

          const keepAliveStream = source.pipe(
            Stream.filter((line) => line.startsWith(":keep-alive")),
            Stream.timeout("8 seconds"),
            Stream.tapError(() => Effect.logError("[SseConnector] ka timed out")),
          );

          const dataStream = yield* source.pipe(
            Stream.filter((line) => line.startsWith("data:")),
            Stream.map((line) => line.substring(5).trim()),
            Stream.filter((jsonString) => jsonString.length > 0),
            Stream.tap((event) => Effect.logDebug("[SseConnector] event", event)),
            Stream.map(Schema.decodeEither(Schema.parseJson(SseContract.Events))),
            Stream.tap((either) =>
              Either.isLeft(either)
                ? Effect.logWarning("Failed to decode SSE event", either.left.message)
                : Effect.void,
            ),
            Stream.filterMap(
              Either.match({
                onLeft: constant(Option.none()),
                onRight: (event) => Option.some(event),
              }),
            ),
            Stream.share({ capacity: "unbounded" }),
          );

          const mergedStream = keepAliveStream.pipe(Stream.merge(TodosQueries.stream(dataStream)));

          yield* Stream.runDrain(mergedStream);

          yield* Effect.log("[SseConnector] drained");
          yield* Effect.fail("restart");
        }).pipe(
          Effect.catchAllCause((cause) =>
            Effect.logError(cause).pipe(Effect.zipRight(Effect.fail(cause))),
          ),
          Effect.scoped,
          monitor.latch.whenOpen,
          Effect.retry(Schedule.spaced("3 seconds")),
        ),
      );

      const fiber = runtime.runFork(handler);
      return () => Fiber.interrupt(fiber);
    }, [runtime]);

    return null;
  };
}
