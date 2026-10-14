import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as Layer from "effect/Layer";

import { Api } from "@/globals/infrastructure/framework/http/api.ts";

import { CliAuthLive } from "../cli/auth.endpoint-groups.ts";
import { callbackEndpoint } from "./callback.endpoint.ts";
import { createTokenEndpoint } from "./create-token.endpoint.ts";
import { deviceApproveEndpoint } from "./device-approve.endpoint.ts";
import { listTokensEndpoint } from "./list-tokens.endpoint.ts";
import { loginEndpoint } from "./login.endpoint.ts";
import { logoutEndpoint } from "./logout.endpoint.ts";
import { meEndpoint } from "./me.endpoint.ts";
import { revokeTokenEndpoint } from "./revoke-token.endpoint.ts";

const AuthPublicLive = HttpApiBuilder.group(Api, "auth", (handlers) =>
  handlers
    .handleRaw("login", loginEndpoint)
    .handleRaw("callback", callbackEndpoint)
    .handleRaw("logout", logoutEndpoint),
);

const AuthPrivateLive = HttpApiBuilder.group(Api, "authSession", (handlers) =>
  handlers.handle("me", meEndpoint),
);

// GUI-managed personal access tokens (ADR-0005). Mint/list/revoke are a
// human-in-the-browser concern, so they live on the GUI surface alongside
// `me`, all behind `UserAuthMiddleware`.
const AuthTokensLive = HttpApiBuilder.group(Api, "authTokens", (handlers) =>
  handlers
    .handle("create", createTokenEndpoint)
    .handle("list", listTokensEndpoint)
    .handle("revoke", revokeTokenEndpoint),
);

// Browser-side device-grant approval (GUI surface).
const AuthDeviceLive = HttpApiBuilder.group(Api, "authDevice", (handlers) =>
  handlers.handle("approve", deviceApproveEndpoint),
);

export const AuthLive = Layer.mergeAll(
  AuthPublicLive,
  AuthPrivateLive,
  AuthTokensLive,
  AuthDeviceLive,
  // CLI-facing device start/poll (the `cliAuth` group on CliApi). Registered
  // here so AuthModuleLive wires the whole auth surface in one place.
  CliAuthLive,
);
