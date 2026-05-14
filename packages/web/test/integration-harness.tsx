// Integration-tier render harness. Wraps `@testing-library/react`'s
// `render` with the providers a real route's `page.tsx` would compose:
// `ThemeProvider` → `QueryClientProvider` → `RuntimeProvider` (with an
// `ApiClient` pointed at `TEST_API_BASE` so MSW intercepts) →
// `<Toaster>`. Fresh `QueryClient` per test prevents cache bleed.
//
// Tests register the handlers their scenario needs via
// `server.use(...)` before calling `renderWithHarness(<RoutePage />)`,
// then drive the UI through the RTL page driver in `packages/test-drivers`.

import { ApiClient } from "@/services/api-client.shared";
import { QueryClient as QueryClientService } from "@/services/common/query-client";
import { Toast } from "@/services/common/toast";
import { WebSdkLive } from "@/services/common/web-sdk.client";
import { RuntimeContext, type ClientManagedRuntime } from "@/services/runtime.client";
import * as FetchHttpClient from "@effect/platform/FetchHttpClient";
import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { Toaster } from "@org/components/primitives/toaster";
import { ThemeProvider } from "@org/components/providers/theme-provider";
import { DomainApi } from "@org/contracts/DomainApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as React from "react";
import { TEST_API_BASE } from "./typed-handler";

const ApiClientTestLive = Layer.effect(
  ApiClient,
  Effect.gen(function* () {
    const client = yield* HttpApiClient.make(DomainApi, { baseUrl: TEST_API_BASE });
    return ApiClient.of({ client });
  }),
).pipe(Layer.provide(FetchHttpClient.layer));

const buildTestLive = (queryClient: QueryClient) =>
  Layer.mergeAll(ApiClientTestLive, Toast.Default, QueryClientService.make(queryClient)).pipe(
    Layer.provide(WebSdkLive),
  );

const makeQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

export type IntegrationHarness = {
  readonly queryClient: QueryClient;
  readonly runtime: ClientManagedRuntime;
  readonly dispose: () => Promise<void>;
};

const HarnessProviders: React.FC<{
  children: React.ReactNode;
  queryClient: QueryClient;
  runtime: ClientManagedRuntime;
}> = ({ children, queryClient, runtime }) => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <RuntimeContext.Provider value={runtime}>
        {children}
        <Toaster />
      </RuntimeContext.Provider>
    </QueryClientProvider>
  </ThemeProvider>
);

/**
 * Render a component inside the integration providers. Returns the
 * usual RTL result plus the per-test `queryClient` and `runtime` so
 * tests that need to assert on cache state or run an Effect directly
 * can do so. `dispose()` is wired into vitest's afterEach via the
 * `cleanup()` call in `test/setup.ts` — the runtime is also disposed
 * when its closure goes out of scope at process exit.
 */
export const renderWithHarness = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
): RenderResult & IntegrationHarness => {
  const queryClient = makeQueryClient();
  const runtime: ClientManagedRuntime = ManagedRuntime.make(buildTestLive(queryClient));

  const result = render(ui, {
    ...options,
    wrapper: ({ children }) => (
      <HarnessProviders queryClient={queryClient} runtime={runtime}>
        {children}
      </HarnessProviders>
    ),
  });

  return {
    ...result,
    queryClient,
    runtime,
    dispose: () => runtime.dispose(),
  };
};
