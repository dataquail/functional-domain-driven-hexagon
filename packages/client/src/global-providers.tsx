import { QueryClientProvider, QueryClient as TanstackQueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import * as Duration from "effect/Duration";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as LogLevel from "effect/LogLevel";
import * as ManagedRuntime from "effect/ManagedRuntime";
import React from "react";
import { ThemeProvider } from "./components/providers/theme-provider";
import { Toaster } from "./components/ui";
import "./index.css";
import { envVars } from "./lib/env-vars";
import { routeTree } from "./routeTree.gen";
import { ApiClient } from "./services/common/api-client";
import { NetworkMonitor } from "./services/common/network-monitor";
import { QueryClient } from "./services/common/query-client";
import { SseQueries } from "./services/data-access/sse-queries";
import { type LiveManagedRuntime } from "./services/live-layer";
import { RuntimeProvider } from "./services/runtime/runtime-provider";
import { WorkerClient } from "./services/worker/worker-client";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Register {
    router: typeof router;
  }
}

const InnerProviders: React.FC = () => {
  const queryClient = React.useMemo(
    () =>
      new TanstackQueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            retryDelay: 0,
            staleTime: Duration.toMillis("5 minutes"),
          },
          mutations: {
            retry: false,
            retryDelay: 0,
          },
        },
      }),
    [],
  );

  const runtime: LiveManagedRuntime = React.useMemo(
    () =>
      ManagedRuntime.make(
        Layer.mergeAll(
          WorkerClient.Default,
          NetworkMonitor.Default,
          ApiClient.Default,
          QueryClient.make(queryClient),
          Logger.minimumLogLevel(envVars.ENV === "dev" ? LogLevel.Debug : LogLevel.Info),
        ).pipe(Layer.provide(Logger.pretty)),
      ),
    [queryClient],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ReactQueryDevtools initialIsOpen={false} />

      <RuntimeProvider runtime={runtime}>
        <SseQueries.SseConnector />
        <RouterProvider router={router} />
      </RuntimeProvider>
    </QueryClientProvider>
  );
};

export const GlobalProviders: React.FC = () => {
  return (
    <ThemeProvider>
      <Toaster />
      <InnerProviders />
    </ThemeProvider>
  );
};
