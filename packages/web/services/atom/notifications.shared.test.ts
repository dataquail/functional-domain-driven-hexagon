import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";

import { notificationAtom, notify } from "./notifications.shared";

class BoomError extends Schema.ErrorClass<BoomError>("BoomError")({
  _tag: Schema.tag("BoomError"),
  detail: Schema.String,
}) {}

class OtherError extends Schema.ErrorClass<OtherError>("OtherError")({
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
  registry.set(action, undefined);
  return Effect.runPromiseExit(
    AtomRegistry.getResult(registry, action, { suspendOnWaiting: true }),
  );
};

describe("notify", () => {
  it("records a success notification", async () => {
    const registry = AtomRegistry.make();
    await runNotified(registry, Effect.succeed({ name: "Ada" }), {
      success: (value) => `Saved ${value.name}`,
    });

    expect(registry.get(notificationAtom)).toEqual({
      seq: 1,
      kind: "success",
      message: "Saved Ada",
    });
  });

  it("uses the per-tag handler for a matching failure", async () => {
    const registry = AtomRegistry.make();
    await runNotified(registry, Effect.fail(new BoomError({ detail: "disk full" })), {
      errors: { BoomError: (error) => error.detail },
    });

    expect(registry.get(notificationAtom)?.message).toBe("disk full");
    expect(registry.get(notificationAtom)?.kind).toBe("error");
  });

  it("falls back to `otherwise` for an unhandled tag, then to a default", async () => {
    const withOtherwise = AtomRegistry.make();
    await runNotified<never, BoomError | OtherError>(withOtherwise, Effect.fail(new OtherError()), {
      errors: { BoomError: () => "never" },
      otherwise: "Could not save",
    });
    expect(withOtherwise.get(notificationAtom)?.message).toBe("Could not save");

    const bare = AtomRegistry.make();
    await runNotified(bare, Effect.fail(new OtherError()), {});
    expect(bare.get(notificationAtom)?.message).toBe("Something went wrong");
  });

  it("advances the sequence so a repeated message is still a new notification", async () => {
    const registry = AtomRegistry.make();
    const config = { success: () => "Saved" };
    await runNotified(registry, Effect.succeed(1), config);
    expect(registry.get(notificationAtom)?.seq).toBe(1);

    await runNotified(registry, Effect.succeed(1), config);
    expect(registry.get(notificationAtom)).toEqual({ seq: 2, kind: "success", message: "Saved" });
  });

  it("leaves the success channel untouched", async () => {
    const registry = AtomRegistry.make();
    const exit = await runNotified(registry, Effect.succeed("payload"), {
      success: () => "ok",
    });
    expect(exit._tag).toBe("Success");
  });
});
