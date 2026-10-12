import { render } from "@testing-library/svelte";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";

import OwnedRegistryProbe from "@/test/bridge/owned-registry-probe.svelte";

describe("provideRegistry", () => {
  it("disposes a registry it created when its component is destroyed", () => {
    const registries: Array<AtomRegistry.AtomRegistry> = [];
    const { unmount } = render(OwnedRegistryProbe, {
      onRegistry: (registry: AtomRegistry.AtomRegistry) => {
        registries.push(registry);
      },
    });
    expect(registries).toHaveLength(1);
    const registry = registries[0];
    expect(registry.get(Atom.make(1))).toBe(1);

    unmount();
    expect(() => registry.get(Atom.make(2))).toThrow();
  });
});
