import { describe, expect, it } from "@effect/vitest";
import { UserId } from "@org/contracts/EntityIds";
import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";
import { SseManager } from "./sse-manager.js";

const testUserId = (id: number) => UserId.make(`user_${id}`);

describe("SseManager", () => {
  it.scoped(
    "delivers payload to all connections for a specific user & shuts down queues on unregister",
    () =>
      Effect.gen(function* () {
        const manager = yield* SseManager;
        const userId = testUserId(3);
        const otherUserId = testUserId(33);
        const queue1 = yield* Queue.unbounded<string>();
        const queue2 = yield* Queue.unbounded<string>();
        const queueOther = yield* Queue.unbounded<string>();

        yield* manager.registerConnection({ userId, connectionId: "conn-3-1", queue: queue1 });
        yield* manager.registerConnection({ userId, connectionId: "conn-3-2", queue: queue2 });
        yield* manager.registerConnection({
          userId: otherUserId,
          connectionId: "conn-other",
          queue: queueOther,
        });

        yield* manager.notifyUser({ userId, payload: "hello" });

        expect(yield* queue1.take).toBe("hello");
        expect(yield* queue2.take).toBe("hello");
        expect(yield* queueOther.size).toBe(0);

        yield* manager.unregisterConnection({ userId, connectionId: "conn-3-1" });
        yield* manager.unregisterConnection({ userId, connectionId: "conn-3-2" });
        yield* manager.unregisterConnection({
          userId: otherUserId,
          connectionId: "conn-other",
        });

        expect(yield* queue1.isShutdown).toBe(true);
        expect(yield* queue2.isShutdown).toBe(true);
        expect(yield* queueOther.isShutdown).toBe(true);
      }).pipe(Effect.provide(SseManager.Default)),
  );

  it.scoped("delivers payload to every connection with notifyAll", () =>
    Effect.gen(function* () {
      const manager = yield* SseManager;
      const queue1 = yield* Queue.unbounded<string>();
      const queue2 = yield* Queue.unbounded<string>();

      yield* manager.registerConnection({
        userId: testUserId(1),
        connectionId: "conn-1",
        queue: queue1,
      });
      yield* manager.registerConnection({
        userId: testUserId(2),
        connectionId: "conn-2",
        queue: queue2,
      });

      yield* manager.notifyAll({ payload: "broadcast" });

      expect(yield* queue1.take).toBe("broadcast");
      expect(yield* queue2.take).toBe("broadcast");
    }).pipe(Effect.provide(SseManager.Default)),
  );
});
