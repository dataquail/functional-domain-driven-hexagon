import * as Effect from "effect/Effect";
import * as FiberRef from "effect/FiberRef";
import * as Option from "effect/Option";

export interface RequestContext {
  readonly requestId: string;
  readonly userId: Option.Option<string>;
  readonly traceId: Option.Option<string>;
}

const empty: RequestContext = {
  requestId: "unknown",
  userId: Option.none(),
  traceId: Option.none(),
};

export const CurrentRequestContext = FiberRef.unsafeMake<RequestContext>(empty);

export const get: Effect.Effect<RequestContext> = FiberRef.get(CurrentRequestContext);

export const withRequestContext =
  (ctx: RequestContext) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Effect.locally(effect, CurrentRequestContext, ctx);
