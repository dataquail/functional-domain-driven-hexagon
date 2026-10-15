import type { Handle } from "@sveltejs/kit/hooks";
import * as Option from "effect/Option";

import { handleRequest } from "./lib/server/handle-request";
import { serverBinding } from "./lib/server/platform";

export const handle: Handle = async ({ event, resolve }) =>
  handleRequest({
    url: event.url,
    request: event.request,
    server: serverBinding(Option.fromUndefinedOr(event.platform)),
    attachRuntime: (runtime) => {
      event.locals.runtime = runtime;
    },
    resolve: async () => resolve(event),
  });
