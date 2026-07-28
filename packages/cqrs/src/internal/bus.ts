import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import type * as Scope from "effect/Scope";
import type * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcClient from "effect/unstable/rpc/RpcClient";
import * as RpcServer from "effect/unstable/rpc/RpcServer";

import * as Message from "./message.js";

type ClientEnd = Effect.Success<
  ReturnType<typeof RpcClient.makeNoSerialization<Rpc.Any, never, false>>
>;

/**
 * Wires a group's dispatch surface in-process: payloads and results pass by
 * reference, so a message may carry a domain type (an aggregate root, an `Option`,
 * a branded id) that no wire format would survive.
 *
 * A dispatched message's requirement channel is empty — the handlers' services were
 * discharged by `handlersOf` at the composition root. Handlers observe the
 * dispatching fiber's context, which is what lets a message dispatched from inside
 * a caller's transaction join it rather than opening its own.
 *
 * Exactly one span is opened per dispatch, named `<spanPrefix>.<tag>` and annotated
 * from the tag's registered extractor.
 */
export const make = <G extends Message.AnyGroup<string>>(
  messageGroup: G,
  spanPrefix: string,
  extractors: Message.SpanAttributesErased,
): Effect.Effect<Message.Dispatcher<G>, never, Scope.Scope | Message.Registered<G>> =>
  Effect.gen(function* () {
    const group = Message.rpcGroupOf(messageGroup);

    // Each end writes to the other, so one of them has to be referenced before it
    // exists. The latch defers only that reference: it is resolved as soon as the
    // client is built, before any dispatch can happen.
    const clientLatch = yield* Deferred.make<ClientEnd>();
    const server = yield* RpcServer.makeNoSerialization(group, {
      // The client's span is the one kept. Tracing both ends would open two spans
      // for one logical dispatch; tracing only the server would leave the dispatch
      // detached from the caller's trace, since a server span takes its parent from
      // the span context the client sends.
      disableTracing: true,
      onFromServer: (response) =>
        Effect.flatMap(Deferred.await(clientLatch), (client) => client.write(response)),
    });
    const client = yield* RpcClient.makeNoSerialization(group, {
      supportsAck: true,
      spanPrefix,
      // `onFromClient` runs inside the span the client opened for this dispatch,
      // which is why attributes are annotated onto the current span here rather
      // than through server-side middleware.
      onFromClient: ({ message }) => {
        if (message._tag !== "Request") return server.write(0, message);
        const extractor = extractors[message.tag];
        return Effect.andThen(
          Effect.annotateCurrentSpan({
            [`${spanPrefix}.tag`]: message.tag,
            ...(extractor !== undefined ? extractor(message.payload) : {}),
          }),
          server.write(0, message),
        );
      },
    });
    yield* Deferred.succeed(clientLatch, client);
    return client.client as never;
  });
