// Per-request `QueryClient` for server components. `React.cache` keeps
// the same instance across nested server components in a single request,
// so calling `prefetchEffectQuery` from any server component populates
// the cache that's later dehydrated and shipped to the client.
import "server-only";

import { type QueryClient } from "@tanstack/react-query";
import { cache } from "react";
import { makeQueryClient } from "./query-client.shared";

export const getQueryClient = cache((): QueryClient => makeQueryClient());
