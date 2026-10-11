import { render, screen } from "@testing-library/svelte";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Schema from "effect/Schema";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";

import ResultProbe from "@/test/bridge/result-probe.svelte";

const greeting = Atom.make<AsyncResult.AsyncResult<string, string>>(AsyncResult.initial()).pipe(
  Atom.serializable({
    key: "greeting",
    schema: AsyncResult.Schema({ success: Schema.String, error: Schema.String }),
  }),
);

const encoded = (value: string) =>
  ({
    "~effect/reactivity/Hydration/DehydratedAtom": true,
    key: "greeting",
    value: greeting[Atom.SerializableTypeId].encode(AsyncResult.success(value)),
    dehydratedAt: 0,
  }) as const;

describe("AtomResult", () => {
  it("shows the route's pending snippet while the result is initial", () => {
    render(ResultProbe, { registry: AtomRegistry.make(), atom: greeting });
    expect(screen.getByTestId("pending")).toBeInTheDocument();
    expect(screen.queryByTestId("value")).toBeNull();
  });

  it("renders the success value, and keeps it while a refresh is waiting", async () => {
    const registry = AtomRegistry.make();
    render(ResultProbe, { registry, atom: greeting });

    registry.set(greeting, AsyncResult.success("hello"));
    await tick();
    expect(screen.getByTestId("value")).toHaveTextContent("hello");

    registry.set(greeting, AsyncResult.waiting(AsyncResult.success("hello")));
    await tick();
    expect(screen.getByTestId("value")).toHaveTextContent("hello");
  });

  it("hands a failure to the nearest error boundary", async () => {
    const registry = AtomRegistry.make();
    render(ResultProbe, { registry, atom: greeting });

    registry.set(greeting, AsyncResult.fail("boom"));
    await tick();
    expect(screen.getByTestId("failed")).toHaveTextContent("boom");
  });
});

describe("HydrationBoundary", () => {
  it("renders a hydrated result on the first paint", () => {
    render(ResultProbe, {
      registry: AtomRegistry.make(),
      atom: greeting,
      state: [encoded("from the server")],
    });
    expect(screen.getByTestId("value")).toHaveTextContent("from the server");
  });

  it("hands a fresh prefetch to an atom that is already live", async () => {
    const registry = AtomRegistry.make();
    const unsubscribe = registry.subscribe(greeting, () => {}, { immediate: true });
    registry.set(greeting, AsyncResult.success("stale"));

    const { rerender } = render(ResultProbe, {
      registry,
      atom: greeting,
      state: [encoded("first")],
    });
    await tick();
    expect(screen.getByTestId("value")).toHaveTextContent("first");

    await rerender({ registry, atom: greeting, state: [encoded("second")] });
    await tick();
    expect(screen.getByTestId("value")).toHaveTextContent("second");
    unsubscribe();
  });
});
