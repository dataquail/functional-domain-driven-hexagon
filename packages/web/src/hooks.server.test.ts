import * as Option from "effect/Option";
import { describe, expect, it } from "vitest";

import type { ServerRuntime } from "@/services/runtime.server";

import { handleRequest, type ServerBinding } from "./lib/server/handle-request";
import { serverAt, serverBinding, serverUrlOf } from "./lib/server/platform";

type FetchCall = { readonly url: string; readonly init: RequestInit };

const fakeServer = (response: Response) => {
  const calls: Array<FetchCall> = [];

  const server: ServerBinding = {
    fetch: async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });

      return response;
    },
  };

  return { calls, server };
};

const hookFor = (
  url: string,
  init: RequestInit,
  server: ServerBinding,
  resolve: () => Promise<Response> = async () => new Response("page"),
) => {
  const runtimes: Array<ServerRuntime> = [];

  return {
    runtimes,
    hook: {
      url: new URL(url),
      request: new Request(url, init),
      server,
      attachRuntime: (runtime: ServerRuntime) => {
        runtimes.push(runtime);
      },
      resolve,
    },
  };
};

describe("handle", () => {
  it("proxies /api to the server Worker with the prefix stripped", async () => {
    const { calls, server } = fakeServer(new Response("{}", { status: 200 }));

    const { hook } = hookFor(
      "http://app.test/api/users?page=2",
      { headers: { cookie: "session=abc" } },
      server,
    );

    const response = await handleRequest(hook);

    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("http://app.test/users?page=2");
    expect(calls[0]?.init.redirect).toBe("manual");
    expect(new Headers(calls[0]?.init.headers).get("cookie")).toBe("session=abc");
  });

  it("forwards a write's method and body", async () => {
    const { calls, server } = fakeServer(new Response("{}", { status: 201 }));

    const { hook } = hookFor(
      "http://app.test/api/todos",
      { method: "POST", body: '{"title":"x"}', headers: { "content-type": "application/json" } },
      server,
    );

    await handleRequest(hook);

    expect(calls[0]?.init.method).toBe("POST");
    expect(await new Response(calls[0]?.init.body).text()).toBe('{"title":"x"}');
  });

  it("hands a redirect and its cookie back to the browser untouched", async () => {
    const { server } = fakeServer(
      new Response("", {
        status: 302,
        headers: { location: "http://auth.test/authorize", "set-cookie": "oidc_pkce=1" },
      }),
    );

    const response = await handleRequest(
      hookFor("http://app.test/api/auth/login", {}, server).hook,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://auth.test/authorize");
    expect(response.headers.get("set-cookie")).toBe("oidc_pkce=1");
  });

  it("renders every other path with a per-request runtime it disposes afterwards", async () => {
    const { calls, server } = fakeServer(new Response("{}"));
    const resolved: Array<string> = [];

    const { hook, runtimes } = hookFor("http://app.test/users", {}, server, async () => {
      resolved.push("page");

      return new Response("page");
    });

    const response = await handleRequest(hook);

    expect(await response.text()).toBe("page");
    expect(resolved).toEqual(["page"]);
    expect(runtimes).toHaveLength(1);
    expect(calls).toHaveLength(0);
  });

  it("refuses to serve without the server Worker binding or a server URL", () => {
    expect(() => serverBinding(Option.none(), Option.none())).toThrow(
      expect.objectContaining({ status: 500 }),
    );
  });
});

describe("serverBinding on Lambda", () => {
  it("reads the server's URL from the process environment", () => {
    const lambda = {
      ...globalThis,
      process: { ...process, env: { SERVER_URL: "https://server.on.aws" } },
    };

    const worker = { ...globalThis, process: { ...process, env: {} } };

    expect(serverUrlOf(lambda)).toEqual(Option.some("https://server.on.aws"));
    expect(serverUrlOf(worker)).toEqual(Option.none());
  });

  it("sends the request to the server's origin with its path and query", async () => {
    const calls: Array<string> = [];

    const server = serverAt("https://server.example/", async (input) => {
      calls.push(String(input));

      return new Response("{}");
    });

    await server.fetch("http://app.test/users?page=2", {});

    expect(calls).toEqual(["https://server.example/users?page=2"]);
  });
});
