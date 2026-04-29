import { type UserId } from "@org/contracts/EntityIds";
import { CurrentUser } from "@org/contracts/Policy";
import * as Array from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Option from "effect/Option";
import type * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";

// Type-agnostic SSE delivery service. Tracks connections per user and writes
// already-encoded payload strings into their queues. Modules own their event
// schemas and encoding; the platform only delivers strings (modules/<x>/
// infrastructure/<x>-notifier.ts is the typical encoding seam).

type ActiveConnection = {
  readonly connectionId: string;
  readonly queue: Queue.Queue<string>;
};

export class SseManager extends Effect.Service<SseManager>()("SseManager", {
  effect: Effect.gen(function* () {
    const connectionsRef = yield* Ref.make(MutableHashMap.empty<UserId, Array<ActiveConnection>>());

    const registerConnection = ({
      connectionId,
      queue,
      userId,
    }: {
      userId: UserId;
      connectionId: string;
      queue: Queue.Queue<string>;
    }) =>
      Ref.update(connectionsRef, (map) =>
        MutableHashMap.modifyAt(map, userId, (activeConnections) =>
          activeConnections.pipe(
            Option.map(Array.append({ connectionId, queue })),
            Option.orElse(() => Option.some(Array.make({ connectionId, queue }))),
          ),
        ),
      );

    const unregisterConnection = ({
      connectionId,
      userId,
    }: {
      userId: UserId;
      connectionId: string;
    }) =>
      Ref.modify(connectionsRef, (map) => {
        const connectionToRemove = MutableHashMap.get(map, userId).pipe(
          Option.flatMap((connections) =>
            Array.findFirst(connections, (connection) => connection.connectionId === connectionId),
          ),
        );

        if (Option.isNone(connectionToRemove)) {
          return [Effect.void, map] as const;
        }

        return [
          connectionToRemove.value.queue.shutdown,
          pipe(
            map,
            MutableHashMap.modify(
              userId,
              Array.filter((connection) => connection.connectionId !== connectionId),
            ),
          ),
        ];
      }).pipe(Effect.flatten);

    const notifyUser = ({ payload, userId }: { userId: UserId; payload: string }) =>
      Effect.gen(function* () {
        const connections = yield* Ref.get(connectionsRef);
        const connectionsForUser = MutableHashMap.get(connections, userId);
        if (Option.isNone(connectionsForUser) || connectionsForUser.value.length === 0) {
          return;
        }

        yield* Effect.forEach(
          connectionsForUser.value,
          (connection) => connection.queue.offer(payload),
          {
            concurrency: "unbounded",
            discard: true,
          },
        );
      });

    const notifyCurrentUser = (payload: string) =>
      Effect.gen(function* () {
        const currentUser = yield* CurrentUser;
        yield* notifyUser({ payload, userId: currentUser.userId });
      });

    const notifyAll = ({ payload }: { payload: string }) =>
      Effect.gen(function* () {
        const connectionsMap = yield* Ref.get(connectionsRef);
        const allConnections = Array.flatten(MutableHashMap.values(connectionsMap));

        if (allConnections.length === 0) {
          return;
        }

        yield* Effect.forEach(allConnections, (connection) => connection.queue.offer(payload), {
          concurrency: "unbounded",
          discard: true,
        });
      });

    return {
      registerConnection,
      unregisterConnection,
      notifyUser,
      notifyCurrentUser,
      notifyAll,
    };
  }),
}) {}
