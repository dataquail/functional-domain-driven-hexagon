// Render harness for View tests.
//
// A View's contract is "given these atom values, render this; on this
// interaction, write that". The harness therefore hands the test the registry
// itself: seeding it states the left-hand side, and reading it back after an
// interaction checks the right-hand side. No server, no fetch, and no ViewModel
// derivation in between.

import { render, type RenderResult } from "@testing-library/svelte";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { Component } from "svelte";
import { afterEach } from "vitest";

import ViewHarness from "./view-harness.svelte";

export type ViewHarnessResult<Props extends Record<string, unknown>> = {
  readonly registry: AtomRegistry.AtomRegistry;
  readonly rendered: RenderResult<typeof ViewHarness<Props>>;
};

// Registries are disposed between tests: mounting a View mounts the query atoms
// it reads, and a reactivity-wrapped atom fetches on mount however it was
// seeded, so an in-flight request would otherwise outlive its test.
const liveRegistries: Array<AtomRegistry.AtomRegistry> = [];

afterEach(() => {
  while (liveRegistries.length > 0) {
    liveRegistries.pop()?.dispose();
  }
});

export const renderView = <Props extends Record<string, unknown>>(
  view: Component<Props>,
  props: Props,
  options: {
    readonly initialValues?: NonNullable<Parameters<typeof AtomRegistry.make>[0]>["initialValues"];
    readonly fallback?: string;
  } = {},
): ViewHarnessResult<Props> => {
  const registry = AtomRegistry.make({ initialValues: options.initialValues });
  liveRegistries.push(registry);

  const rendered = render(ViewHarness<Props>, {
    props: {
      registry,
      view,
      props,
      fallback: options.fallback,
    },
  });

  return { registry, rendered };
};
