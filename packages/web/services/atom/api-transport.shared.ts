// Where the API lives and what rides on every request, as an atom rather
// than a constant. Reading it through `get` inside the `ApiAtoms` httpClient
// factory is what lets one service definition serve two very different
// callers: the browser talks to the same-origin `/api` proxy and lets the
// cookie jar attach the session, while a server registry talks to the Effect
// server directly with the inbound request's Cookie forwarded explicitly.

import * as Atom from "effect/unstable/reactivity/Atom";

export type ApiTransport = {
  readonly baseUrl: string;
  readonly headers: Record<string, string>;
};

export const BROWSER_TRANSPORT: ApiTransport = {
  baseUrl: "/api",
  headers: {},
};

export const apiTransportAtom = Atom.make<ApiTransport>(BROWSER_TRANSPORT);
