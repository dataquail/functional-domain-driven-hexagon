import { describe, expect, it } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Schema from "effect/Schema";

import { notificationAtom, notify } from "./notifications.shared";

class BoomError extends Schema.Error<BoomError, { readonly brand: "BoomError" }>("BoomError")({
  _tag: Schema.tag("BoomError"),
  detail: Schema.String,
}) {}

class OtherError extends Schema.Error<OtherError, { readonly brand: "OtherError" }>("OtherError")({
  _tag: Schema.tag("OtherError"),
}) {}

// `notify` needs an AtomContext, which only exists inside an atom. Running the
// subject through a one-shot `Atom.fn` is how a real ViewModel action reaches
// it, so the test exercises the same path production does.
const runNotified = <A, E extends { readonly _tag: string }>(
  registry: AtomRegistry.AtomRegistry,
  effect: Effect.Effect<A, E>,
  config: Parameters<typeof notify<A, E>>[1],
) => {
  const action = Atom.fn<void>()((_, get) => effect.pipe(notify(get, config)));
  registry.set(action, void 0);

  return Effect.exit(AtomRegistry.getResult(registry, action, { suspendOnWaiting: true }));
};

const latestMessage = (registry: AtomRegistry.AtomRegistry) =>
  Option.map(registry.get(notificationAtom), (notification) => notification.message);

describe("notify", () => {
  it.effect("records a success notification", () =>
    Effect.gen(function* () {
      const registry = AtomRegistry.make();
      yield* runNotified(registry, Effect.succeed({ name: "Ada" }), {
        success: (value) => `Saved ${value.name}`,
      });

      assertSome(registry.get(notificationAtom), { seq: 1, kind: "success", message: "Saved Ada" });
    }),
  );

  it.effect("uses the per-tag handler for a matching failure", () =>
    Effect.gen(function* () {
      const registry = AtomRegistry.make();
      yield* runNotified(registry, Effect.fail(new BoomError({ detail: "disk full" })), {
        errors: { BoomError: (error) => error.detail },
      });

      assertSome(registry.get(notificationAtom), { seq: 1, kind: "error", message: "disk full" });
    }),
  );

  it.effect("falls back to `otherwise` for an unhandled tag, then to a default", () =>
    Effect.gen(function* () {
      const withOtherwise = AtomRegistry.make();
      yield* runNotified<never, BoomError | OtherError>(
        withOtherwise,
        Effect.fail(new OtherError()),
        { errors: { BoomError: () => "never" }, otherwise: "Could not save" },
      );
      assertSome(latestMessage(withOtherwise), "Could not save");

      const bare = AtomRegistry.make();
      yield* runNotified(bare, Effect.fail(new OtherError()), {});
      assertSome(latestMessage(bare), "Something went wrong");
    }),
  );

  it.effect("advances the sequence so a repeated message is still a new notification", () =>
    Effect.gen(function* () {
      const registry = AtomRegistry.make();
      const config = { success: () => "Saved" };
      yield* runNotified(registry, Effect.succeed(1), config);
      expect(
        Option.map(registry.get(notificationAtom), (notification) => notification.seq),
      ).toEqual(Option.some(1));

      yield* runNotified(registry, Effect.succeed(1), config);
      assertSome(registry.get(notificationAtom), { seq: 2, kind: "success", message: "Saved" });
    }),
  );

  it.effect("leaves the success channel untouched", () =>
    Effect.gen(function* () {
      const registry = AtomRegistry.make();

      const exit = yield* runNotified(registry, Effect.succeed("payload"), {
        success: () => "ok",
      });

      assertTrue(Exit.isSuccess(exit));
    }),
  );
});
