import * as Effect from "effect/Effect";

import { makeServerRuntime, type ServerRuntime } from "@/services/runtime.server";

const API_PREFIX = "/api";

export type ServerBinding = Pick<Fetcher, "fetch">;

// What the server hook needs from one Kit request, so it can be driven without one.
export type HookRequest = {
  readonly url: URL;
  readonly request: Request;
  readonly server: ServerBinding;
  readonly attachRuntime: (runtime: ServerRuntime) => void;
  readonly resolve: () => Promise<Response>;
};

const forwardedInit = (request: Request) => {
  const init = { method: request.method, headers: request.headers, redirect: "manual" } as const;

  if (request.method === "GET" || request.method === "HEAD") return init;

  return { ...init, body: request.body, duplex: "half" } as const;
};

// `/api/*` is the browser's door to the Effect server (ADR-0018): the prefix
// is stripped and the request goes to the server Worker as sent. Redirects are
// not followed, so the OIDC dance's Location and Set-Cookie reach the browser
// unchanged.
const proxyToServer = async (
  server: ServerBinding,
  request: Request,
  url: URL,
): Promise<Response> => {
  const target = new URL(`${url.pathname.slice(API_PREFIX.length)}${url.search}`, url.origin);
  const response = await server.fetch(target, forwardedInit(request));

  return new Response(response.body, response);
};

const isApiPath = (pathname: string): boolean =>
  pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);

export const handleRequest = async (hook: HookRequest): Promise<Response> => {
  if (isApiPath(hook.url.pathname)) {
    return proxyToServer(hook.server, hook.request, hook.url);
  }

  const runtime = makeServerRuntime(
    (input, init) => hook.server.fetch(input, init),
    hook.request.headers.get("cookie") ?? "",
  );

  hook.attachRuntime(runtime);

  return Effect.runPromise(
    Effect.promise(hook.resolve).pipe(
      Effect.ensuring(Effect.promise(async () => runtime.dispose())),
    ),
  );
};
