import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { Api } from "@/api.js";

import { deviceStartEndpoint } from "./device-start.endpoint.js";
import { deviceTokenEndpoint } from "./device-token.endpoint.js";

// Registers the CLI-facing device-auth endpoints (the `cliAuth` group on
// `CliApi`). Thin group registration, mirroring `auth-live.ts` for HTTP.
export const CliAuthLive = HttpApiBuilder.group(Api, "cliAuth", (handlers) =>
  handlers.handle("deviceStart", deviceStartEndpoint).handle("deviceToken", deviceTokenEndpoint),
);
