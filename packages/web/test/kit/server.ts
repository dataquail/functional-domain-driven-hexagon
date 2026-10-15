// Stands in for SvelteKit's `$app/server` outside a Kit render. A test serves
// the request a server helper reads; outside one, there is no request to read.
import * as Option from "effect/Option";

export type ServedRequest = { readonly locals: App.Locals };

const served = { request: Option.none<ServedRequest>() };

export const serveRequest = (request: ServedRequest): void => {
  served.request = Option.some(request);
};

export const endRequest = (): void => {
  served.request = Option.none();
};

export const getRequestEvent = (): ServedRequest => Option.getOrThrow(served.request);
