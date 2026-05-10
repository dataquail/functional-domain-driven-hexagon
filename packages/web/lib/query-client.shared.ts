// Shared QueryClient factory used by both the server (per-request) and
// the client (singleton-per-tab). Keeping the defaults in one place
// avoids subtle SSR/CSR drift in retry/staleTime semantics.
import { QueryClient } from "@tanstack/react-query";
import * as Duration from "effect/Duration";

export const makeQueryClient = (): QueryClient =>
  new QueryClient({
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
  });
