import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { flushSync, tick } from "svelte";
import { describe, expect, it } from "vitest";

import SetProbe from "@/test/bridge/set-probe.svelte";
import SubscribeProbe from "@/test/bridge/subscribe-probe.svelte";
import ValueProbe from "@/test/bridge/value-probe.svelte";

// Node removal runs on the registry's own scheduler; this one runs its queue on demand.
const manualScheduler = () => {
  const queued: Array<() => void> = [];

  return {
    scheduleTask: (task: () => void) => {
      queued.push(task);

      return () => {
        queued.splice(queued.indexOf(task), 1);
      };
    },
    flush: () => {
      for (const task of queued.splice(0)) task();
    },
  };
};

const scheduledRegistry = () => {
  const scheduler = manualScheduler();
  const registry = AtomRegistry.make({ scheduleTask: scheduler.scheduleTask });

  const settle = async (): Promise<void> => {
    await tick();
    scheduler.flush();
  };

  return { registry, settle };
};

describe("atomValue", () => {
  it("renders the atom's value and follows every write", async () => {
    const registry = AtomRegistry.make();
    const count = Atom.make(1);
    render(ValueProbe, { registry, atom: count });
    expect(screen.getByTestId("value")).toHaveTextContent("1");

    registry.set(count, 2);
    await tick();
    expect(screen.getByTestId("value")).toHaveTextContent("2");
  });

  it("reads a derived atom that is built by the read", async () => {
    const registry = AtomRegistry.make();
    const count = Atom.make(3);
    const doubled = Atom.make((get) => get(count) * 2);
    render(ValueProbe, { registry, atom: doubled });
    expect(screen.getByTestId("value")).toHaveTextContent("6");

    registry.set(count, 4);
    await tick();
    expect(screen.getByTestId("value")).toHaveTextContent("8");
  });

  it("follows the atom its input resolves to", async () => {
    const registry = AtomRegistry.make();
    const first = Atom.make("first");
    const second = Atom.make("second");
    const { rerender } = render(ValueProbe, { registry, atom: first });
    await rerender({ registry, atom: second });
    expect(screen.getByTestId("value")).toHaveTextContent("second");

    registry.set(second, "updated");
    await tick();
    expect(screen.getByTestId("value")).toHaveTextContent("updated");
  });

  it("releases its subscription when the component unmounts", async () => {
    const { registry, settle } = scheduledRegistry();
    const count = Atom.make(1);
    const { unmount } = render(ValueProbe, { registry, atom: count });
    expect(registry.getNodes().has(count)).toBe(true);

    unmount();
    await settle();
    expect(registry.getNodes().has(count)).toBe(false);
  });
});

describe("atomSet", () => {
  it("writes the atom, which stays mounted while the component lives", async () => {
    const { registry, settle } = scheduledRegistry();
    const count = Atom.make(0);
    const { unmount } = render(SetProbe, { registry, atom: count, next: 5 });
    await settle();
    expect(registry.getNodes().has(count)).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "set" }));
    expect(registry.get(count)).toBe(5);

    unmount();
    await settle();
    expect(registry.getNodes().has(count)).toBe(false);
  });
});

describe("atomSubscribe", () => {
  it("hands each later value to the listener, in order, until unmount", async () => {
    const registry = AtomRegistry.make();
    const count = Atom.make(0);
    const heard: Array<number> = [];

    const listener = (value: number) => {
      heard.push(value);
    };

    const { unmount } = render(SubscribeProbe, { registry, atom: count, listener });
    flushSync();

    registry.set(count, 1);
    registry.set(count, 2);
    expect(heard).toEqual([1, 2]);

    unmount();
    registry.set(count, 3);
    expect(heard).toEqual([1, 2]);
  });
});
