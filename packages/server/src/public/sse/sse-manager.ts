import { SseContract } from "@org/domain/api/Contracts";
import { type UserId } from "@org/domain/EntityIds";
import { CurrentUser } from "@org/domain/Policy";
import * as Array from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Option from "effect/Option";
import type * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";

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

    const notifyUser = ({ event, userId }: { userId: UserId; event: SseContract.Events }) =>
      Effect.gen(function* () {
        const connections = yield* Ref.get(connectionsRef);
        const connectionsForUser = MutableHashMap.get(connections, userId);
        if (Option.isNone(connectionsForUser) || connectionsForUser.value.length === 0) {
          return;
        }

        const encodedEvent = yield* Schema.encode(Schema.parseJson(SseContract.Events))(event).pipe(
          Effect.orDie,
        );

        yield* Effect.forEach(
          connectionsForUser.value,
          (connection) => connection.queue.offer(encodedEvent),
          {
            concurrency: "unbounded",
            discard: true,
          },
        );
      });

    const notifyCurrentUser = (event: SseContract.Events) =>
      Effect.gen(function* () {
        const currentUser = yield* CurrentUser;
        yield* notifyUser({ event, userId: currentUser.userId });
      });

    const notifyAll = ({ event }: { event: SseContract.Events }) =>
      Effect.gen(function* () {
        const connectionsMap = yield* Ref.get(connectionsRef);
        const allConnections = Array.flatten(MutableHashMap.values(connectionsMap));

        if (allConnections.length === 0) {
          return;
        }

        const encodedEvent = yield* Schema.encode(Schema.parseJson(SseContract.Events))(event).pipe(
          Effect.orDie,
        );

        yield* Effect.forEach(
          allConnections,
          (connection) => connection.queue.offer(encodedEvent),
          {
            concurrency: "unbounded",
            discard: true,
          },
        );
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
