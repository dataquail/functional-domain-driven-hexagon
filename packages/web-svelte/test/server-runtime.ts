// The per-request server runtime, pointed at MSW. The real runtime calls the
// server Worker's binding at `http://server`; this fetch hands the same request
// to the base URL MSW intercepts, so the server-side helpers run their real
// client end to end.

import { makeServerRuntime, type ServerRuntime } from "@/services/runtime.server";

import { TEST_API_BASE } from "./typed-handler";

const SERVER_ORIGIN = "http://server";

const toMsw: typeof globalThis.fetch = (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  return globalThis.fetch(`${TEST_API_BASE}${url.slice(SERVER_ORIGIN.length)}`, init);
};

export const serverRuntimeOverMsw = (cookieHeader = ""): ServerRuntime =>
  makeServerRuntime(toMsw, cookieHeader);
