// The per-request server runtime, pointed at MSW. The real runtime calls the
// server Worker's binding at `http://server`; this fetch hands the same request
// to the base URL MSW intercepts, so the server-side helpers run their real
// client end to end.

import { makeServerRuntime, type ServerRuntime } from "@/services/runtime.server";

import { TEST_API_BASE } from "./typed-handler";

const SERVER_ORIGIN = "http://server";

const urlOf = (input: RequestInfo | URL): string => {
  if (input instanceof Request) return input.url;

  return String(input);
};

const toMsw: typeof globalThis.fetch = (input, init) =>
  // oxlint-disable-next-line effect/noGlobals -- MSW intercepts the global fetch, which is the whole point of this stand-in
  globalThis.fetch(`${TEST_API_BASE}${urlOf(input).slice(SERVER_ORIGIN.length)}`, init);

export const serverRuntimeOverMsw = (cookieHeader = ""): ServerRuntime =>
  makeServerRuntime(toMsw, cookieHeader);
