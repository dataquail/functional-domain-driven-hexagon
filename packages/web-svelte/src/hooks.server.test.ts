import { describe, expect, it, vi } from "vitest";

vi.mock("$app/server", () => ({ getRequestEvent: vi.fn() }));

const { handle } = await import("./hooks.server");

type FetchCall = { readonly url: string; readonly init: RequestInit | undefined };

const fakeServer = (response: Response) => {
  const calls: Array<FetchCall> = [];
  const server = {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return Promise.resolve(response);
    },
  };
  return { calls, server };
};

const eventFor = (url: string, init: RequestInit, server: unknown) => {
  const request = new Request(url, init);
  return {
    url: new URL(url),
    request,
    platform: { env: { SERVER: server } },
    locals: {} as Record<string, unknown>,
  };
};

const run = (event: ReturnType<typeof eventFor>, resolve = vi.fn()) =>
  handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);

describe("handle", () => {
  it("proxies /api to the server Worker with the prefix stripped", async () => {
    const { calls, server } = fakeServer(new Response("{}", { status: 200 }));
    const event = eventFor(
      "http://app.test/api/users?page=2",
      { headers: { cookie: "session=abc" } },
      server,
    );

    const response = await run(event);

    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("http://app.test/users?page=2");
    expect(calls[0]?.init?.redirect).toBe("manual");
    expect(new Headers(calls[0]?.init?.headers).get("cookie")).toBe("session=abc");
  });

  it("forwards a write's method and body", async () => {
    const { calls, server } = fakeServer(new Response(null, { status: 204 }));
    const event = eventFor(
      "http://app.test/api/todos",
      { method: "POST", body: '{"title":"x"}', headers: { "content-type": "application/json" } },
      server,
    );

    await run(event);

    expect(calls[0]?.init?.method).toBe("POST");
    expect(await new Response(calls[0]?.init?.body).text()).toBe('{"title":"x"}');
  });

  it("hands a redirect and its cookie back to the browser untouched", async () => {
    const { server } = fakeServer(
      new Response(null, {
        status: 302,
        headers: { location: "http://auth.test/authorize", "set-cookie": "oidc_pkce=1" },
      }),
    );

    const response = await run(eventFor("http://app.test/api/auth/login", {}, server));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://auth.test/authorize");
    expect(response.headers.get("set-cookie")).toBe("oidc_pkce=1");
  });

  it("renders every other path with a per-request runtime it disposes afterwards", async () => {
    const { calls, server } = fakeServer(new Response("{}"));
    const event = eventFor("http://app.test/users", {}, server);
    const resolve = vi.fn(() => Promise.resolve(new Response("page")));

    const response = await run(event, resolve);

    expect(await response.text()).toBe("page");
    expect(resolve).toHaveBeenCalledWith(event);
    expect(event.locals.runtime).toBeDefined();
    expect(calls).toHaveLength(0);
  });

  it("refuses to serve without the server Worker binding", async () => {
    const event = { ...eventFor("http://app.test/users", {}, undefined), platform: undefined };

    await expect(run(event as never)).rejects.toMatchObject({ status: 500 });
  });
});
