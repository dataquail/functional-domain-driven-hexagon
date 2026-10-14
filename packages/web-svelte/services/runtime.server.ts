// Per-request `ManagedRuntime` for load functions. The server hook builds one
// for each request over the server Worker's binding and the inbound cookie,
// and disposes it when the response is ready, so no runtime -- and no captured
// cookie -- outlives its request.

import * as ManagedRuntime from "effect/ManagedRuntime";

import { getRequestEvent } from "$app/server";

import { ApiClientLive } from "./api-client.server";
import type { ApiClient } from "./api-client.shared";

export type ServerRuntime = ManagedRuntime.ManagedRuntime<ApiClient, never>;

export const makeServerRuntime = (
  fetch: typeof globalThis.fetch,
  cookieHeader: string,
): ServerRuntime => ManagedRuntime.make(ApiClientLive(fetch, cookieHeader));

export const getServerRuntime = async (): Promise<ServerRuntime> =>
  getRequestEvent().locals.runtime;
