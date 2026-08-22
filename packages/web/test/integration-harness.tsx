// Integration-tier render harness. Mounts what a real route's `page.tsx`
// composes -- `ThemeProvider` → registry → notification bridge → `<Toaster />`
// -- with the API transport pointed at the base URL MSW intercepts.
//
// The navigation bridge is deliberately absent: it holds the Next router, which
// has no meaning outside an App Router render. A test that cares where the app
// tried to go reads `navigationRequestAtom` instead, which is exactly what the
// bridge would have read.
//
// Tests register the handlers their scenario needs via `server.use(...)` before
// calling `renderWithHarness(<RoutePage />)`, then drive the UI through the RTL
// page driver in `packages/test-drivers`.

import { RegistryContext } from "@effect/atom-react";
import { Toaster } from "@org/components/primitives/toaster";
import { ThemeProvider } from "@org/components/providers/theme-provider";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import * as React from "react";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";
import { NotificationBridge } from "@/services/atom/notification-bridge.client";

import { TEST_API_BASE } from "./typed-handler";

export type IntegrationHarness = {
  readonly registry: AtomRegistry.AtomRegistry;
  readonly dispose: () => Promise<void>;
};

// Node's fetch needs an absolute URL, which is why this cannot simply be the
// app's relative `/api`.
const makeRegistry = (): AtomRegistry.AtomRegistry =>
  AtomRegistry.make({
    initialValues: [[apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }]],
  });

const HarnessProviders: React.FC<{
  children: React.ReactNode;
  registry: AtomRegistry.AtomRegistry;
}> = ({ children, registry }) => (
  <ThemeProvider>
    <RegistryContext.Provider value={registry}>
      <React.Suspense fallback="loading">{children}</React.Suspense>
      <NotificationBridge />
      <Toaster />
    </RegistryContext.Provider>
  </ThemeProvider>
);

/**
 * Render a component inside the integration providers. Returns the usual RTL
 * result plus the per-test `registry`, so a test can seed an atom before
 * rendering or read one back afterwards. `dispose()` is wired into vitest's
 * afterEach via the `cleanup()` call in `test/setup.ts`.
 */
export const renderWithHarness = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
): RenderResult & IntegrationHarness => {
  const registry = makeRegistry();

  const result = render(ui, {
    ...options,
    wrapper: ({ children }) => <HarnessProviders registry={registry}>{children}</HarnessProviders>,
  });

  return {
    ...result,
    registry,
    dispose: async () => {
      registry.dispose();
    },
  };
};
