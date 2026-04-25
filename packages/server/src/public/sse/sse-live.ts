import { Api } from "@/api.js";
import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder";
import * as HttpServerResponse from "@effect/platform/HttpServerResponse";
import { TestEvent } from "@org/domain/api/SseContract";
import { CurrentUser } from "@org/domain/Policy";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Queue from "effect/Queue";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { SseManager } from "./sse-manager.js";

export const SseLive = HttpApiBuilder.group(
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
          const currentUser = yield* CurrentUser;

          yield* sseManager.notifyUser({
            userId: currentUser.userId,
            event: new TestEvent({ message: "hello" }),
          });
        }),
      );
  }),
).pipe(Layer.provide(SseManager.Default));
