import type { Handle } from "@sveltejs/kit/hooks";

import { makeServerRuntime } from "@/services/runtime.server";

import { serverBinding } from "./lib/server/platform";

const API_PREFIX = "/api";

// `/api/*` is the browser's door to the Effect server (ADR-0018): the prefix
// is stripped and the request goes to the server Worker as sent. Redirects are
// not followed, so the OIDC dance's Location and Set-Cookie reach the browser
// unchanged.
const proxyToServer = async (server: Fetcher, request: Request, url: URL): Promise<Response> => {
  const target = new URL(`${url.pathname.slice(API_PREFIX.length)}${url.search}`, url.origin);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const response = await server.fetch(target, {
    method: request.method,
    headers: request.headers,
    body: hasBody ? request.body : undefined,
    redirect: "manual",
    ...(hasBody ? { duplex: "half" } : {}),
  });
  return new Response(response.body, response);
};

const isApiPath = (pathname: string): boolean =>
  pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);

export const handle: Handle = async ({ event, resolve }) => {
  const server = serverBinding(event.platform);
  if (isApiPath(event.url.pathname)) {
    return proxyToServer(server, event.request, event.url);
  }
  const runtime = makeServerRuntime(
    (input, init) => server.fetch(input, init),
    event.request.headers.get("cookie") ?? "",
  );
  event.locals.runtime = runtime;
  try {
    return await resolve(event);
  } finally {
    await runtime.dispose();
  }
};
