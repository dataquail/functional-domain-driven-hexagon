"use client";

// Singleton-per-tab QueryClient on the browser, fresh-per-request on the
// server. The `isServer` branch matters: each server render must NOT
// share a QueryClient across requests (cache leak), but the browser
// should keep one client across re-renders so cached queries survive.
// This is the canonical TanStack Query SSR pattern; see
// https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr.
//
// The component-tree QueryClient is intentionally separate from the
// server-only `getQueryClient()` in `lib/query-client.server.ts`:
//   - server-only: per-request, lives only during the RSC render
//   - this one:    survives across renders in the browser tab
// `<HydrationBoundary>` in each page bridges the two by deserializing
// the server-only client's dehydrated state into the browser client.

import { makeQueryClient } from "@/lib/query-client.shared";
import { RuntimeProvider } from "@/services/runtime.client";
import { Toaster } from "@org/components/primitives/toaster";
import { ThemeProvider } from "@org/components/providers/theme-provider";
import { isServer, type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

let browserQueryClient: QueryClient | undefined;

const getQueryClient = (): QueryClient => {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
};

export const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = getQueryClient();
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RuntimeProvider queryClient={queryClient}>{children}</RuntimeProvider>
        <Toaster />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  );
};
