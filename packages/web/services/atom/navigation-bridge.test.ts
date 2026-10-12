import { render } from "@testing-library/svelte";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";

import type { NavigationSink } from "./navigation.shared";

const { goto, page } = vi.hoisted(() => ({
  goto: vi.fn(() => Promise.resolve()),
  page: { url: new URL("http://app.test/orgs/1/members") },
}));

vi.mock("$app/navigation", () => ({ goto }));
vi.mock("$app/state", () => ({ page }));

const { default: NavigationProbe } = await import("@/test/navigation/navigation-probe.svelte");
const { navigateTo, navigationRequestAtom, pathnameAtom } = await import("./navigation.shared");

describe("NavigationBridge", () => {
  it("mirrors the current path into the graph before anything renders", () => {
    const registry = AtomRegistry.make();
    render(NavigationProbe, { registry });

    expect(registry.get(pathnameAtom)).toBe("/orgs/1/members");
  });

  it("turns each navigation request into a client-side transition", () => {
    const registry = AtomRegistry.make();
    render(NavigationProbe, { registry });

    const sink: NavigationSink = Object.assign(<A>(atom: Atom.Atom<A>) => registry.get(atom), {
      set: <R, W>(atom: Atom.Writable<R, W>, value: W) => {
        registry.set(atom, value);
      },
    });
    navigateTo(sink, "/orgs/2");
    navigateTo(sink, "/orgs/2");

    expect(goto.mock.calls).toEqual([["/orgs/2"], ["/orgs/2"]]);
    expect(registry.get(navigationRequestAtom)?.seq).toBe(2);
  });
});
