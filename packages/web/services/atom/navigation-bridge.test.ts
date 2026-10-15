import { render } from "@testing-library/svelte";
import * as Option from "effect/Option";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { beforeEach, describe, expect, it } from "vitest";

import { navigations } from "@/test/kit/navigation";
import { page } from "@/test/kit/state";
import NavigationProbe from "@/test/navigation/navigation-probe.svelte";

import {
  navigateTo,
  navigationRequestAtom,
  type NavigationSink,
  pathnameAtom,
} from "./navigation.shared";

beforeEach(() => {
  navigations.length = 0;
  page.url = new URL("http://app.test/orgs/1/members");
});

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

    expect(navigations).toEqual(["/orgs/2", "/orgs/2"]);
    expect(Option.map(registry.get(navigationRequestAtom), (request) => request.seq)).toEqual(
      Option.some(2),
    );
  });
});
