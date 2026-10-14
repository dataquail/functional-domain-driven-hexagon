// Integration-tier render harness. Mounts what the app's root layout composes
// -- theme → registry → notification bridge → toaster -- with the API transport
// pointed at the base URL MSW intercepts.
//
// The navigation bridge is deliberately absent: it holds SvelteKit's router,
// which has no meaning outside a Kit render. A test that cares where the app
// tried to go reads `navigationRequestAtom` instead, which is exactly what the
// bridge would have read.

import { dismissToasts } from "@org/components/primitives/toaster";
import { render, type RenderResult } from "@testing-library/svelte";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { Component } from "svelte";
import { afterEach } from "vitest";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";

import IntegrationProviders from "./integration-providers.svelte";
import { TEST_API_BASE } from "./typed-handler";

export type IntegrationHarness = RenderResult<typeof IntegrationProviders> & {
  readonly registry: AtomRegistry.AtomRegistry;
};

const liveRegistries: Array<AtomRegistry.AtomRegistry> = [];

afterEach(() => {
  dismissToasts();
  while (liveRegistries.length > 0) {
    liveRegistries.pop()?.dispose();
  }
});

// Node's fetch needs an absolute URL, which is why this cannot simply be the
// app's relative `/api`.
export const renderWithHarness = <Props extends Record<string, unknown>>(
  view: Component<Props>,
  props?: Props,
): IntegrationHarness => {
  const registry = AtomRegistry.make({
    initialValues: [[apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }]],
  });
  liveRegistries.push(registry);
  const rendered = render(IntegrationProviders, {
    props: {
      registry,
      view: view as Component<Record<string, unknown>>,
      props: props ?? {},
    },
  });
  return { ...rendered, registry };
};
