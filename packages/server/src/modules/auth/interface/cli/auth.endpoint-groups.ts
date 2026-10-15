import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";

import { Api } from "@/globals/infrastructure/framework/http/api";

import { deviceStartEndpoint } from "./device-start.endpoint";
import { deviceTokenEndpoint } from "./device-token.endpoint";

// Registers the CLI-facing device-auth endpoints (the `cliAuth` group on
// `CliApi`). Thin group registration, mirroring `auth-live.ts` for HTTP.
export const CliAuthLive = HttpApiBuilder.group(Api, "cliAuth", (handlers) =>
  handlers.handle("deviceStart", deviceStartEndpoint).handle("deviceToken", deviceTokenEndpoint),
);
