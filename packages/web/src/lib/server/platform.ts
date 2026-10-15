import { error } from "@sveltejs/kit";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import type { ServerBinding } from "./handle-request";

// On Lambda there is no service binding: the server is a Function URL, named by
// the stack in the process environment.
const LambdaHost = Schema.Struct({
  process: Schema.Struct({ env: Schema.Struct({ SERVER_URL: Schema.String }) }),
});

export const serverUrlOf = (host: typeof globalThis): Option.Option<string> =>
  Option.map(Schema.decodeUnknownOption(LambdaHost)(host), ({ process }) => process.env.SERVER_URL);

type Send = (input: URL, init?: RequestInit) => Promise<Response>;

const urlOf = (input: RequestInfo | URL): URL => {
  if (input instanceof Request) return new URL(input.url);

  return new URL(String(input));
};

// The request keeps its path and query; only the origin becomes the server's.
export const serverAt = (serverUrl: string, send: Send): ServerBinding => ({
  fetch: async (input, init) => {
    const url = urlOf(input);

    return send(new URL(`${url.pathname}${url.search}`, serverUrl), init);
  },
});

// The one file that reads the host bindings the Alchemy stacks declare.
export const serverBinding = (
  platform: Option.Option<App.Platform>,
  serverUrl: Option.Option<string>,
): ServerBinding =>
  Option.match(platform, {
    onSome: (bound) => bound.env.SERVER,
    onNone: () =>
      Option.match(serverUrl, {
        onNone: () => error(500, "The server Worker binding is missing."),
        onSome: (url) => serverAt(url, (input, init) => fetch(input, init)),
      }),
  });
