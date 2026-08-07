import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import type * as Layer from "effect/Layer";
import type * as Schema from "effect/Schema";
import type * as Scope from "effect/Scope";
import * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcClient from "effect/unstable/rpc/RpcClient";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import * as RpcServer from "effect/unstable/rpc/RpcServer";

import type { Middleware } from "../middleware.js";

/**
 * The one place in this package that knows what carries a message.
 *
 * Everything else works against the aliases below, so the transport is a single
 * file to replace rather than a concern spread through the package. That is worth
 * something concrete: `effect/unstable/rpc` is explicitly unstable and pinned to an
 * exact beta, and this package is meant to be published — the day a bump breaks,
 * the blast radius is here and nowhere else. A dependency rule keeps it that way.
 *
 * Deliberately *not* an abstract interface with one implementation. Nothing is
 * gained by describing a transport in the abstract before a second one exists, and
 * the carrier types would have to be erased to `unknown` at the boundary to do it —
 * paying in casts and readability for a generality nobody is using yet.
 */

/** What a single message is carried by. */
export type Carrier<
  Tag extends string,
  Payload extends Schema.Top,
  Success extends Schema.Top,
  Failure extends Schema.Top,
> = Rpc.Rpc<Tag, Payload, Success, Failure>;

/** Erased `Carrier`, for constraints. */
export type AnyCarrier = Rpc.Any;

/** What a group of messages is carried by. */
export type GroupCarrier<Carriers extends AnyCarrier> = RpcGroup.RpcGroup<Carriers>;

/** Erased `GroupCarrier`, for constraints. */
export type AnyGroupCarrier = RpcGroup.Any;

/**
 * The handler record a group demands: one function per tag, taking that message's
 * payload and returning its declared success and failure.
 *
 * This lives with the transport because it is the transport that consumes it, and
 * because the requirement-hoisting the whole design rests on comes from how that
 * record is turned into a Layer — not from anything this package implements.
 */
export type HandlersFrom<Carriers extends AnyCarrier> = RpcGroup.HandlersFrom<Carriers>;

/** The services a handler record collectively requires, inferred rather than declared. */
export type HandlerServicesFrom<Carriers extends AnyCarrier, Handlers> = RpcGroup.HandlersServices<
  Carriers,
  Handlers
>;

export const makeCarrier = (
  tag: string,
  options:
    | {
        readonly payload?: unknown;
        readonly success?: unknown;
        readonly failure?: unknown;
      }
    | undefined,
): AnyCarrier =>
  Rpc.make(tag, {
    ...(options?.payload !== undefined ? { payload: options.payload as Schema.Top } : {}),
    ...(options?.success !== undefined ? { success: options.success as Schema.Top } : {}),
    ...(options?.failure !== undefined ? { error: options.failure as Schema.Top } : {}),
  });

export const makeGroupCarrier = (carriers: ReadonlyArray<AnyCarrier>): AnyGroupCarrier =>
  RpcGroup.make(...carriers);

/**
 * Turns a handler record into a Layer whose requirement channel carries the
 * handlers' own requirements.
 *
 * That single property is what the rest of the design turns on: a module can absorb
 * its own outbound adapter because the foreign requirement is *inferred* here
 * rather than written down anywhere.
 */
export const registerHandlers = (
  groupCarrier: AnyGroupCarrier,
  handlers: unknown,
): Layer.Layer<never, never, never> =>
  (groupCarrier as RpcGroup.RpcGroup<AnyCarrier>).toLayer(handlers as never);

type ClientEnd = Effect.Success<
  ReturnType<typeof RpcClient.makeNoSerialization<Rpc.Any, never, false>>
>;

/**
 * Wires a group's dispatch surface in-process: payloads and results pass by
 * reference, so a message may carry a domain type (an aggregate root, an `Option`,
 * a branded id) that no wire format would survive.
 *
 * A dispatched message's requirement channel is empty — the handlers' services were
 * discharged where the group was registered. Handlers observe the dispatching
 * fiber's context, which is what lets a message dispatched from inside a caller's
 * transaction join it rather than opening its own.
 *
 * Cross-cutting behaviour, tracing included, is supplied as middleware wrapped
 * around each tag. The transport adds none, so what a dispatch does beyond delivery
 * is decided in one place and does not move if this file is ever replaced.
 */
export const makeDispatcher = (
  groupCarrier: AnyGroupCarrier,
  tags: ReadonlyArray<string>,
  side: "command" | "query",
  middleware: ReadonlyArray<Middleware>,
): Effect.Effect<
  Record<string, (payload: never) => Effect.Effect<unknown, unknown>>,
  never,
  Scope.Scope
> =>
  Effect.gen(function* () {
    const group = groupCarrier as RpcGroup.RpcGroup<Rpc.Any>;

    // Each end writes to the other, so one of them has to be referenced before it
    // exists. The latch defers only that reference: it is resolved as soon as the
    // client is built, before any dispatch can happen.
    const clientLatch = yield* Deferred.make<ClientEnd>();
    const server = yield* RpcServer.makeNoSerialization(group, {
      disableTracing: true,
      onFromServer: (response) =>
        Effect.flatMap(Deferred.await(clientLatch), (client) => client.write(response)),
    });
    const client = yield* RpcClient.makeNoSerialization(group, {
      supportsAck: true,
      // No `spanPrefix`: the client would otherwise open a span of its own, and a
      // dispatch would be traced twice once the span middleware is installed.
      disableTracing: true,
      onFromClient: ({ message }) => server.write(0, message),
    });
    yield* Deferred.succeed(clientLatch, client);

    const dispatch = client.client as Record<
      string,
      (payload: never) => Effect.Effect<unknown, unknown>
    >;
    const wrapped: Record<string, (payload: never) => Effect.Effect<unknown, unknown>> = {};
    for (const tag of tags) {
      const forTag = dispatch[tag];
      // The tags come from the same group the client was built over, so this is
      // total; the guard is here because the lookup cannot say so.
      if (forTag === undefined) continue;

      const context = { tag, side };
      // Reduced from the right so the first middleware given is the outermost,
      // which is the order a reader assumes from the list.
      wrapped[tag] = middleware.reduceRight((next, wrap) => wrap(next, context), forTag);
    }
    return wrapped;
  });
