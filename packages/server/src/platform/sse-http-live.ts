import { Api } from "@/api.js";
import { SseManager } from "@/platform/sse-manager.js";
import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder";
import * as HttpServerResponse from "@effect/platform/HttpServerResponse";
import { SseContract } from "@org/contracts/api/Contracts";
import { CurrentUser } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

const encodeTestEvent = Schema.encode(Schema.parseJson(SseContract.Events));

export const SseHttpLive = HttpApiBuilder.group(
  Api,
  "sse",
  Effect.fnUntraced(function* (handlers) {
    const sseManager = yield* SseManager;
    const textEncoder = new TextEncoder();

    const kaStream = Stream.repeat(Effect.succeed(":keep-alive"), Schedule.fixed("3 seconds"));

    return handlers
      .handleRaw("connect", () =>
        Effect.gen(function* () {
          const currentUser = yield* CurrentUser;

          const queue = yield* Queue.unbounded<string>();
          const connectionId = crypto.randomUUID();

          yield* sseManager.registerConnection({
            connectionId,
            queue,
            userId: currentUser.userId,
          });

          yield* Effect.addFinalizer(() =>
            sseManager.unregisterConnection({ connectionId, userId: currentUser.userId }),
          );

          const eventsStream = Stream.fromQueue(queue).pipe(
            Stream.map((eventString) => `data: ${eventString}`),
          );

          const bodyStream = Stream.merge(kaStream, eventsStream).pipe(
            Stream.map((line) => textEncoder.encode(`${line}\n\n`)),
          );

          return HttpServerResponse.stream(bodyStream, {
            contentType: "text/event-stream",
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "X-Accel-Buffering": "no",
              Connection: "keep-alive",
            },
          });
        }),
      )
      .handle("notify", () =>
        Effect.gen(function* () {
          const payload = yield* encodeTestEvent(
            new SseContract.TestEvent({ message: "hello" }),
          ).pipe(Effect.orDie);
          yield* sseManager.notifyCurrentUser(payload);
        }),
      );
  }),
);
