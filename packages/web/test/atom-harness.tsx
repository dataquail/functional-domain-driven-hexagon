// Render harness for View tests.
//
// A View's contract is "given these atom values, render this; on this
// interaction, write that". The harness therefore hands the test the registry
// itself: seeding it states the left-hand side, and reading it back after an
// interaction checks the right-hand side. No server, no fetch, and no ViewModel
// derivation in between.

import { RegistryContext } from "@effect/atom-react";
import { render, type RenderResult } from "@testing-library/react";
import type * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import * as React from "react";
import { afterEach } from "vitest";

export type ViewHarness = {
  readonly registry: AtomRegistry.AtomRegistry;
  readonly rendered: RenderResult;
};

// Registries are disposed between tests. Mounting a View mounts the query atoms
// it reads, and a reactivity-wrapped atom fetches on mount however it was
// seeded -- so without this, an in-flight request outlives the test that
// started it and its failure lands with no consumer, as an unhandled rejection
// attributed to whichever test happened to be running.
const liveRegistries: Array<AtomRegistry.AtomRegistry> = [];

afterEach(() => {
  while (liveRegistries.length > 0) {
    liveRegistries.pop()?.dispose();
  }
});

export const renderView = (
  ui: React.ReactElement,
  options: {
    readonly initialValues?: Iterable<readonly [Atom.Atom<any>, any]>;
    readonly fallback?: React.ReactNode;
  } = {},
): ViewHarness => {
  const registry = AtomRegistry.make({ initialValues: options.initialValues });
  liveRegistries.push(registry);
  const rendered = render(
    <RegistryContext.Provider value={registry}>
      <React.Suspense fallback={options.fallback ?? "loading"}>{ui}</React.Suspense>
    </RegistryContext.Provider>,
  );
  return { registry, rendered };
};
