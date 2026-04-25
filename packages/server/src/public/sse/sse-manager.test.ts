import { describe, expect, it } from "@effect/vitest";
import { SseContract } from "@org/domain/api/Contracts";
import { UserId } from "@org/domain/EntityIds";
import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Schema from "effect/Schema";
import { SseManager } from "./sse-manager.js";

const testUserId = (id: number) => UserId.make(`user_${id}`);

const SampleEvent = new SseContract.TestEvent({ message: "hello" });
const decodeMessage = Schema.decode(Schema.parseJson(SseContract.Events));

describe("SseManager", () => {
  it.scoped(
    "should send a message to all connections for a specific user & shutdown after unregistering",
    () =>
      Effect.gen(function* () {
        const manager = yield* SseManager;
        const userId = testUserId(3);
        const otherUserId = testUserId(33);
        const connectionId1 = "conn-3-1";
        const connectionId2 = "conn-3-2";
        const connectionIdOther = "conn-3-other";
        const queue1 = yield* Queue.unbounded<string>();
        const queue2 = yield* Queue.unbounded<string>();
        const queueOther = yield* Queue.unbounded<string>();

        yield* manager.registerConnection({ userId, connectionId: connectionId1, queue: queue1 });
        yield* manager.registerConnection({ userId, connectionId: connectionId2, queue: queue2 });
        yield* manager.registerConnection({
          userId: otherUserId,
          connectionId: connectionIdOther,
          queue: queueOther,
        });

        yield* manager.notifyUser({ userId, event: SampleEvent });

        const received1 = yield* queue1.take;
        const received2 = yield* queue2.take;
        const decoded1 = yield* decodeMessage(received1).pipe(Effect.orDie);
        const decoded2 = yield* decodeMessage(received2).pipe(Effect.orDie);
        expect(decoded1).toEqual(SampleEvent);
        expect(decoded2).toEqual(SampleEvent);

        const otherSize = yield* queueOther.size;
        expect(otherSize).toBe(0);

        yield* manager.unregisterConnection({ userId, connectionId: connectionId1 });
        yield* manager.unregisterConnection({ userId, connectionId: connectionId2 });
        yield* manager.unregisterConnection({
          userId: otherUserId,
          connectionId: connectionIdOther,
        });

        const queue1IsShutdown = yield* queue1.isShutdown;
        const queue2IsShutdown = yield* queue2.isShutdown;
        const queueOtherIsShutdown = yield* queueOther.isShutdown;
        expect(queue1IsShutdown).toBe(true);
        expect(queue2IsShutdown).toBe(true);
        expect(queueOtherIsShutdown).toBe(true);
      }).pipe(Effect.provide(SseManager.Default)),
  );

  it.scoped("should send a message to all connections with notifyAll", () =>
    Effect.gen(function* () {
      const manager = yield* SseManager;
      const userId1 = testUserId(1);
      const userId2 = testUserId(2);
      const connectionId1 = "conn-1";
      const connectionId2 = "conn-2";
      const queue1 = yield* Queue.unbounded<string>();
      const queue2 = yield* Queue.unbounded<string>();

      yield* manager.registerConnection({
        userId: userId1,
        connectionId: connectionId1,
        queue: queue1,
      });
      yield* manager.registerConnection({
        userId: userId2,
        connectionId: connectionId2,
        queue: queue2,
      });

      yield* manager.notifyAll({ event: SampleEvent });

      const received1 = yield* queue1.take;
      const received2 = yield* queue2.take;
      const decoded1 = yield* decodeMessage(received1).pipe(Effect.orDie);
      const decoded2 = yield* decodeMessage(received2).pipe(Effect.orDie);
      expect(decoded1).toEqual(SampleEvent);
      expect(decoded2).toEqual(SampleEvent);

      yield* manager.unregisterConnection({ userId: userId1, connectionId: connectionId1 });
      yield* manager.unregisterConnection({ userId: userId2, connectionId: connectionId2 });

      const queue1IsShutdown = yield* queue1.isShutdown;
      const queue2IsShutdown = yield* queue2.isShutdown;
      expect(queue1IsShutdown).toBe(true);
      expect(queue2IsShutdown).toBe(true);
    }).pipe(Effect.provide(SseManager.Default)),
  );
});
